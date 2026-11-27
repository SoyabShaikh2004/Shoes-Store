'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { CartItem } from '@/app/cart/page';
import OnlineUPIPayment from '@/components/OnlineUPIPayment';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { generateTaxInvoicePDF, InvoiceOrderData } from '@/lib/invoiceGenerator';
import { resolveProductImage } from '@/lib/productImages';
import { notifyStorefrontChanged } from '@/lib/storefrontSync';
import {
  CreditCard,
  Banknote,
  CheckCircle,
  MessageCircle,
  Phone,
  Truck,
  ShieldCheck,
  Package,
  Lock,
  LogIn,
  UserPlus,
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FileDown,
  Trash2,
  Minus,
  Plus,
  Check,
  MapPin,
} from 'lucide-react';
import toast from 'react-hot-toast';

type CheckoutStep = 'cart' | 'delivery' | 'payment';

const FREE_SHIPPING_THRESHOLD = 2999;
const STANDARD_SHIPPING_FEE = 199;
const MERCHANT_UPI_ID = 'soyxbshxikh-1@okaxis';
const MERCHANT_PHONE = '8830422747';

const generateFreshOrderId = () =>
  `STEP-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;

const notifyCartUpdated = () => {
  window.dispatchEvent(new Event('cartUpdated'));
};

const notifyCheckoutUi = (orderComplete: boolean) => {
  window.dispatchEvent(new CustomEvent('checkoutUiState', { detail: { orderComplete } }));
};

export default function CartItems() {
  const prefersReducedMotion = useReducedMotion();

  const [items, setItems] = useState<CartItem[]>([]);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [step, setStep] = useState<CheckoutStep>('cart');
  const [showGstDetails, setShowGstDetails] = useState<boolean>(false);

  const [paymentMethod, setPaymentMethod] = useState<'online_upi' | 'cod' | 'stripe'>('online_upi');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');
  const [upiConfirmSignal, setUpiConfirmSignal] = useState(0);

  const [cardDetails, setCardDetails] = useState({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    name: '',
  });
  const [cardNetwork, setCardNetwork] = useState<string>('');

  const [orderComplete, setOrderComplete] = useState(false);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);

  // Customer details for delivery
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [customerPincode, setCustomerPincode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [orderId, setOrderId] = useState<string>('');
  const [completedSnapshot, setCompletedSnapshot] = useState<InvoiceOrderData | null>(null);

  const [transactionData, setTransactionData] = useState<{
    id: string;
    amount: number;
    timestamp: string;
    method: string;
    status: string;
    utrNumber?: string;
    extraInfo?: {
      pincode?: string;
      estimatedDelivery: string;
      address?: string;
      phone?: string;
    };
  } | null>(null);

  // Itemized billing calculations (synced cleanly with Tax Invoice PDF)
  const billing = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalMrp = items.reduce((sum, item) => {
      const unitMrp = item.mrp && item.mrp > item.price ? item.mrp : item.price;
      return sum + unitMrp * item.quantity;
    }, 0);
    const discountSavings = Math.max(0, totalMrp - subtotal);
    const shippingFee =
      subtotal === 0 ? 0 : subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
    const grandTotal = subtotal + shippingFee;
    const taxableValue = Math.round((grandTotal / 1.18) * 100) / 100;
    const totalGst = Math.round((grandTotal - taxableValue) * 100) / 100;
    const cgst = Math.round((totalGst / 2) * 100) / 100;
    const sgst = Math.round((totalGst - cgst) * 100) / 100;
    const freeShippingGap = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      subtotal,
      totalMrp,
      discountSavings,
      shippingFee,
      grandTotal,
      taxableValue,
      totalGst,
      cgst,
      sgst,
      freeShippingGap,
      itemCount,
    };
  }, [items]);

  const hydrateUserFields = useCallback((rawUser: { name?: string; phone?: string; address?: string; pincode?: string }) => {
    if (rawUser.name) setCustomerName((prev) => prev || rawUser.name || '');
    if (rawUser.phone) {
      setCustomerPhone((prev) => prev || String(rawUser.phone).replace(/\D/g, '').slice(-10));
    }
    if (rawUser.address) setDeliveryAddress((prev) => prev || rawUser.address || '');
    if (rawUser.pincode) {
      setCustomerPincode((prev) => prev || String(rawUser.pincode).replace(/\D/g, '').slice(0, 6));
    }
  }, []);

  const syncAuthAndUser = useCallback(async () => {
    let authed = localStorage.getItem('isAuthenticated') === 'true';

    if (authed) {
      setIsAuthenticated(true);
      try {
        const storedUser = localStorage.getItem('authUser') || localStorage.getItem('user');
        if (storedUser) {
          hydrateUserFields(JSON.parse(storedUser));
        }
      } catch {
        // ignore
      }
      return;
    }

    try {
      const res = await fetch('/api/auth/google/session', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.authenticated && data.user) {
          authed = true;
          localStorage.setItem('isAuthenticated', 'true');
          localStorage.setItem('authUser', JSON.stringify(data.user));
          setIsAuthenticated(true);
          hydrateUserFields(data.user);
          window.dispatchEvent(new Event('authUpdated'));
          return;
        }
      }
    } catch {
      // ignore session check error
    }

    setIsAuthenticated(false);
  }, [hydrateUserFields]);

  // Load cart items & auth state
  useEffect(() => {
    const loadCartItems = () => {
      try {
        const storedItems = localStorage.getItem('cartItems');
        if (storedItems) {
          const parsed = JSON.parse(storedItems);
          setItems(Array.isArray(parsed) ? parsed : []);
        } else {
          setItems([]);
        }
      } catch {
        setItems([]);
      }
    };

    const handleAuthChange = () => {
      void syncAuthAndUser();
    };

    loadCartItems();
    void syncAuthAndUser();

    window.addEventListener('storage', loadCartItems);
    window.addEventListener('cartUpdated', loadCartItems);
    window.addEventListener('storage', handleAuthChange);
    window.addEventListener('authUpdated', handleAuthChange);

    return () => {
      window.removeEventListener('storage', loadCartItems);
      window.removeEventListener('cartUpdated', loadCartItems);
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('authUpdated', handleAuthChange);
    };
  }, [syncAuthAndUser]);

  // Auto-advance to Delivery step when arriving from Quick Buy -> Buy Now
  useEffect(() => {
    if (items.length === 0 || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'quick') {
      setStep('delivery');
    }
  }, [items.length]);

  // Notify mobile bottom bar coordination when order completes
  useEffect(() => {
    notifyCheckoutUi(orderComplete);
  }, [orderComplete]);

  // Generate fresh Order ID whenever starting a new order
  useEffect(() => {
    if (!orderId && !orderComplete) {
      setOrderId(generateFreshOrderId());
    }
  }, [orderId, orderComplete]);

  // Detect card network
  useEffect(() => {
    const cardNum = cardDetails.cardNumber.replace(/\s/g, '');
    if (cardNum.startsWith('4')) setCardNetwork('Visa');
    else if (/^5[1-5]/.test(cardNum)) setCardNetwork('Mastercard');
    else if (/^3[47]/.test(cardNum)) setCardNetwork('American Express');
    else if (/^6(?:011|5)/.test(cardNum)) setCardNetwork('Discover');
    else if (cardNum.length > 6) setCardNetwork('Card');
    else setCardNetwork('');
  }, [cardDetails.cardNumber]);

  const getImagePath = resolveProductImage;

  const handleRemoveItem = (itemToRemove: CartItem) => {
    const updatedItems = items.filter(
      (item) =>
        !(
          item.id === itemToRemove.id &&
          item.selectedSize === itemToRemove.selectedSize &&
          (item.selectedColor || '') === (itemToRemove.selectedColor || '')
        )
    );
    localStorage.setItem('cartItems', JSON.stringify(updatedItems));
    setItems(updatedItems);
    notifyCartUpdated();
  };

  const handleQuantityChange = (itemToUpdate: CartItem, newQuantity: number) => {
    if (newQuantity < 1) return handleRemoveItem(itemToUpdate);
    const updatedItems = items.map((item) =>
      item.id === itemToUpdate.id &&
      item.selectedSize === itemToUpdate.selectedSize &&
      (item.selectedColor || '') === (itemToUpdate.selectedColor || '')
        ? { ...item, quantity: newQuantity }
        : item
    );
    localStorage.setItem('cartItems', JSON.stringify(updatedItems));
    setItems(updatedItems);
    notifyCartUpdated();
  };

  const getEstimatedDeliveryDate = () => {
    const today = new Date();
    const deliveryDays = 4;
    const estimatedDate = new Date(today);
    estimatedDate.setDate(today.getDate() + deliveryDays);
    return estimatedDate.toLocaleDateString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const validateDeliveryForm = (): boolean => {
    setErrorMessage('');
    if (!isAuthenticated) {
      setErrorMessage('Please sign in to continue.');
      return false;
    }
    if (customerName.trim().length < 2) {
      setErrorMessage('Please enter recipient full name.');
      return false;
    }
    if (!/^\d{10}$/.test(customerPhone.trim())) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return false;
    }
    if (deliveryAddress.trim().length < 10) {
      setErrorMessage('Please enter a complete house/street delivery address.');
      return false;
    }
    if (!/^\d{6}$/.test(customerPincode.trim())) {
      setErrorMessage('Please enter a valid 6-digit pincode.');
      return false;
    }
    return true;
  };

  const handleProceedToPayment = () => {
    if (!validateDeliveryForm()) return;
    setStep('payment');
    scrollToTop();
  };

  const persistPlacedOrder = async (params: {
    date: string;
    totalAmount: number;
    paymentStatus: string;
    paymentMethod: string;
    transactionId?: string;
    utrNumber?: string;
    paidToUPI?: string;
    estimatedDelivery: string;
    pincodeOverride?: string;
    stage: 'payment_confirmed' | 'processing';
  }): Promise<{ ok: boolean; error?: string; order?: Record<string, unknown> }> => {
    let customerEmail: string | undefined;
    try {
      const storedUser = localStorage.getItem('authUser') || localStorage.getItem('user');
      if (storedUser) {
        const parsedEmail = JSON.parse(storedUser)?.email;
        if (typeof parsedEmail === 'string' && parsedEmail.includes('@')) {
          customerEmail = parsedEmail.trim();
        }
      }
    } catch {
      // ignore
    }

    if (!customerEmail) {
      try {
        const sessionRes = await fetch('/api/auth/google/session', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          if (sessionData?.authenticated && typeof sessionData.user?.email === 'string') {
            customerEmail = sessionData.user.email.trim();
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('authUser', JSON.stringify(sessionData.user));
          }
        }
      } catch {
        // ignore fallback session lookup error
      }
    }

    const activeOrderId = orderId || generateFreshOrderId();

    const normalizedPayStatus =
      params.paymentStatus === 'PAID'
        ? 'Paid'
        : params.paymentStatus.toLowerCase().includes('fail')
        ? 'Failed'
        : 'Pending';

    const itemsSnapshot = items.map((item) => ({
      ...item,
      imagePath: getImagePath(item),
    }));

    const invoiceSnapshot: InvoiceOrderData = {
      orderId: activeOrderId,
      date: params.date,
      items: itemsSnapshot,
      shippingFee: billing.shippingFee,
      discountAmount: billing.discountSavings,
      totalAmount: params.totalAmount,
      paymentStatus: params.paymentStatus,
      paymentMethod: params.paymentMethod,
      transactionId: params.transactionId,
      utrNumber: params.utrNumber,
      paidToUPI: params.paidToUPI,
      customer: {
        name: customerName.trim() || 'Valued Customer',
        phone: customerPhone.trim() || 'N/A',
        address: deliveryAddress.trim() || 'Address provided upon order',
        pincode: params.pincodeOverride || customerPincode.trim() || '400001',
        email: customerEmail,
      },
      estimatedDelivery: params.estimatedDelivery,
    };

    const orderPayload = {
      orderId: activeOrderId,
      date: params.date,
      items: itemsSnapshot,
      shippingFee: billing.shippingFee,
      totalAmount: params.totalAmount,
      paymentStatus: normalizedPayStatus,
      paymentMethod: params.paymentMethod,
      transactionId: params.transactionId,
      utrNumber: params.utrNumber || 'N/A',
      paidToUPI: params.paidToUPI,
      customer: invoiceSnapshot.customer,
      estimatedDelivery: params.estimatedDelivery,
      status: normalizedPayStatus === 'Paid' ? 'Order Confirmed' : 'Order Placed',
      stage: params.stage,
      carrier: 'BlueDart Express',
      trackingNumber: `BD-IN-${activeOrderId.replace(/\D/g, '').slice(-8) || '84920194'}`,
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(orderPayload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        return {
          ok: false,
          error: data?.error || 'Could not place your order. Please check your cart and try again.',
        };
      }

      const persistedRecord: Record<string, unknown> = data.order || orderPayload;
      setCompletedSnapshot(invoiceSnapshot);
      setOrderId('');

      try {
        const hintsRaw = localStorage.getItem('orderVerifyHints');
        const hints = hintsRaw ? JSON.parse(hintsRaw) : {};
        const hintVal = customerEmail || customerPhone;
        if (hintVal && activeOrderId) {
          hints[activeOrderId.toUpperCase()] = hintVal;
          localStorage.setItem('orderVerifyHints', JSON.stringify(hints));
        }
      } catch {
        // ignore
      }

      try {
        const existingOrders = JSON.parse(localStorage.getItem('orders') || '[]');
        const filtered = Array.isArray(existingOrders)
          ? existingOrders.filter(
              (o: { orderId?: string; orderNumber?: string }) =>
                o.orderId !== activeOrderId && o.orderNumber !== activeOrderId
            )
          : [];
        filtered.unshift(persistedRecord);
        localStorage.setItem('orders', JSON.stringify(filtered));
      } catch {
        // ignore
      }

      window.dispatchEvent(new Event('ordersUpdated'));
      notifyStorefrontChanged('orders');

      return { ok: true, order: persistedRecord };
    } catch {
      return {
        ok: false,
        error: 'Network error submitting order. Please verify your connection and try again.',
      };
    }
  };

  // Validate Card details
  const validateCardDetails = () => {
    const { cardNumber, expiryDate, cvv, name } = cardDetails;
    const cleanNum = cardNumber.replace(/\s/g, '');
    if (cleanNum.length < 15 || cleanNum.length > 16) {
      setErrorMessage('Please enter a valid 15 or 16-digit card number.');
      return false;
    }
    if (expiryDate.length < 5) {
      setErrorMessage('Please enter a valid expiry date (MM/YY).');
      return false;
    }
    const [mStr, yStr] = expiryDate.split('/');
    const month = parseInt(mStr, 10);
    const year = parseInt(`20${yStr}`, 10);
    const now = new Date();
    if (month < 1 || month > 12 || year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
      setErrorMessage('Card expiry date is invalid or expired.');
      return false;
    }
    const reqCvv = cardNetwork === 'American Express' ? 4 : 3;
    if (cvv.length !== reqCvv) {
      setErrorMessage(`Please enter a valid ${reqCvv}-digit CVV.`);
      return false;
    }
    if (name.trim().length < 3) {
      setErrorMessage('Please enter the cardholder name.');
      return false;
    }
    return true;
  };

  const processCardPayment = async () => {
    if (!validateDeliveryForm()) {
      setStep('delivery');
      return;
    }
    if (!validateCardDetails()) return;

    setPaymentStatus('processing');
    setErrorMessage(`Authorizing ₹${billing.grandTotal.toLocaleString('en-IN')} via ${cardNetwork || 'Card'}...`);
    const timestamp = new Date().toISOString();
    const txnId = `CRD${Math.floor(100000000 + Math.random() * 900000000)}`;
    const estDelivery = getEstimatedDeliveryDate();
    const cardLabel = `${cardNetwork || 'Card'} (****${cardDetails.cardNumber.slice(-4)})`;

    const result = await persistPlacedOrder({
      date: timestamp,
      totalAmount: billing.grandTotal,
      paymentStatus: 'PAID',
      paymentMethod: cardLabel,
      transactionId: txnId,
      estimatedDelivery: estDelivery,
      stage: 'payment_confirmed',
    });

    if (!result.ok) {
      setPaymentStatus('idle');
      const errMsg = result.error || 'Unable to confirm order. Please try again.';
      setErrorMessage(errMsg);
      toast.error(errMsg);
      return;
    }

    setPaymentStatus('success');
    setErrorMessage('');
    setTransactionData({
      id: txnId,
      amount: billing.grandTotal,
      timestamp,
      method: cardLabel,
      status: 'Paid & Confirmed',
      extraInfo: {
        pincode: customerPincode,
        estimatedDelivery: estDelivery,
        address: deliveryAddress,
        phone: customerPhone,
      },
    });
    setOrderComplete(true);
    localStorage.setItem('cartItems', JSON.stringify([]));
    notifyCartUpdated();
    scrollToTop();
    toast.success('Order confirmed!');
  };

  const processCODPayment = async () => {
    if (!validateDeliveryForm()) {
      setStep('delivery');
      return;
    }

    setPaymentStatus('processing');
    setErrorMessage('Confirming Cash on Delivery order...');
    const txnId = `COD${Math.floor(100000000 + Math.random() * 900000000)}`;
    const timestamp = new Date().toISOString();
    const estDelivery = getEstimatedDeliveryDate();

    const result = await persistPlacedOrder({
      date: timestamp,
      totalAmount: billing.grandTotal,
      paymentStatus: 'COD - Pay on Delivery',
      paymentMethod: 'Cash on Delivery',
      transactionId: txnId,
      estimatedDelivery: estDelivery,
      pincodeOverride: customerPincode,
      stage: 'processing',
    });

    if (!result.ok) {
      setPaymentStatus('idle');
      const errMsg = result.error || 'Unable to confirm COD order. Please try again.';
      setErrorMessage(errMsg);
      toast.error(errMsg);
      return;
    }

    setPaymentStatus('success');
    setErrorMessage('');
    setTransactionData({
      id: txnId,
      amount: billing.grandTotal,
      timestamp,
      method: 'Cash on Delivery (COD)',
      status: 'Confirmed (Pay on Delivery)',
      extraInfo: {
        pincode: customerPincode,
        estimatedDelivery: estDelivery,
        address: deliveryAddress,
        phone: customerPhone,
      },
    });
    setOrderComplete(true);
    localStorage.setItem('cartItems', JSON.stringify([]));
    notifyCartUpdated();
    scrollToTop();
    toast.success('COD order confirmed!');
  };

  const handleOnlineUPISuccess = async (details: {
    transactionId: string;
    utrNumber?: string;
    paymentApp: string;
    amount: number;
    timestamp: string;
  }) => {
    const estDelivery = getEstimatedDeliveryDate();
    setPaymentStatus('processing');
    setErrorMessage('Recording verified UPI order...');

    const result = await persistPlacedOrder({
      date: details.timestamp,
      totalAmount: details.amount,
      paymentStatus: 'PAID',
      paymentMethod: details.paymentApp,
      transactionId: details.transactionId,
      utrNumber: details.utrNumber || 'N/A',
      paidToUPI: MERCHANT_UPI_ID,
      estimatedDelivery: estDelivery,
      stage: 'payment_confirmed',
    });

    if (!result.ok) {
      setPaymentStatus('idle');
      const errMsg = result.error || 'Unable to record your order. Please try again.';
      setErrorMessage(errMsg);
      toast.error(errMsg);
      return;
    }

    setTransactionData({
      id: details.transactionId,
      amount: details.amount,
      timestamp: details.timestamp,
      method: details.paymentApp,
      status: 'Paid & Confirmed',
      utrNumber: details.utrNumber,
      extraInfo: {
        pincode: customerPincode || '400001',
        estimatedDelivery: estDelivery,
        address: deliveryAddress || 'Address verified upon order',
        phone: customerPhone || MERCHANT_PHONE,
      },
    });
    setPaymentStatus('success');
    setErrorMessage('');
    setOrderComplete(true);
    localStorage.setItem('cartItems', JSON.stringify([]));
    notifyCartUpdated();
    scrollToTop();
    toast.success('Order confirmed!');
  };

  const handleDownloadInvoice = () => {
    if (!completedSnapshot) return;
    setIsDownloadingInvoice(true);
    try {
      generateTaxInvoicePDF(completedSnapshot);
      toast.success('Tax Invoice PDF downloaded');
    } catch {
      toast.error('Failed to generate PDF invoice');
    } finally {
      setTimeout(() => setIsDownloadingInvoice(false), 500);
    }
  };

  const handleStickyBarAction = () => {
    if (step === 'cart') {
      setStep('delivery');
      scrollToTop();
      return;
    }
    if (step === 'delivery') {
      handleProceedToPayment();
      return;
    }
    if (step === 'payment') {
      if (paymentMethod === 'online_upi') {
        setUpiConfirmSignal((s) => s + 1);
      } else if (paymentMethod === 'cod') {
        processCODPayment();
      } else {
        processCardPayment();
      }
    }
  };

  const formatCardNumber = (value: string) =>
    value.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19);

  const formatExpiryDate = (value: string) =>
    value.replace(/\D/g, '').replace(/^(\d{2})(\d)/, '$1/$2').slice(0, 5);

  // --- ORDER CONFIRMED RECEIPT VIEW ---
  if (orderComplete && completedSnapshot) {
    return (
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="max-w-2xl mx-auto"
      >
        <div className="rounded-2xl border border-emerald-200 bg-white p-5 sm:p-8 shadow-sm space-y-6">
          <div className="text-center space-y-2 border-b border-slate-100 pb-6">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle className="w-8 h-8" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              {transactionData?.status || 'Order Confirmed'}
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Thank you, {completedSnapshot.customer.name.split(' ')[0]}!
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Order <span className="font-mono font-bold text-slate-800">{completedSnapshot.orderId}</span> is confirmed and queued for dispatch.
            </p>
          </div>

          {/* Primary Actions: Download Tax Invoice PDF + Track Order */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleDownloadInvoice}
              disabled={isDownloadingInvoice}
              className="min-h-[48px] rounded-xl bg-slate-900 hover:bg-indigo-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
            >
              <FileDown className="w-4 h-4" />
              <span>{isDownloadingInvoice ? 'Preparing PDF...' : 'Download Tax Invoice (PDF)'}</span>
            </button>

            <Link
              href={`/track-order?orderId=${encodeURIComponent(completedSnapshot.orderId)}`}
              className="min-h-[48px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Package className="w-4 h-4" />
              <span>Track Order Live</span>
            </Link>
          </div>

          {/* Itemized Receipt Breakdown */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 text-xs sm:text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Order Reference</span>
              <span className="font-mono font-bold text-slate-900">{completedSnapshot.orderId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Method</span>
              <span className="font-semibold text-slate-900">{completedSnapshot.paymentMethod}</span>
            </div>
            {completedSnapshot.utrNumber && completedSnapshot.utrNumber !== 'N/A' && (
              <div className="flex justify-between">
                <span className="text-slate-500">UTR / UPI Reference</span>
                <span className="font-mono font-bold text-emerald-700">{completedSnapshot.utrNumber}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Delivery Address</span>
              <span className="font-medium text-slate-800 text-right max-w-[60%]">
                {completedSnapshot.customer.address}, {completedSnapshot.customer.pincode}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Estimated Delivery</span>
              <span className="font-semibold text-indigo-700">{completedSnapshot.estimatedDelivery}</span>
            </div>

            <div className="border-t border-slate-200 pt-3 space-y-2">
              {completedSnapshot.items.map((item, idx) => (
                <div key={`${item.id}-${idx}`} className="flex justify-between gap-2 text-xs">
                  <span className="text-slate-700">
                    {item.name} (UK {item.selectedSize || 8}) × {item.quantity}
                  </span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0">
                    ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
              <span className="font-bold text-slate-900">Grand Total (incl. 18% GST)</span>
              <span className="text-lg font-extrabold text-emerald-700 font-mono tabular-nums">
                ₹{completedSnapshot.totalAmount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* WhatsApp Support & Continue Shopping */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <a
              href={`https://wa.me/91${MERCHANT_PHONE}?text=${encodeURIComponent(
                `Hi StepStyle, Order #${completedSnapshot.orderId} for ₹${completedSnapshot.totalAmount} via ${completedSnapshot.paymentMethod} is placed.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Share Receipt on WhatsApp</span>
            </a>

            <Link
              href="/products"
              className="min-h-[44px] rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Continue Shopping</span>
            </Link>
          </div>
        </div>
      </motion.div>
    );
  }

  // --- EMPTY CART VIEW ---
  if (items.length === 0) {
    return (
      <div className="py-10 sm:py-16 text-center max-w-md mx-auto">
        <div className="mb-5 flex justify-center">
          <Image
            src="/images/Empty-cart.jpg"
            alt="Empty shopping cart"
            width={180}
            height={180}
            className="object-contain max-w-[140px] sm:max-w-[180px]"
          />
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-slate-900">Your bag is empty</h2>
        <p className="mt-1 mb-6 text-sm text-slate-500">
          Explore ready-to-ship running, casual, and sports pairs to get started.
        </p>
        <Link
          href="/products"
          className="inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-slate-900 hover:bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition-colors"
        >
          <span>Browse Shoes</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  const steps: Array<{ id: CheckoutStep; num: number; label: string }> = [
    { id: 'cart', num: 1, label: 'Review Cart' },
    { id: 'delivery', num: 2, label: 'Delivery' },
    { id: 'payment', num: 3, label: 'Payment' },
  ];

  const activeStepIndex = steps.findIndex((s) => s.id === step);

  // Shared Price & GST Breakdown Card (used inline on mobile step 1 and sticky right on desktop)
  const renderPriceDetailsCard = (compact = false) => (
    <div
      id="price-details-card"
      className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3.5 scroll-mt-20"
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
          Price Details
        </h2>
        <span className="text-xs font-medium text-slate-500 tabular-nums">
          {billing.itemCount} {billing.itemCount === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* Free Shipping Progress Hint */}
      {billing.freeShippingGap > 0 ? (
        <div className="rounded-xl bg-indigo-50/70 border border-indigo-100 px-3 py-2 text-xs text-indigo-800 flex items-center justify-between gap-2">
          <span>
            Add <strong className="font-mono tabular-nums">₹{billing.freeShippingGap.toLocaleString('en-IN')}</strong> more for FREE delivery
          </span>
          <Link href="/products" className="font-bold underline shrink-0">
            Add
          </Link>
        </div>
      ) : (
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <Truck className="w-4 h-4 shrink-0" />
          <span>Unlocked FREE Express Shipping</span>
        </div>
      )}

      {/* Itemized Rows */}
      <div className="space-y-2.5 text-sm tabular-nums">
        <div className="flex justify-between text-slate-600">
          <span>Total MRP</span>
          <span className="font-mono font-medium text-slate-900">
            ₹{billing.totalMrp.toLocaleString('en-IN')}
          </span>
        </div>

        {billing.discountSavings > 0 && (
          <div className="flex justify-between text-emerald-700">
            <span>Discount on MRP</span>
            <span className="font-mono font-bold">
              -₹{billing.discountSavings.toLocaleString('en-IN')}
            </span>
          </div>
        )}

        <div className="flex justify-between text-slate-600">
          <span>Shipping Fee</span>
          {billing.shippingFee === 0 ? (
            <span className="font-bold text-emerald-700">FREE</span>
          ) : (
            <span className="font-mono font-medium text-slate-900">
              ₹{billing.shippingFee.toLocaleString('en-IN')}
            </span>
          )}
        </div>

        {/* Collapsible GST Breakdown */}
        <div className="pt-1 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowGstDetails((prev) => !prev)}
            className="w-full flex items-center justify-between py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <span>GST Breakdown (18% included)</span>
            <span className="inline-flex items-center gap-1 font-mono">
              ₹{billing.totalGst.toLocaleString('en-IN')}
              {showGstDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </span>
          </button>

          {showGstDetails && (
            <div className="mt-1.5 rounded-xl bg-slate-50 border border-slate-100 p-2.5 space-y-1 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Taxable Value</span>
                <span className="font-mono">₹{billing.taxableValue.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span>CGST (9.0%)</span>
                <span className="font-mono">₹{billing.cgst.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span>SGST (9.0%)</span>
                <span className="font-mono">₹{billing.sgst.toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grand Total Row */}
      <div className="border-t border-slate-200 pt-3 flex items-baseline justify-between">
        <div>
          <span className="text-base font-extrabold text-slate-900 block">Total Payable</span>
          {billing.discountSavings > 0 && (
            <span className="text-[11px] font-semibold text-emerald-700 tabular-nums">
              You save ₹{billing.discountSavings.toLocaleString('en-IN')} on this order
            </span>
          )}
        </div>
        <span className="text-xl sm:text-2xl font-extrabold text-slate-900 font-mono tabular-nums">
          ₹{billing.grandTotal.toLocaleString('en-IN')}
        </span>
      </div>

      {/* Desktop Primary Step Action (hidden on mobile because Sticky Payable Bar handles mobile) */}
      {!compact && step !== 'payment' && (
        <div className="hidden lg:block pt-2">
          {step === 'cart' ? (
            <button
              type="button"
              onClick={() => {
                setStep('delivery');
                scrollToTop();
              }}
              className="w-full min-h-[48px] rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Continue to Delivery</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : isAuthenticated ? (
            <button
              type="button"
              onClick={handleProceedToPayment}
              className="w-full min-h-[48px] rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Proceed to Payment</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      )}

      <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>100% Authentic Footwear · Instant GST Tax Invoice</span>
      </div>
    </div>
  );

  return (
    <div className="pb-24 lg:pb-6 space-y-5">
      {/* Guided 3-Step Stepper */}
      <nav
        aria-label="Checkout progress"
        className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 sm:px-5 sm:py-3"
      >
        <ol className="grid grid-cols-3 gap-2">
          {steps.map((s, idx) => {
            const isCurrent = step === s.id;
            const isCompleted = idx < activeStepIndex;
            const canClick = idx <= activeStepIndex;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={!canClick}
                  onClick={() => {
                    if (canClick) {
                      setErrorMessage('');
                      setStep(s.id);
                    }
                  }}
                  className={`w-full min-h-[44px] rounded-xl px-2 py-1.5 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold transition-colors ${
                    isCurrent
                      ? 'bg-slate-900 text-white'
                      : isCompleted
                      ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 cursor-pointer'
                      : 'bg-slate-50 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center shrink-0 tabular-nums ${
                      isCurrent
                        ? 'bg-white text-slate-900'
                        : isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {isCompleted ? <Check className="w-3 h-3" /> : s.num}
                  </span>
                  <span className="truncate">{s.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Main Responsive Grid: Guided Active Step Left (7 cols) + Sticky Desktop Summary Right (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-4">
          {/* STEP 1: REVIEW CART */}
          {step === 'cart' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
                {items.map((item, index) => {
                  const imagePath = getImagePath(item);
                  const hasItemMrp = item.mrp && item.mrp > item.price;
                  const itemDiscount = hasItemMrp
                    ? Math.round(((item.mrp! - item.price) / item.mrp!) * 100)
                    : 0;

                  return (
                    <div
                      key={`${item.id}-${item.selectedSize}-${item.selectedColor}-${index}`}
                      className="p-3.5 sm:p-4 flex gap-3.5"
                    >
                      <Link
                        href={`/products/${item.id}`}
                        className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-slate-50 border border-slate-100 shrink-0 overflow-hidden"
                      >
                        <Image
                          src={failedImages[imagePath] ? '/images/Empty-cart.jpg' : imagePath}
                          alt={item.name}
                          fill
                          referrerPolicy="no-referrer"
                          unoptimized={imagePath.startsWith('data:')}
                          className="object-contain p-2"
                          onError={() => setFailedImages((prev) => ({ ...prev, [imagePath]: true }))}
                        />
                      </Link>

                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              href={`/products/${item.id}`}
                              className="text-sm sm:text-base font-bold text-slate-900 hover:text-indigo-600 line-clamp-2 leading-snug"
                            >
                              {item.name}
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item)}
                              aria-label={`Remove ${item.name}`}
                              className="min-w-[44px] min-h-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                            {item.selectedSize && <span>UK {item.selectedSize}</span>}
                            {item.selectedSize && item.selectedColor && <span aria-hidden="true">·</span>}
                            {item.selectedColor && <span>{item.selectedColor}</span>}
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-baseline gap-1.5 tabular-nums">
                            <span className="text-base sm:text-lg font-extrabold text-slate-900 font-mono">
                              ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                            </span>
                            {hasItemMrp && (
                              <span className="text-xs text-slate-400 line-through font-mono">
                                ₹{(item.mrp! * item.quantity).toLocaleString('en-IN')}
                              </span>
                            )}
                            {itemDiscount > 0 && (
                              <span className="text-[11px] font-bold text-emerald-700">
                                {itemDiscount}% off
                              </span>
                            )}
                          </div>

                          <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50">
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(item, item.quantity - 1)}
                              aria-label="Decrease quantity"
                              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-700 hover:text-slate-900 cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center text-sm font-bold text-slate-900 tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(item, item.quantity + 1)}
                              aria-label="Increase quantity"
                              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-700 hover:text-slate-900 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mobile inline Price Details Card on Step 1 */}
              <div className="lg:hidden">{renderPriceDetailsCard(true)}</div>
            </div>
          )}

          {/* STEP 2: DELIVERY DETAILS + AUTH GATE */}
          {step === 'delivery' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 space-y-5">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-extrabold text-slate-900">Delivery Details</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('cart')}
                  className="min-h-[44px] px-2 text-xs sm:text-sm font-bold text-indigo-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Edit Bag</span>
                </button>
              </div>

              {!isAuthenticated ? (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 sm:p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        Sign In Required to Complete Order
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                        Your cart items are saved safely. Sign in with Google or your account to confirm delivery and proceed to payment.
                      </p>
                    </div>
                  </div>
                  <GoogleSignInButton
                    label="Continue with Google"
                    onSuccess={() => {
                      setErrorMessage('');
                      void syncAuthAndUser();
                      toast.success('Signed in with Google!');
                    }}
                    onError={(msg) => setErrorMessage(msg)}
                  />
                  {errorMessage && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-medium text-rose-700">
                      {errorMessage}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <Link
                      href="/auth/login?redirect=/cart?checkout=quick"
                      className="min-h-[48px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Sign In to Checkout</span>
                    </Link>
                    <Link
                      href="/auth/signup?redirect=/cart?checkout=quick"
                      className="min-h-[48px] rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Create Account</span>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label htmlFor="recipient-name" className="block text-xs font-bold text-slate-700 mb-1.5">
                        Recipient Full Name
                      </label>
                      <input
                        id="recipient-name"
                        type="text"
                        autoComplete="name"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="e.g. Rohan Sharma"
                        className="w-full min-h-[44px] px-3.5 py-2 text-base sm:text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label htmlFor="recipient-phone" className="block text-xs font-bold text-slate-700 mb-1.5">
                        10-Digit Mobile Number
                      </label>
                      <input
                        id="recipient-phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="10-digit mobile number"
                        className="w-full min-h-[44px] px-3.5 py-2 text-base sm:text-sm bg-white border border-slate-300 rounded-xl font-mono tabular-nums focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        maxLength={10}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="delivery-address" className="block text-xs font-bold text-slate-700 mb-1.5">
                      Full Delivery Address
                    </label>
                    <textarea
                      id="delivery-address"
                      autoComplete="street-address"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="House / Flat No., Building, Street, Area, Landmark"
                      rows={3}
                      className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="sm:max-w-xs">
                    <label htmlFor="delivery-pincode" className="block text-xs font-bold text-slate-700 mb-1.5">
                      Delivery Pincode
                    </label>
                    <input
                      id="delivery-pincode"
                      type="text"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      value={customerPincode}
                      onChange={(e) => setCustomerPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit pincode"
                      className="w-full min-h-[44px] px-3.5 py-2 text-base sm:text-sm bg-white border border-slate-300 rounded-xl font-mono tabular-nums focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      maxLength={6}
                    />
                  </div>

                  {errorMessage && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs sm:text-sm font-medium text-rose-700">
                      {errorMessage}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleProceedToPayment}
                    className="hidden lg:flex w-full min-h-[48px] rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-sm font-bold items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>Proceed to Payment (₹{billing.grandTotal.toLocaleString('en-IN')})</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: PAYMENT DETAILS & CONFIRMATION */}
          {step === 'payment' && (
            <div className="space-y-4">
              {/* Compact Delivery Summary Strip */}
              <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4 flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <MapPin className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      Delivering to {customerName} · +91 {customerPhone}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {deliveryAddress}, {customerPincode}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('delivery')}
                  className="min-h-[44px] px-3.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 shrink-0 cursor-pointer"
                >
                  Change
                </button>
              </div>

              {/* Payment Method Selector */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                      Choose Payment Method
                    </h2>
                    <p className="text-xs text-slate-500">Order Ref: {orderId}</p>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Encrypted</span>
                  </span>
                </div>

                {/* Method 1: UPI & Banking Apps */}
                <div
                  className={`rounded-xl border-2 transition-colors ${
                    paymentMethod === 'online_upi'
                      ? 'border-indigo-600 bg-white'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <label className="flex items-center justify-between p-3.5 cursor-pointer min-h-[56px]">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === 'online_upi'}
                        onChange={() => {
                          setPaymentMethod('online_upi');
                          setErrorMessage('');
                          setPaymentStatus('idle');
                        }}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="text-sm font-bold text-slate-900 block">
                          UPI &amp; Banking Apps (GPay, PhonePe, Paytm, QR)
                        </span>
                        <span className="text-xs text-emerald-700 font-medium">
                          Recommended · Instant verification
                        </span>
                      </div>
                    </div>
                  </label>

                  {paymentMethod === 'online_upi' && paymentStatus === 'idle' && (
                    <div className="px-3.5 pb-3.5">
                      <OnlineUPIPayment
                        amount={billing.grandTotal}
                        orderId={orderId}
                        customerName={customerName}
                        customerPhone={customerPhone}
                        deliveryAddress={deliveryAddress}
                        externalConfirmSignal={upiConfirmSignal}
                        onPaymentSuccess={handleOnlineUPISuccess}
                      />
                    </div>
                  )}
                </div>

                {/* Method 2: Cash on Delivery */}
                <div
                  className={`rounded-xl border-2 transition-colors ${
                    paymentMethod === 'cod'
                      ? 'border-indigo-600 bg-white'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <label className="flex items-center justify-between p-3.5 cursor-pointer min-h-[56px]">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === 'cod'}
                        onChange={() => {
                          setPaymentMethod('cod');
                          setErrorMessage('');
                          setPaymentStatus('idle');
                        }}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex items-center gap-2.5">
                        <Banknote className="w-5 h-5 text-amber-600 shrink-0" />
                        <div>
                          <span className="text-sm font-bold text-slate-900 block">
                            Cash on Delivery (COD)
                          </span>
                          <span className="text-xs text-slate-500">
                            Pay cash or scan courier QR at your doorstep
                          </span>
                        </div>
                      </div>
                    </div>
                  </label>

                  {paymentMethod === 'cod' && paymentStatus === 'idle' && (
                    <div className="px-3.5 pb-3.5 space-y-3">
                      <div className="rounded-xl bg-amber-50/80 border border-amber-200 p-3 text-xs text-amber-900">
                        Please keep <strong className="font-mono tabular-nums">₹{billing.grandTotal.toLocaleString('en-IN')}</strong> ready at delivery to <strong>{customerPincode}</strong>.
                      </div>
                      <button
                        type="button"
                        onClick={processCODPayment}
                        className="w-full min-h-[48px] rounded-xl bg-slate-900 hover:bg-indigo-600 text-white font-bold text-sm transition-colors cursor-pointer"
                      >
                        Confirm Cash on Delivery Order
                      </button>
                    </div>
                  )}
                </div>

                {/* Method 3: Credit / Debit Card */}
                <div
                  className={`rounded-xl border-2 transition-colors ${
                    paymentMethod === 'stripe'
                      ? 'border-indigo-600 bg-white'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <label className="flex items-center justify-between p-3.5 cursor-pointer min-h-[56px]">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === 'stripe'}
                        onChange={() => {
                          setPaymentMethod('stripe');
                          setErrorMessage('');
                          setPaymentStatus('idle');
                        }}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex items-center gap-2.5">
                        <CreditCard className="w-5 h-5 text-indigo-600 shrink-0" />
                        <div>
                          <span className="text-sm font-bold text-slate-900 block">
                            Credit / Debit Card
                          </span>
                          <span className="text-xs text-slate-500">Visa · Mastercard · RuPay · Amex</span>
                        </div>
                      </div>
                    </div>
                  </label>

                  {paymentMethod === 'stripe' && paymentStatus === 'idle' && (
                    <div className="px-3.5 pb-3.5 space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Card Number</label>
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={cardDetails.cardNumber}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^\d\s]/g, '');
                              if (value.replace(/\s/g, '').length <= 16) {
                                setCardDetails({ ...cardDetails, cardNumber: formatCardNumber(value) });
                              }
                            }}
                            placeholder="XXXX XXXX XXXX XXXX"
                            className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-base sm:text-sm pr-24 font-mono tabular-nums focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            maxLength={19}
                          />
                          {cardNetwork && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-600">
                              {cardNetwork}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Expiry (MM/YY)</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={cardDetails.expiryDate}
                            onChange={(e) =>
                              setCardDetails({ ...cardDetails, expiryDate: formatExpiryDate(e.target.value) })
                            }
                            placeholder="MM/YY"
                            className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-base sm:text-sm font-mono tabular-nums focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            maxLength={5}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">CVV</label>
                          <input
                            type="password"
                            inputMode="numeric"
                            value={cardDetails.cvv}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              if (value.length <= 4) {
                                setCardDetails({ ...cardDetails, cvv: value });
                              }
                            }}
                            placeholder="•••"
                            className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-base sm:text-sm font-mono tabular-nums focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            maxLength={4}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Cardholder Name</label>
                        <input
                          type="text"
                          value={cardDetails.name}
                          onChange={(e) => setCardDetails({ ...cardDetails, name: e.target.value })}
                          placeholder="Name printed on card"
                          className="w-full min-h-[44px] px-3 py-2 border border-slate-300 rounded-xl text-base sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={processCardPayment}
                        className="w-full min-h-[48px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-colors cursor-pointer"
                      >
                        Pay ₹{billing.grandTotal.toLocaleString('en-IN')} via Card
                      </button>
                    </div>
                  )}
                </div>

                {errorMessage && paymentStatus !== 'processing' && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs sm:text-sm font-medium text-rose-700">
                    {errorMessage}
                  </div>
                )}

                {paymentStatus === 'processing' && (
                  <div className="p-4 border border-indigo-100 bg-indigo-50/70 rounded-xl flex items-center justify-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-600 border-t-transparent" />
                    <p className="text-sm font-bold text-indigo-900">
                      {errorMessage || 'Processing order confirmation...'}
                    </p>
                  </div>
                )}
              </div>

              {/* Mobile Price Details Recap at bottom of Payment Step */}
              <div className="lg:hidden">{renderPriceDetailsCard(true)}</div>
            </div>
          )}
        </div>

        {/* Sticky Desktop Right Sidebar: Itemized Price Details & GST Breakdown */}
        <aside className="hidden lg:block lg:col-span-5 lg:sticky lg:top-24 space-y-4">
          {renderPriceDetailsCard(false)}

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 flex items-center justify-between text-xs text-slate-600">
            <span>Need order assistance?</span>
            <a
              href={`tel:+91${MERCHANT_PHONE}`}
              className="font-bold text-slate-900 hover:text-indigo-600 inline-flex items-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>+91 {MERCHANT_PHONE}</span>
            </a>
          </div>
        </aside>
      </div>

      {/* MOBILE & TABLET STICKY BOTTOM PAYABLE BAR (replaces global tab bar on /cart so aggregate sticky height <= 15%) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2.5 pb-safe shadow-[0_-4px_20px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between gap-3 max-w-3xl mx-auto">
          <button
            type="button"
            onClick={() => {
              setShowGstDetails(true);
              const el = document.getElementById('price-details-card');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              else setStep('cart');
            }}
            className="text-left min-h-[44px] flex flex-col justify-center cursor-pointer"
          >
            <span className="text-[11px] font-medium text-slate-500 leading-none">
              Total Payable
            </span>
            <span className="text-lg font-extrabold text-slate-900 font-mono tabular-nums leading-tight mt-0.5">
              ₹{billing.grandTotal.toLocaleString('en-IN')}
            </span>
          </button>

          {step === 'delivery' && !isAuthenticated ? (
            <Link
              href="/auth/login?redirect=/cart?checkout=quick"
              className="flex-1 max-w-[220px] min-h-[48px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In to Pay</span>
            </Link>
          ) : (
            <button
              type="button"
              disabled={paymentStatus === 'processing'}
              onClick={handleStickyBarAction}
              className="flex-1 max-w-[230px] min-h-[48px] rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-sm font-bold flex items-center justify-center gap-1.5 px-4 transition-colors active:scale-[0.98] disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              <span>
                {step === 'cart'
                  ? 'Continue to Delivery'
                  : step === 'delivery'
                  ? 'Proceed to Payment'
                  : paymentMethod === 'online_upi'
                  ? `I Have Paid ₹${billing.grandTotal.toLocaleString('en-IN')}`
                  : paymentMethod === 'cod'
                  ? 'Confirm COD Order'
                  : `Pay ₹${billing.grandTotal.toLocaleString('en-IN')}`}
              </span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
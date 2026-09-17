'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CartItem } from '@/app/cart/page';
import OnlineUPIPayment from '@/components/OnlineUPIPayment';
import { Smartphone, QrCode, CreditCard, Banknote, CheckCircle, MessageCircle, Phone, Truck, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

// Helper function to trigger cart update notification
const notifyCartUpdated = () => {
  // Dispatch a custom event that the navbar can listen for
  window.dispatchEvent(new Event('cartUpdated'));
};

export default function CartItems() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [subtotal, setSubtotal] = useState(0);
  const shipping = 499;
  const [paymentMethod, setPaymentMethod] = useState<string>('online_upi');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');
  const [cardDetails, setCardDetails] = useState({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    name: ''
  });
  const [gPayLoading, setGPayLoading] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  
  // Customer details for delivery
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [customerPincode, setCustomerPincode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // User's specified Merchant UPI ID and Contact Number
  const MERCHANT_UPI_ID = "soyxbshxikh-1@okaxis";
  const MERCHANT_PHONE = "8830422747";
  // Order ID for transaction reference
  const [orderId, setOrderId] = useState<string>("");
  // Card networks for validating card number
  const [cardNetwork, setCardNetwork] = useState<string>("");
  // Transaction data for receipt
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

  // Calculate subtotal from cart items
  const calculateTotals = (cartItems: CartItem[]) => {
    const total = cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity, 
      0
    );
    setSubtotal(total);
  };

  // Load cart items from localStorage when component mounts
  useEffect(() => {
    const loadCartItems = () => {
      try {
        const storedItems = localStorage.getItem('cartItems');
        if (storedItems) {
          const items = JSON.parse(storedItems);
          setItems(items);
          calculateTotals(items);
        }
      } catch (error) {
        // Remove console.error for production
        // console.error('Error loading cart items:', error);
      }
    };

    loadCartItems();
    
    // Auto-fill customer details from authUser if logged in
    try {
      const storedUser = localStorage.getItem('authUser') || localStorage.getItem('user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed.name) setCustomerName(parsed.name);
        if (parsed.phone) setCustomerPhone(parsed.phone);
        if (parsed.address) setDeliveryAddress(parsed.address);
        if (parsed.pincode) setCustomerPincode(parsed.pincode);
      }
    } catch (e) {
      // ignore
    }

    // Add event listener for storage events from other tabs
    window.addEventListener('storage', loadCartItems);
    
    return () => {
      window.removeEventListener('storage', loadCartItems);
    };
  }, []);

  // Generate a unique order ID
  useEffect(() => {
    if (!orderId) {
      // Generate a random order ID with format STEP-XXXX-XXXX
      const newOrderId = `STEP-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
      setOrderId(newOrderId);
    }
  }, [orderId]);

  // Detect card network based on card number
  useEffect(() => {
    const cardNum = cardDetails.cardNumber.replace(/\s/g, '');
    
    if (cardNum.startsWith('4')) {
      setCardNetwork('Visa');
    } else if (/^5[1-5]/.test(cardNum)) {
      setCardNetwork('Mastercard');
    } else if (/^3[47]/.test(cardNum)) {
      setCardNetwork('American Express');
    } else if (/^6(?:011|5)/.test(cardNum)) {
      setCardNetwork('Discover');
    } else if (cardNum.length > 6) {
      setCardNetwork('Unknown');
    } else {
      setCardNetwork('');
    }
  }, [cardDetails.cardNumber]);

  // Get the correct image path based on product ID
  const getImagePath = (item: CartItem) => {
    // If direct uploads or full URL, return directly
    if (
      item.imagePath &&
      (item.imagePath.startsWith('/uploads/') ||
        item.imagePath.startsWith('http') ||
        item.imagePath.startsWith('data:') ||
        /\.(jpg|jpeg|png|webp|svg)$/i.test(item.imagePath))
    ) {
      return item.imagePath;
    }

    // Define the mapping of product IDs to file formats
    const productFormats: Record<number, string> = {
      1: '.jpeg',
      2: '.webp',
      3: '.webp',
      4: '.webp',
      5: '.webp',
      6: '.webp',
      7: '.webp',
      8: '.webp',
      9: '.webp',
      10: '.jpg',
      11: '.jpg',
      12: '.jpg',
      13: '.jpg',
      14: '.jpg',
      15: '.jpg',
      16: '.jpeg',
      17: '.png',
      18: '.jpg',
      19: '.jpeg',
      20: '.png',
    };
    
    // Get the format for the current product or use default
    const format = productFormats[item.id] || '.jpg';
    
    return `${item.imagePath}/HomeProduct${format}`;
  };

  const handleImageError = (imagePath: string) => {
    setFailedImages(prev => ({ ...prev, [imagePath]: true }));
  };

  const handleRemoveItem = (itemToRemove: CartItem) => {
    // Remove the item from the cart
    const updatedItems = items.filter(item => 
      !(item.id === itemToRemove.id && 
        item.selectedSize === itemToRemove.selectedSize)
    );
    
    // Update localStorage
    localStorage.setItem('cartItems', JSON.stringify(updatedItems));
    
    // Update state
    setItems(updatedItems);
    setSubtotal(updatedItems.reduce(
      (sum, item) => sum + item.price * item.quantity, 
      0
    ));

    // Notify about cart update
    notifyCartUpdated();
  };

  const handleQuantityChange = (itemToUpdate: CartItem, newQuantity: number) => {
    if (newQuantity < 1) {
      return handleRemoveItem(itemToUpdate);
    }
    
    // Update the quantity
    const updatedItems = items.map(item => {
      if (item.id === itemToUpdate.id && 
          item.selectedSize === itemToUpdate.selectedSize) {
        return { ...item, quantity: newQuantity };
      }
      return item;
    });
    
    // Update localStorage
    localStorage.setItem('cartItems', JSON.stringify(updatedItems));
    
    // Update state
    setItems(updatedItems);
    setSubtotal(updatedItems.reduce(
      (sum, item) => sum + item.price * item.quantity, 
      0
    ));

    // Notify about cart update
    notifyCartUpdated();
  };

  // Payment method handlers
  const handlePaymentMethodChange = (method: string) => {
    setPaymentMethod(method);
    
    // Reset error message when changing payment method
    setErrorMessage('');
    
    // Reset payment status
    setPaymentStatus('idle');
  };

  // Validate card details with enhanced validation
  const validateCardDetails = () => {
    const { cardNumber, expiryDate, cvv, name } = cardDetails;
    
    // Check card number format and length
    const cardNumberClean = cardNumber.replace(/\s/g, '');
    if (cardNumberClean.length < 15 || cardNumberClean.length > 16) {
      setErrorMessage('Please enter a valid card number');
      return false;
    }
    
    // Check if card is expired
    if (expiryDate.length < 5) {
      setErrorMessage('Please enter a valid expiry date (MM/YY)');
      return false;
    } else {
      const [month, year] = expiryDate.split('/');
      const expiryMonth = parseInt(month, 10);
      const expiryYear = parseInt(`20${year}`, 10);
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      
      if (expiryYear < currentYear || (expiryYear === currentYear && expiryMonth < currentMonth)) {
        setErrorMessage('Your card has expired');
        return false;
      }
      
      if (expiryMonth < 1 || expiryMonth > 12) {
        setErrorMessage('Invalid expiry month');
        return false;
      }
    }
    
    // Validate CVV length based on card type
    if (cardNetwork === 'American Express' && cvv.length !== 4) {
      setErrorMessage('American Express cards require a 4-digit CVV');
      return false;
    } else if (cardNetwork !== 'American Express' && cvv.length !== 3) {
      setErrorMessage('Please enter a valid 3-digit CVV');
      return false;
    }
    
    // Validate name
    if (name.length < 3) {
      setErrorMessage('Please enter the cardholder name');
      return false;
    }
    
    return true;
  };

  // Card-specific payment processing with enhanced visual feedback
  const processCardPayment = () => {
    if (!validateCardDetails()) return;
    
    setPaymentStatus('processing');
    setErrorMessage(`Processing ${cardNetwork} ending in ${cardDetails.cardNumber.slice(-4)}...`);
    
    // Transaction timestamp
    const timestamp = new Date().toISOString();
    
    // Create transaction ID with card format
    const txnId = `CRD${Math.floor(100000000 + Math.random() * 900000000)}`;
    
    // Process payment in stages
    setTimeout(() => {
      setErrorMessage('Verifying card details...');
      
      setTimeout(() => {
        setErrorMessage('Authorizing payment...');
        
        setTimeout(() => {
          // 95% success rate for simulation
          const isSuccess = Math.random() < 0.95;
          
          if (isSuccess) {
            setPaymentStatus('success');
            setErrorMessage('');
            
            // Update transaction data
            setTransactionData({
              id: txnId,
              amount: subtotal + shipping,
              timestamp: timestamp,
              method: `${cardNetwork} Card (****${cardDetails.cardNumber.slice(-4)})`,
              status: 'successful'
            });
            
            setTimeout(() => {
              setOrderComplete(true);
              // Clear cart
              localStorage.setItem('cartItems', JSON.stringify([]));
              notifyCartUpdated();
            }, 1500);
          } else {
            setPaymentStatus('failed');
            
            // Update transaction data
            setTransactionData({
              id: txnId,
              amount: subtotal + shipping,
              timestamp: timestamp,
              method: `${cardNetwork} Card (****${cardDetails.cardNumber.slice(-4)})`,
              status: 'failed'
            });
            
            // More specific error for card failures
            if (Math.random() > 0.5) {
              setErrorMessage(`${cardNetwork} declined. Please check your details or try another payment method.`);
            } else {
              setErrorMessage('Payment gateway error. Please try again later.');
            }
          }
        }, 600);
      }, 800);
    }, 600);
  };

  // Google Pay specific processing with enhanced app simulation
  const processGooglePayment = () => {
    setGPayLoading(true);
    setErrorMessage('Connecting to Mobile Wallet...');
    
    // Simulate Google Pay opening
    setTimeout(() => {
      setGPayLoading(false);
      setPaymentStatus('processing');
      setErrorMessage(`Opening secure payment window...`);
      
      // Transaction timestamp
      const timestamp = new Date().toISOString();
      
      // Create transaction ID with GPay format
      const txnId = `GPAY${Math.floor(100000000 + Math.random() * 900000000)}`;
      
      setTimeout(() => {
        setErrorMessage(`Authorizing transfer of ₹${subtotal + shipping} to ${MERCHANT_UPI_ID}...`);
        
        // Save transaction data
        setTransactionData({
          id: txnId,
          amount: subtotal + shipping,
          timestamp: timestamp,
          method: 'Mobile Wallet',
          status: 'processing'
        });
        
        // Simulate slightly faster processing for Google Pay
        setTimeout(() => {
          // Higher success rate for Google Pay (97%)
          const isSuccess = Math.random() < 0.97;
          
          if (isSuccess) {
            setPaymentStatus('success');
            setErrorMessage('');
            
            // Update transaction data
            setTransactionData(prev => {
              if (prev) {
                return {
                  ...prev,
                  status: 'successful'
                };
              }
              return null;
            });
            
            setTimeout(() => {
              setOrderComplete(true);
              // Clear cart
              localStorage.setItem('cartItems', JSON.stringify([]));
              notifyCartUpdated();
            }, 1500);
          } else {
            setPaymentStatus('failed');
            
            // Update transaction data
            setTransactionData(prev => {
              if (prev) {
                return {
                  ...prev,
                  status: 'failed'
                };
              }
              return null;
            });
            
            setErrorMessage('Mobile Wallet transaction failed. The payment app returned an error code. Please try again.');
          }
        }, 1000);
      }, 800);
    }, 1200);
  };

  // Get estimated delivery date (3-7 days from now)
  const getEstimatedDeliveryDate = () => {
    const today = new Date();
    const deliveryDays = 3 + Math.floor(Math.random() * 5); // 3-7 days
    const estimatedDate = new Date(today);
    estimatedDate.setDate(today.getDate() + deliveryDays);
    return estimatedDate.toLocaleDateString('en-IN', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Cash on Delivery processing with enhanced verification
  const processCODPayment = () => {
    if (!deliveryAddress.trim()) {
      setErrorMessage('Please enter your delivery address');
      return;
    }
    
    // Check for basic address validity
    if (deliveryAddress.length < 10) {
      setErrorMessage('Please enter a complete delivery address');
      return;
    }
    
    // Check if address contains a pincode (6 digits)
    const pincodeMatch = deliveryAddress.match(/\b\d{6}\b/);
    if (!pincodeMatch) {
      setErrorMessage('Please include a valid 6-digit pincode in your address');
      return;
    }
    
    setPaymentStatus('processing');
    setErrorMessage('Verifying delivery address...');
    
    // Create transaction ID for COD with format
    const txnId = `COD${Math.floor(100000000 + Math.random() * 900000000)}`;
    
    // Save transaction data
    setTransactionData({
      id: txnId,
      amount: subtotal + shipping,
      timestamp: new Date().toISOString(),
      method: 'Cash on Delivery',
      status: 'processing'
    });
    
    // Simulate address verification
    setTimeout(() => {
      setErrorMessage('Checking delivery availability...');
      
      // Extract pincode for simulated availability check
      const pincode = pincodeMatch[0];
      
      setTimeout(() => {
        setErrorMessage('Placing order...');
        
        // COD processing is slightly faster
        setTimeout(() => {
          // Very high success rate for COD (99%)
          const isSuccess = Math.random() < 0.99;
          
          if (isSuccess) {
            setPaymentStatus('success');
            setErrorMessage('');
            
            // Update transaction data
            setTransactionData(prev => {
              if (prev) {
                return {
                  ...prev,
                  status: 'confirmed',
                  extraInfo: {
                    pincode,
                    estimatedDelivery: getEstimatedDeliveryDate()
                  }
                };
              }
              return null;
            });
            
            setTimeout(() => {
              setOrderComplete(true);
              // Clear cart
              localStorage.setItem('cartItems', JSON.stringify([]));
              notifyCartUpdated();
            }, 1500);
          } else {
            setPaymentStatus('failed');
            
            // Update transaction data
            setTransactionData(prev => {
              if (prev) {
                return {
                  ...prev,
                  status: 'failed'
                };
              }
              return null;
            });
            
            setErrorMessage('Unable to place a Cash on Delivery order for your address. Please verify your address or try a different payment method.');
          }
        }, 600);
      }, 800);
    }, 800);
  };

  // Real UPI & Banking Apps payment success handler
  const handleOnlineUPISuccess = (details: {
    transactionId: string;
    utrNumber?: string;
    paymentApp: string;
    amount: number;
    timestamp: string;
  }) => {
    const estDelivery = getEstimatedDeliveryDate();
    
    const txn = {
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
      }
    };
    
    setTransactionData(txn);
    setPaymentStatus('success');
    setErrorMessage('');
    
    // Save to persistent orders history in localStorage
    try {
      const existingOrders = JSON.parse(localStorage.getItem('orders') || '[]');
      const newOrder = {
        orderId: orderId,
        date: details.timestamp,
        items: items,
        totalAmount: details.amount,
        paymentStatus: 'PAID',
        paymentMethod: details.paymentApp,
        transactionId: details.transactionId,
        utrNumber: details.utrNumber || 'N/A',
        paidToUPI: MERCHANT_UPI_ID,
        customer: {
          name: customerName || 'Customer',
          phone: customerPhone || 'N/A',
          address: deliveryAddress || 'N/A',
          pincode: customerPincode || 'N/A',
        },
        estimatedDelivery: estDelivery,
      };
      existingOrders.unshift(newOrder);
      localStorage.setItem('orders', JSON.stringify(existingOrders));
    } catch (e) {
      // ignore
    }

    setTimeout(() => {
      setOrderComplete(true);
      localStorage.setItem('cartItems', JSON.stringify([]));
      notifyCartUpdated();
    }, 600);
  };

  // Update handleCheckout to use specific payment methods
  const handleCheckout = () => {
    // If an order is already complete, reset the cart
    if (orderComplete) {
      setItems([]);
      setOrderComplete(false);
      setPaymentStatus('idle');
      return;
    }
    
    // Reset any previous errors
    setErrorMessage('');
    
    // Handle different payment methods
    switch(paymentMethod) {
      case 'online_upi':
      case 'gpay':
        // For UPI / Online Banking Apps
        if (paymentStatus === 'idle') {
          // If customer hasn't completed via OnlineUPIPayment button, launch generic UPI intent
          const genericUpiUri = `upi://pay?pa=${encodeURIComponent(MERCHANT_UPI_ID)}&pn=${encodeURIComponent(
            'StepStyle Footwear'
          )}&am=${(subtotal + shipping).toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Order ${orderId}`)}`;
          
          try {
            window.location.href = genericUpiUri;
          } catch (e) {
            // fallback
          }
          toast('Please complete payment on your banking app, then click "I Have Paid" to confirm.', {
            icon: '📲',
          });
        }
        break;

      case 'stripe':
        // For credit card payments
        if (paymentStatus === 'idle') {
          processCardPayment();
        }
        break;
        
      case 'cod':
        if (paymentStatus === 'idle') {
          processCODPayment();
        }
        break;
        
      default:
        setErrorMessage('Please select a payment method');
    }
  };

  // Reset payment form
  const resetPaymentStatus = () => {
    setPaymentStatus('idle');
    setErrorMessage('');
  };

  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    return value
      .replace(/\s/g, '')
      .replace(/(.{4})/g, '$1 ')
      .trim()
      .slice(0, 19);
  };

  // Format expiry date
  const formatExpiryDate = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/, '$1/$2')
      .slice(0, 5);
  };

  // If cart is empty, show empty state
  if (items.length === 0) {
    return (
      <div className="mt-4 sm:mt-8 text-center">
        <div className="mb-4 sm:mb-6 flex justify-center">
          <Image 
            src="/images/Empty-cart.jpg" 
            alt="Empty cart" 
            width={200} 
            height={200} 
            className="object-contain max-w-[150px] sm:max-w-[200px]" 
          />
        </div>
        <p className="mb-3 sm:mb-4 text-base sm:text-lg text-gray-600">Your cart is empty</p>
        <Link 
          href="/products" 
          className="rounded-full bg-black px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-medium text-white transition-opacity hover:opacity-90"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="rounded-lg border border-gray-200 bg-white">
          {items.map((item, index) => {
            const imagePath = getImagePath(item);
            
            return (
              <div key={`${item.id}-${item.selectedSize}-${index}`} className="flex flex-col border-b border-gray-200 p-4 last:border-b-0 sm:flex-row">
                <div className="relative mb-4 h-32 w-32 flex-shrink-0 sm:mb-0">
                  <Image 
                    src={failedImages[imagePath] ? '/images/Empty-cart.jpg' : imagePath}
                    alt={item.name} 
                    fill 
                    className="object-contain"
                    onError={() => handleImageError(imagePath)}
                  />
                </div>
                <div className="flex flex-1 flex-col sm:ml-4">
                  <div className="mb-2 flex justify-between">
                    <h3 className="text-lg font-medium">{item.name}</h3>
                    <span className="font-bold">₹{item.price}</span>
                  </div>
                  <div className="mb-2 text-sm text-gray-600">
                    {item.selectedSize && <span>Size: {item.selectedSize}</span>}
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    <div className="flex items-center border border-gray-300 rounded-md">
                      <button 
                        className="px-3 py-1 text-gray-500 hover:bg-gray-100"
                        onClick={() => handleQuantityChange(item, item.quantity - 1)}
                      >
                        -
                      </button>
                      <span className="px-3 py-1">{item.quantity}</span>
                      <button 
                        className="px-3 py-1 text-gray-500 hover:bg-gray-100"
                        onClick={() => handleQuantityChange(item, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <button 
                      className="text-sm text-red-500 hover:text-red-700"
                      onClick={() => handleRemoveItem(item)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-xl font-bold">Order Summary</h2>
        <div className="mb-4 space-y-2">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>₹{subtotal}</span>
          </div>
          <div className="flex justify-between">
            <span>Shipping</span>
            <span>₹{shipping}</span>
          </div>
        </div>
        <div className="mb-6 border-t border-gray-200 pt-4">
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>₹{subtotal + shipping}</span>
          </div>
        </div>
        
        {/* 1. Customer Delivery Details Section */}
        {!orderComplete && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-gray-900">Delivery Information</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Recipient Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit Mobile No."
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  maxLength={10}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Full Delivery Address
              </label>
              <textarea
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="House/Flat No., Street, Area, Landmark"
                rows={2}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Pincode
              </label>
              <input
                type="text"
                value={customerPincode}
                onChange={(e) => setCustomerPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit Pincode"
                className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                maxLength={6}
              />
            </div>
          </div>
        )}

        {/* 2. Payment Methods Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900">Select Payment Method</h3>
            {!orderComplete && (
              <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Encrypted & Verified
              </span>
            )}
          </div>
          
          {!orderComplete && (
            <div className="space-y-3">
              {/* OPTION 1: Online UPI (Google Pay, PhonePe, Paytm, Banking Apps) */}
              <div className={`rounded-xl border-2 transition-all overflow-hidden ${
                paymentMethod === 'online_upi' 
                  ? 'border-indigo-600 bg-indigo-50/10 shadow-sm' 
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}>
                <label className="flex items-center justify-between p-3.5 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <input 
                      type="radio" 
                      name="paymentMethod" 
                      value="online_upi" 
                      checked={paymentMethod === 'online_upi'} 
                      onChange={() => {
                        handlePaymentMethodChange('online_upi');
                        resetPaymentStatus();
                      }} 
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      disabled={paymentStatus === 'processing'}
                    />
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-[11px] shadow-xs">
                        UPI
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-gray-900">
                            UPI & Banking Apps
                          </span>
                          <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10px] font-extrabold text-emerald-800">
                            Instant • Auto-Amount
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 font-medium">
                          Google Pay, PhonePe, Paytm, BHIM, CRED & NetBanking
                        </p>
                      </div>
                    </div>
                  </div>
                </label>

                {/* Live Online UPI & Banking Apps Component */}
                {paymentMethod === 'online_upi' && paymentStatus === 'idle' && (
                  <div className="p-3 pt-0">
                    <OnlineUPIPayment
                      amount={subtotal + shipping}
                      orderId={orderId}
                      customerName={customerName}
                      customerPhone={customerPhone}
                      deliveryAddress={deliveryAddress}
                      onPaymentSuccess={handleOnlineUPISuccess}
                    />
                  </div>
                )}
              </div>

              {/* OPTION 2: Cash on Delivery (COD) */}
              <div className={`rounded-xl border-2 transition-all overflow-hidden ${
                paymentMethod === 'cod' 
                  ? 'border-indigo-600 bg-indigo-50/10 shadow-sm' 
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}>
                <label className="flex items-center justify-between p-3.5 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <input 
                      type="radio" 
                      name="paymentMethod" 
                      value="cod" 
                      checked={paymentMethod === 'cod'} 
                      onChange={() => {
                        handlePaymentMethodChange('cod');
                        resetPaymentStatus();
                      }} 
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      disabled={paymentStatus === 'processing'}
                    />
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
                        <Banknote className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-gray-900">
                          Cash on Delivery (COD)
                        </span>
                        <p className="text-[11px] text-gray-500">
                          Pay cash to courier partner upon delivery
                        </p>
                      </div>
                    </div>
                  </div>
                </label>

                {/* COD Address info */}
                {paymentMethod === 'cod' && paymentStatus === 'idle' && (
                  <div className="p-3 pt-0">
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-2">
                      <p className="text-amber-800 font-medium">
                        Please ensure someone is available at the delivery address with exact change of <strong>₹{subtotal + shipping}</strong>.
                      </p>
                      <button
                        type="button"
                        onClick={processCODPayment}
                        className="w-full min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-sm transition-all"
                      >
                        Confirm Cash on Delivery Order
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* OPTION 3: Credit / Debit Card */}
              <div className={`rounded-xl border-2 transition-all overflow-hidden ${
                paymentMethod === 'stripe' 
                  ? 'border-indigo-600 bg-indigo-50/10 shadow-sm' 
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}>
                <label className="flex items-center justify-between p-3.5 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <input 
                      type="radio" 
                      name="paymentMethod" 
                      value="stripe" 
                      checked={paymentMethod === 'stripe'} 
                      onChange={() => {
                        handlePaymentMethodChange('stripe');
                        resetPaymentStatus();
                      }} 
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      disabled={paymentStatus === 'processing'}
                    />
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-gray-900">
                          Credit / Debit Card
                        </span>
                        <p className="text-[11px] text-gray-500">
                          Visa, Mastercard, RuPay, Amex
                        </p>
                      </div>
                    </div>
                  </div>
                </label>
                
                {/* Stripe Card Form */}
                {paymentMethod === 'stripe' && paymentStatus === 'idle' && (
                  <div className="p-3 pt-0 space-y-3">
                    <div className="p-3 border border-gray-200 rounded-xl space-y-3 bg-white">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Card Number</label>
                        <div className="relative">
                          <input 
                            type="text" 
                            name="cardNumber" 
                            value={cardDetails.cardNumber}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^\d\s]/g, '');
                              if (value.replace(/\s/g, '').length <= 16) {
                                setCardDetails({...cardDetails, cardNumber: formatCardNumber(value)});
                              }
                            }}
                            placeholder="XXXX XXXX XXXX XXXX"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm pr-10 font-mono"
                            maxLength={19}
                          />
                          {cardNetwork && (
                            <div className="absolute right-3 top-2 text-xs font-bold text-indigo-600">
                              {cardNetwork}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Expiry Date</label>
                          <input 
                            type="text" 
                            name="expiryDate" 
                            value={cardDetails.expiryDate}
                            onChange={(e) => {
                              const value = e.target.value;
                              setCardDetails({...cardDetails, expiryDate: formatExpiryDate(value)});
                            }}
                            placeholder="MM/YY"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                            maxLength={5}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">CVV</label>
                          <input 
                            type="password" 
                            name="cvv" 
                            value={cardDetails.cvv}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              if (value.length <= 4) {
                                setCardDetails({...cardDetails, cvv: value});
                              }
                            }}
                            placeholder="•••"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                            maxLength={4}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Cardholder Name</label>
                        <input 
                          type="text" 
                          name="name" 
                          value={cardDetails.name}
                          onChange={(e) => setCardDetails({...cardDetails, name: e.target.value})}
                          placeholder="Name as printed on card"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={processCardPayment}
                        className="w-full min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm transition-all"
                      >
                        Pay ₹{subtotal + shipping} via Card
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Error Message */}
          {errorMessage && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
              <span className="font-bold">Notice:</span> {errorMessage}
            </div>
          )}
          
          {/* Payment Processing Status */}
          {paymentStatus === 'processing' && (
            <div className="mt-4 p-4 border border-blue-100 bg-blue-50/80 rounded-2xl">
              <div className="flex items-center justify-center space-x-3 mb-2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-600 border-t-transparent"></div>
                <p className="text-sm font-bold text-indigo-900">Processing payment verification...</p>
              </div>
              <p className="text-xs text-indigo-700 text-center">{errorMessage || 'Connecting to banking server'}</p>
            </div>
          )}
          
          {/* Payment Failed */}
          {paymentStatus === 'failed' && (
            <div className="mt-4 p-4 border border-red-200 bg-red-50 rounded-2xl text-center space-y-2">
              <p className="text-sm font-bold text-red-800">{errorMessage || 'Payment could not be completed.'}</p>
              <button 
                className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                onClick={resetPaymentStatus}
              >
                Try Another Payment Method
              </button>
            </div>
          )}
          
          {/* ORDER COMPLETE SUCCESS RECEIPT */}
          {orderComplete && (
            <div className="mt-4 p-5 border border-emerald-200 bg-gradient-to-b from-emerald-50/80 via-white to-white rounded-2xl shadow-sm space-y-4">
              <div className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-2 shadow-xs">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-black text-gray-900">Order Placed Successfully!</h3>
                <p className="text-xs text-gray-600 mt-1 max-w-sm">
                  Thank you! Your payment is confirmed and your footwear is being packed for dispatch.
                </p>
              </div>
              
              {transactionData && (
                <div className="bg-white border border-gray-200 rounded-xl p-3.5 text-left text-xs space-y-2 shadow-xs">
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-500 font-medium">Order Number:</span>
                    <span className="font-mono font-bold text-gray-900">{orderId}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-500 font-medium">Total Amount Paid:</span>
                    <span className="font-black text-emerald-700 text-sm">₹{transactionData.amount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-500 font-medium">Payment Mode:</span>
                    <span className="font-bold text-gray-800">{transactionData.method}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-500 font-medium">Beneficiary UPI:</span>
                    <span className="font-mono text-gray-800">{MERCHANT_UPI_ID}</span>
                  </div>
                  {transactionData.utrNumber && (
                    <div className="flex justify-between border-b border-gray-100 pb-2">
                      <span className="text-gray-500 font-medium">UPI Ref / UTR:</span>
                      <span className="font-mono text-emerald-700 font-bold">{transactionData.utrNumber}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-b border-gray-100 pb-2">
                    <span className="text-gray-500 font-medium">Merchant Contact:</span>
                    <span className="font-bold text-gray-800">+91 {MERCHANT_PHONE}</span>
                  </div>
                  {transactionData.extraInfo?.estimatedDelivery && (
                    <div className="pt-1 text-gray-600">
                      <span className="text-gray-500 block">Estimated Delivery:</span>
                      <span className="font-bold text-indigo-700">{transactionData.extraInfo.estimatedDelivery}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons for WhatsApp Screenshot & Support */}
              <div className="space-y-2">
                <a
                  href={`https://wa.me/91${MERCHANT_PHONE}?text=${encodeURIComponent(
                    `Hi StepStyle Footwear, I have placed Order #${orderId} for ₹${transactionData?.amount || subtotal + shipping} via ${transactionData?.method || 'UPI'}. Here is my order confirmation.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Send Receipt on WhatsApp (+91 {MERCHANT_PHONE})</span>
                </a>

                <div className="flex gap-2">
                  <a
                    href={`tel:+91${MERCHANT_PHONE}`}
                    className="flex-1 min-h-[40px] rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Phone className="w-3.5 h-3.5 text-gray-500" />
                    <span>Call Support</span>
                  </a>

                  <Link 
                    href="/products" 
                    className="flex-1 min-h-[40px] rounded-xl bg-black hover:bg-gray-900 text-white font-bold text-xs flex items-center justify-center transition-all"
                  >
                    Continue Shopping
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {!orderComplete && (
          <div className="pt-2">
            <Link 
              href="/products" 
              className="block text-center text-xs text-gray-500 hover:text-black font-medium transition-colors"
            >
              ← Back to Shoe Collection
            </Link>
          </div>
        )}
      </div>
    </div>
  );
} 
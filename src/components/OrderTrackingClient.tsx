'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { toast } from 'react-hot-toast';
import {
  Search,
  Package,
  Truck,
  AlertCircle,
  ShoppingBag,
  ArrowRight,
  CreditCard,
  MapPin,
  X,
  User,
  Lock,
  Bell,
  RotateCcw,
} from 'lucide-react';
import OrderTracker from '@/components/OrderTracker';
import {
  CustomerOrderView,
  formatDateTimeIN,
  mapLegacyStageToStatus,
} from '@/lib/orderTypes';

function normalizeOrderCode(input: string): string {
  return input.trim().replace(/^#+/, '').toUpperCase();
}

function getStoredVerifyHint(orderCode: string): string {
  try {
    const authRaw = localStorage.getItem('authUser');
    if (authRaw) {
      const u = JSON.parse(authRaw);
      if (u?.email) return String(u.email);
      if (u?.phone) return String(u.phone);
    }
    const hintsRaw = localStorage.getItem('orderVerifyHints');
    if (hintsRaw) {
      const hints = JSON.parse(hintsRaw) as Record<string, string>;
      if (hints && hints[orderCode]) return hints[orderCode];
    }
  } catch {
    // ignore storage errors
  }
  return '';
}

export default function OrderTrackingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQueryId = searchParams.get('orderId') || '';

  const [orderIdInput, setOrderIdInput] = useState(initialQueryId);
  const [verifyInput, setVerifyInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [foundOrder, setFoundOrder] = useState<CustomerOrderView | null>(null);
  const [recentOrders, setRecentOrders] = useState<CustomerOrderView[]>([]);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Return request state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  const activeVerifyRef = useRef<string>('');
  const lastStatusRef = useRef<string>('');

  // Load recent orders belonging to the signed-in user / current browser session
  useEffect(() => {
    const loadUserOrders = async () => {
      const mergedMap = new Map<string, CustomerOrderView>();

      try {
        const rawLocal = localStorage.getItem('orders');
        if (rawLocal) {
          const parsed: CustomerOrderView[] = JSON.parse(rawLocal);
          if (Array.isArray(parsed)) {
            parsed.forEach((order) => {
              const code = order?.orderNumber || order?.orderId;
              if (code) mergedMap.set(normalizeOrderCode(code), order);
            });
          }
        }
      } catch {
        // ignore
      }

      try {
        const authUserRaw = localStorage.getItem('authUser');
        if (authUserRaw) {
          const authUser = JSON.parse(authUserRaw);
          if (authUser?.email || authUser?.phone) {
            const params = new URLSearchParams();
            if (authUser.email) params.set('email', authUser.email);
            if (authUser.phone) params.set('phone', authUser.phone);
            const res = await fetch(`/api/orders?${params.toString()}`);
            if (res.ok) {
              const data = await res.json();
              if (data.success && Array.isArray(data.orders)) {
                data.orders.forEach((order: CustomerOrderView) => {
                  const code = order?.orderNumber || order?.orderId;
                  if (code) mergedMap.set(normalizeOrderCode(code), order);
                });
              }
            }
          }
        }
      } catch {
        // ignore
      }

      const combined = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setRecentOrders(combined);
    };

    loadUserOrders();
  }, []);

  const lookupOrder = useCallback(
    async (
      rawId: string,
      options?: { updateUrl?: boolean; verifyOverride?: string; silent?: boolean }
    ) => {
      const normalized = normalizeOrderCode(rawId);
      if (!normalized) {
        setErrorMessage('Please enter an Order Number (e.g. STEP-4829-1034).');
        setFoundOrder(null);
        setHasSearched(false);
        return;
      }

      if (options?.silent) {
        setIsRefreshing(true);
      } else {
        setIsSearching(true);
        setErrorMessage('');
        setHasSearched(true);
      }

      if (options?.updateUrl) {
        router.replace(`/track-order?orderId=${encodeURIComponent(normalized)}`, {
          scroll: false,
        });
      }

      const verifyToken =
        options?.verifyOverride ||
        activeVerifyRef.current ||
        getStoredVerifyHint(normalized);

      try {
        const params = new URLSearchParams({ orderId: normalized });
        if (verifyToken) params.set('verify', verifyToken);

        const response = await fetch(`/api/orders?${params.toString()}`, {
          cache: 'no-store',
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.order) {
            const serverOrder = data.order as CustomerOrderView;
            const prevStatus = lastStatusRef.current;
            if (options?.silent && prevStatus && prevStatus !== serverOrder.status) {
              toast.success(
                `Order ${serverOrder.orderNumber} updated to "${serverOrder.status}"`
              );
            }
            lastStatusRef.current = serverOrder.status;
            if (!serverOrder.piiMasked && verifyToken) {
              activeVerifyRef.current = verifyToken;
            }
            setFoundOrder(serverOrder);
            setErrorMessage('');
            setIsSearching(false);
            setIsRefreshing(false);
            return;
          }
        }

        // Fallback to localStorage only when not silent and server returned 404
        if (!options?.silent) {
          try {
            const localOrdersRaw = localStorage.getItem('orders');
            if (localOrdersRaw) {
              const localOrders: CustomerOrderView[] = JSON.parse(localOrdersRaw);
              if (Array.isArray(localOrders)) {
                const match = localOrders.find(
                  (o) =>
                    (o?.orderNumber || o?.orderId) &&
                    normalizeOrderCode(o.orderNumber || o.orderId) === normalized
                );
                if (match) {
                  lastStatusRef.current = mapLegacyStageToStatus(match);
                  setFoundOrder(match);
                  setIsSearching(false);
                  setIsRefreshing(false);
                  return;
                }
              }
            }
          } catch {
            // ignore
          }

          setFoundOrder(null);
          setErrorMessage(
            `No order found with ID "${normalized}". Please verify your order confirmation receipt and try again.`
          );
        }
      } catch {
        if (!options?.silent) {
          setFoundOrder(null);
          setErrorMessage('Unable to reach order tracking service right now.');
        }
      } finally {
        setIsSearching(false);
        setIsRefreshing(false);
      }
    },
    [router]
  );

  // Initial lookup from URL
  useEffect(() => {
    if (initialQueryId.trim()) {
      setOrderIdInput(initialQueryId);
      lookupOrder(initialQueryId, { updateUrl: false });
    }
  }, [initialQueryId, lookupOrder]);

  // Automatic real-time polling every 8 seconds + visibility focus refresh
  useEffect(() => {
    if (!foundOrder) return;
    const activeCode = foundOrder.orderNumber || foundOrder.orderId;
    if (!activeCode) return;

    const timer = setInterval(() => {
      lookupOrder(activeCode, { updateUrl: false, silent: true });
    }, 8000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        lookupOrder(activeCode, { updateUrl: false, silent: true });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [foundOrder, lookupOrder]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    activeVerifyRef.current = '';
    lastStatusRef.current = '';
    lookupOrder(orderIdInput, { updateUrl: true });
  };

  const handleClear = () => {
    setOrderIdInput('');
    setVerifyInput('');
    activeVerifyRef.current = '';
    lastStatusRef.current = '';
    setFoundOrder(null);
    setHasSearched(false);
    setErrorMessage('');
    router.replace('/track-order', { scroll: false });
  };

  const handleVerifyOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundOrder || !verifyInput.trim()) return;
    const code = foundOrder.orderNumber || foundOrder.orderId;
    const clean = verifyInput.trim();
    activeVerifyRef.current = clean;
    await lookupOrder(code, { updateUrl: false, verifyOverride: clean });

    try {
      const hintsRaw = localStorage.getItem('orderVerifyHints');
      const hints = hintsRaw ? JSON.parse(hintsRaw) : {};
      hints[normalizeOrderCode(code)] = clean;
      localStorage.setItem('orderVerifyHints', JSON.stringify(hints));
    } catch {
      // ignore
    }
  };

  const handleRequestReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundOrder) return;
    if (!returnReason.trim()) {
      toast.error('Please enter a reason for return.');
      return;
    }

    const code = foundOrder.orderNumber || foundOrder.orderId;
    const verify = activeVerifyRef.current || getStoredVerifyHint(normalizeOrderCode(code));
    if (!verify) {
      toast.error('Please verify your phone last 4 digits or email first.');
      return;
    }

    setIsSubmittingReturn(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: code,
          action: 'request_return',
          verify,
          reason: returnReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Could not submit return request.');
      }

      toast.success('Return request submitted successfully.');
      setShowReturnModal(false);
      setReturnReason('');
      if (data.order) {
        setFoundOrder(data.order);
        lastStatusRef.current = data.order.status;
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Return request failed');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  const getItemImage = (imagePath?: string) => {
    if (!imagePath || failedImages[imagePath]) return '/images/Empty-cart.jpg';
    return imagePath;
  };

  const currentStatus = foundOrder ? mapLegacyStageToStatus(foundOrder) : 'Order Placed';

  return (
    <div className="space-y-6">
      {/* Search Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-8"
      >
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-2">
              <Truck className="w-4 h-4" />
              <span>Order Shipment Lookup</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Track Your Order
            </h1>
            <p className="text-sm text-slate-500 mt-1.5">
              Enter your StepStyle Order Number to check real-time fulfillment progress and shipping details.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={orderIdInput}
                onChange={(e) => setOrderIdInput(e.target.value)}
                placeholder="Enter Order ID (e.g. STEP-4829-1034)"
                aria-label="Order ID"
                className="w-full min-h-[46px] pl-10 pr-10 py-3 rounded-xl border border-slate-300 bg-slate-50 text-sm font-mono font-semibold text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-colors"
              />
              {orderIdInput && (
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Clear order ID"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSearching}
              className="min-h-[46px] px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              {isSearching ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <span>Track Order</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Recent Customer Orders */}
          {recentOrders.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
                Your Recent Orders
              </p>
              <div className="flex flex-wrap gap-2">
                {recentOrders.slice(0, 6).map((order) => {
                  const code = order.orderNumber || order.orderId;
                  const activeCode = foundOrder?.orderNumber || foundOrder?.orderId || '';
                  const isActive =
                    activeCode &&
                    normalizeOrderCode(activeCode) === normalizeOrderCode(code);
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        setOrderIdInput(code);
                        activeVerifyRef.current = '';
                        lookupOrder(code, { updateUrl: true });
                      }}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 hover:bg-indigo-50 text-slate-800 border-slate-200 hover:border-indigo-200'
                      }`}
                    >
                      <Package className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-mono font-semibold">{code}</span>
                      <span
                        className={`tabular-nums ${
                          isActive ? 'text-indigo-100' : 'text-slate-500'
                        }`}
                      >
                        · ₹{order.totalAmount.toLocaleString('en-IN')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Not Found State */}
      {hasSearched && !isSearching && errorMessage && !foundOrder && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-rose-200 bg-rose-50/70 p-6 text-center max-w-2xl mx-auto"
        >
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Order Not Found</h2>
          <p className="text-sm text-slate-600 mt-1">{errorMessage}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              href="/account"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
            >
              <User className="w-3.5 h-3.5" />
              <span>Go to My Account</span>
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Browse Footwear</span>
            </Link>
          </div>
        </motion.div>
      )}

      {/* Found Order View */}
      {foundOrder && !isSearching && (
        <motion.div
          key={foundOrder.orderNumber || foundOrder.orderId}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          {/* PII Verification Prompt when accessing unauthenticated / masked order */}
          {foundOrder.piiMasked && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-amber-900">
                <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    Privacy protection active — contact & full street address are masked
                  </p>
                  <p className="text-amber-800 mt-0.5">
                    Enter your registered email or last 4 digits of your phone number to unlock full receipt details or request a return.
                  </p>
                </div>
              </div>
              <form onSubmit={handleVerifyOwner} className="flex items-center gap-2 shrink-0">
                <input
                  type="text"
                  value={verifyInput}
                  onChange={(e) => setVerifyInput(e.target.value)}
                  placeholder="Email or last 4 phone digits"
                  className="px-3 py-2 text-xs rounded-lg border border-amber-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 min-w-[200px]"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  Verify
                </button>
              </form>
            </div>
          )}

          {/* 1. Order Status Timeline & Shipping Strip */}
          <OrderTracker
            order={foundOrder}
            onRefresh={() =>
              lookupOrder(foundOrder.orderNumber || foundOrder.orderId, {
                updateUrl: false,
                silent: true,
              })
            }
            isRefreshing={isRefreshing}
          />

          {/* 2. Purchased Items + Payment & Shipping Details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Items Column */}
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Purchased Footwear (
                        {foundOrder.items.reduce((acc, i) => acc + (i.quantity || 1), 0)})
                      </h3>
                      <p className="text-xs text-slate-500">
                        Order {foundOrder.orderNumber || foundOrder.orderId}
                      </p>
                    </div>
                  </div>
                  {currentStatus === 'Delivered' && (
                    <button
                      type="button"
                      onClick={() => setShowReturnModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Request Return</span>
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-100">
                  {foundOrder.items.map((item, idx) => {
                    const imgSrc = getItemImage(item.imagePath);
                    const qty = item.quantity || 1;
                    const lineTotal = item.lineTotal ?? item.price * qty;

                    return (
                      <div
                        key={`${item.id}-${item.selectedSize || 'std'}-${idx}`}
                        className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center gap-4"
                      >
                        <Link
                          href={`/products/${item.id}`}
                          className="relative w-20 h-20 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center hover:border-indigo-300 transition-colors"
                        >
                          <Image
                            src={imgSrc}
                            alt={item.name}
                            fill
                            referrerPolicy="no-referrer"
                            className="object-contain p-1.5"
                            onError={() =>
                              setFailedImages((prev) => ({
                                ...prev,
                                [imgSrc]: true,
                              }))
                            }
                          />
                        </Link>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <Link
                                href={`/products/${item.id}`}
                                className="text-sm font-bold text-slate-900 hover:text-indigo-600 transition-colors"
                              >
                                {item.name}
                              </Link>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {item.brand || 'StepStyle'}
                                {item.sku ? ` · SKU ${item.sku}` : ''}
                              </div>
                            </div>
                            <p className="text-sm font-bold text-slate-900 tabular-nums">
                              ₹{lineTotal.toLocaleString('en-IN')}
                            </p>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                            {item.selectedSize && (
                              <span>
                                Size: <strong className="text-slate-900">UK {item.selectedSize}</strong>
                              </span>
                            )}
                            {item.selectedColor && (
                              <span>
                                Color: <strong className="text-slate-900">{item.selectedColor}</strong>
                              </span>
                            )}
                            <span>
                              Qty: <strong className="text-slate-900 tabular-nums">{qty}</strong>
                            </span>
                            <span className="text-slate-400 tabular-nums">
                              (₹{item.price.toLocaleString('en-IN')} each)
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Customer Notifications Log (when verified) */}
              {foundOrder.notifications && foundOrder.notifications.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-3">
                    <Bell className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Order Notification Updates
                    </h3>
                  </div>
                  <div className="space-y-2.5">
                    {foundOrder.notifications.slice(0, 6).map((n) => (
                      <div
                        key={n.id}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-900">
                            {n.subject}{' '}
                            <span className="text-slate-400 font-normal uppercase">
                              · {n.channel}
                            </span>
                          </div>
                          <p className="text-slate-600">{n.message}</p>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 shrink-0 tabular-nums">
                          {formatDateTimeIN(n.sentAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Summary Column */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5 h-fit">
              <div>
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  <span>Payment Summary</span>
                </h3>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Order Number</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {foundOrder.orderNumber || foundOrder.orderId}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Payment Status</span>
                    <span className="font-semibold text-slate-900">
                      {foundOrder.paymentStatus}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Payment Method</span>
                    <span className="font-semibold text-slate-900">
                      {foundOrder.paymentMethod}
                    </span>
                  </div>
                  {foundOrder.utrNumber && foundOrder.utrNumber !== 'N/A' && (
                    <div className="flex justify-between text-slate-600">
                      <span>UPI Ref / UTR</span>
                      <span className="font-mono font-semibold text-emerald-700">
                        {foundOrder.utrNumber}
                      </span>
                    </div>
                  )}
                  {foundOrder.transactionId && (
                    <div className="flex justify-between text-slate-600">
                      <span>Transaction ID</span>
                      <span className="font-mono text-slate-800">
                        {foundOrder.transactionId}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-100 pt-2.5 text-sm">
                    <span className="font-bold text-slate-900">Total Amount</span>
                    <span className="font-bold text-slate-900 tabular-nums">
                      ₹{foundOrder.totalAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-indigo-600" />
                  <span>Delivery Destination</span>
                </h3>
                <div className="space-y-1.5 text-xs text-slate-600">
                  <p className="font-bold text-slate-900 text-sm">
                    {foundOrder.customer?.name || 'Customer'}
                  </p>
                  <p className="leading-relaxed">
                    {foundOrder.customer?.address || 'Address provided at checkout'}
                  </p>
                  <p>
                    Pincode:{' '}
                    <strong className="text-slate-900 tabular-nums">
                      {foundOrder.customer?.pincode || 'N/A'}
                    </strong>
                  </p>
                  {foundOrder.customer?.phone && foundOrder.customer.phone !== 'N/A' && (
                    <p>
                      Phone:{' '}
                      <strong className="text-slate-900 tabular-nums">
                        {foundOrder.customer.phone}
                      </strong>
                    </p>
                  )}
                  {foundOrder.customer?.email && (
                    <p>
                      Email:{' '}
                      <strong className="text-slate-900">{foundOrder.customer.email}</strong>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Initial Empty Guide */}
      {!hasSearched && !foundOrder && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-6 sm:p-8 text-center max-w-2xl mx-auto">
          <Package className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h2 className="text-sm sm:text-base font-bold text-slate-800">
            Ready to check your shipment milestones?
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Your Order Number (formatted like{' '}
            <span className="font-mono font-semibold text-slate-700">STEP-XXXX-XXXX</span>)
            is printed on your checkout receipt and PDF tax invoice.
          </p>
        </div>
      )}

      {/* Return Request Modal */}
      {showReturnModal && foundOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Request Return — {foundOrder.orderNumber || foundOrder.orderId}
              </h3>
              <button
                type="button"
                onClick={() => setShowReturnModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRequestReturn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Reason for Return *
                </label>
                <textarea
                  rows={3}
                  required
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g. Size runs small — requesting exchange or refund"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReturn}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer disabled:opacity-60"
                >
                  {isSubmittingReturn ? 'Submitting...' : 'Submit Return Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

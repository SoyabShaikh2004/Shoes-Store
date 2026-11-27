'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { toast } from 'react-hot-toast';
import {
  Search,
  Download,
  RefreshCw,
  Eye,
  X,
  Truck,
  FileText,
  Printer,
  MessageSquarePlus,
  Clock,
  RotateCcw,
  Bell,
  BellRing,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  MapPin,
} from 'lucide-react';
import { getAdminAuthHeaders, handleAdminUnauthorized } from '@/lib/adminAuth';
import { notifyStorefrontChanged, subscribeStorefrontChanges } from '@/lib/storefrontSync';
import { generateTaxInvoicePDF } from '@/lib/invoiceGenerator';
import { ALL_ORDER_STATUSES, OrderStatus, formatDateTimeIN } from '@/lib/orderTypes';
import type { AdminNotificationRecord } from '@/lib/db/schema';
import type { FullOrderView } from '@/lib/db/store';

interface OrdersOverview {
  totalOrders: number;
  pendingOrders: number;
  confirmedOrders: number;
  processingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  returnedOrRefundedOrders: number;
  totalRevenue: number;
}

interface AdminOrdersManagerProps {
  initialOrders?: FullOrderView[];
  initialOverview?: OrdersOverview | null;
  notifications?: AdminNotificationRecord[];
  unreadCount?: number;
  pendingOrderNumber?: string | null;
  externalSearch?: { query: string; nonce: number } | null;
  onClearPendingOrder?: () => void;
  onNotificationsSync?: (notifications: AdminNotificationRecord[], unreadCount: number) => void;
  onOrdersUpdated?: () => void;
}

const PAGE_SIZE = 10;

function statusBadgeStyle(status: OrderStatus): string {
  if (status === 'Delivered' || status === 'Refunded') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (status === 'Order Cancelled' || status === 'Payment Failed') {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }
  if (
    status === 'Return Requested' ||
    status === 'Returned' ||
    status === 'Refund Initiated'
  ) {
    return 'bg-amber-50 text-amber-800 border-amber-200';
  }
  return 'bg-indigo-50 text-indigo-700 border-indigo-200';
}

export default function AdminOrdersManager({
  initialOrders,
  initialOverview,
  notifications,
  unreadCount,
  pendingOrderNumber,
  externalSearch,
  onClearPendingOrder,
  onNotificationsSync,
  onOrdersUpdated,
}: AdminOrdersManagerProps) {
  const [orders, setOrders] = useState<FullOrderView[]>(initialOrders || []);
  const [overview, setOverview] = useState<OrdersOverview | null>(initialOverview ?? null);
  const [localNotifications, setLocalNotifications] = useState<AdminNotificationRecord[]>([]);
  const [localUnreadCount, setLocalUnreadCount] = useState(0);
  const [showReadNotifications, setShowReadNotifications] = useState(false);
  const [isLoading, setIsLoading] = useState(!initialOrders);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'amountDesc' | 'amountAsc'>('newest');
  const [page, setPage] = useState(1);

  // Selected order drawer/modal
  const [selectedOrder, setSelectedOrder] = useState<FullOrderView | null>(null);
  const [nextStatus, setNextStatus] = useState<OrderStatus>('Order Confirmed');
  const [carrierInput, setCarrierInput] = useState('BlueDart Express');
  const [trackingInput, setTrackingInput] = useState('');
  const [estDeliveryInput, setEstDeliveryInput] = useState('');
  const [statusNoteInput, setStatusNoteInput] = useState('');
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Admin note
  const [newAdminNote, setNewAdminNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  const activeNotifications = notifications ?? localNotifications;
  const activeUnreadCount = unreadCount ?? localUnreadCount;
  const unreadNotifs = activeNotifications.filter((n) => !n.isRead);

  // Stabilize callback & mutable refs so parent state syncs never trigger fetchOrders loops
  const onNotificationsSyncRef = useRef(onNotificationsSync);
  onNotificationsSyncRef.current = onNotificationsSync;
  const onClearPendingOrderRef = useRef(onClearPendingOrder);
  onClearPendingOrderRef.current = onClearPendingOrder;
  const onOrdersUpdatedRef = useRef(onOrdersUpdated);
  onOrdersUpdatedRef.current = onOrdersUpdated;
  const selectedOrderNumberRef = useRef<string | null>(null);
  selectedOrderNumberRef.current = selectedOrder?.order.orderNumber || null;
  const activeNotificationsRef = useRef<AdminNotificationRecord[]>(activeNotifications);
  activeNotificationsRef.current = activeNotifications;
  const ordersRef = useRef<FullOrderView[]>(orders);
  ordersRef.current = orders;
  const prevUnreadCountRef = useRef<number>(activeUnreadCount);

  useEffect(() => {
    if (externalSearch && externalSearch.query) {
      setSearch(externalSearch.query);
      setStatusFilter('All');
      setPaymentFilter('All');
      setDateFrom('');
      setDateTo('');
      setPage(1);
    }
  }, [externalSearch]);

  const markNotificationsRead = useCallback(
    async (params: { id?: string; orderNumber?: string; all?: boolean }) => {
      try {
        const res = await fetch('/api/admin/notifications', {
          method: 'PATCH',
          credentials: 'include',
          headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            action: 'mark_read',
            ...params,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          handleAdminUnauthorized(res.status, data?.error);
          return;
        }
        if (data?.success) {
          const nextList: AdminNotificationRecord[] = data.notifications || [];
          const nextUnread = Number(data.unreadCount) || 0;
          setLocalNotifications(nextList);
          setLocalUnreadCount(nextUnread);
          onNotificationsSyncRef.current?.(nextList, nextUnread);
        }
      } catch {
        // ignore mark read failure
      }
    },
    []
  );

  const fetchOrders = useCallback(
    async (silent = false) => {
      if (!silent) {
        setIsLoading(true);
        setLoadError(null);
      }
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set('search', search.trim());
        if (statusFilter !== 'All') params.set('status', statusFilter);
        if (paymentFilter !== 'All') params.set('paymentStatus', paymentFilter);
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);
        params.set('sort', sortBy);

        const res = await fetch(`/api/admin/orders?${params.toString()}`, {
          credentials: 'include',
          headers: getAdminAuthHeaders(),
          cache: 'no-store',
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          handleAdminUnauthorized(res.status, data?.error);
          throw new Error(data?.error || 'Failed to fetch orders');
        }

        const fetchedOrders: FullOrderView[] = data.orders || [];
        setOrders(fetchedOrders);
        setOverview(data.overview || null);
        setLoadError(null);
        if (!silent) setPage(1);

        if (Array.isArray(data.adminNotifications)) {
          const nextCount = Number(data.unreadNotificationsCount) || 0;
          setLocalNotifications(data.adminNotifications);
          setLocalUnreadCount(nextCount);
          onNotificationsSyncRef.current?.(data.adminNotifications, nextCount);
        }

        const currentSelectedNum = selectedOrderNumberRef.current;
        if (currentSelectedNum) {
          const refreshed = fetchedOrders.find(
            (o) => o.order.orderNumber === currentSelectedNum
          );
          if (refreshed) setSelectedOrder(refreshed);
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Failed to load orders';
        if (!silent) {
          setLoadError(errMsg);
          toast.error(errMsg);
        }
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [search, statusFilter, paymentFilter, dateFrom, dateTo, sortBy]
  );

  const skipInitialSkeletonRef = useRef(Boolean(initialOrders));

  useEffect(() => {
    if (
      initialOrders &&
      !search.trim() &&
      statusFilter === 'All' &&
      paymentFilter === 'All' &&
      !dateFrom &&
      !dateTo &&
      sortBy === 'newest'
    ) {
      setOrders(initialOrders);
      if (initialOverview) setOverview(initialOverview);
      setIsLoading(false);
    }
  }, [initialOrders, initialOverview, search, statusFilter, paymentFilter, dateFrom, dateTo, sortBy]);

  useEffect(() => {
    const silent = skipInitialSkeletonRef.current;
    skipInitialSkeletonRef.current = false;
    void fetchOrders(silent);
  }, [fetchOrders]);

  // Silent background refresh only when unread count increases
  useEffect(() => {
    if (activeUnreadCount > prevUnreadCountRef.current) {
      void fetchOrders(true);
    }
    prevUnreadCountRef.current = activeUnreadCount;
  }, [activeUnreadCount, fetchOrders]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchOrders(true);
      }
    }, 4000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchOrders(true);
      }
    };

    const handleFocus = () => {
      void fetchOrders(true);
    };

    const unsubscribe = subscribeStorefrontChanges((reason) => {
      if (reason === 'orders' || reason === 'all') {
        void fetchOrders(true);
      }
    });

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(timer);
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchOrders]);

  const openOrderModal = useCallback(
    (view: FullOrderView) => {
      setSelectedOrder(view);
      setNextStatus(view.order.status);
      setCarrierInput(view.shipping?.carrier || 'BlueDart Express');
      setTrackingInput(view.shipping?.trackingNumber || '');
      setEstDeliveryInput(view.shipping?.estimatedDelivery || view.order.estimatedDelivery || '');
      setStatusNoteInput('');
      setCancelReasonInput(view.order.cancelReason || '');
      setNewAdminNote('');

      const hasUnreadForOrder = activeNotificationsRef.current.some(
        (n) => !n.isRead && n.orderNumber === view.order.orderNumber
      );
      if (hasUnreadForOrder) {
        void markNotificationsRead({ orderNumber: view.order.orderNumber });
      }
    },
    [markNotificationsRead]
  );

  const handleOpenOrderByNumber = useCallback(
    async (orderNumber: string) => {
      const existing = ordersRef.current.find(
        (v) => v.order.orderNumber.toUpperCase() === orderNumber.toUpperCase()
      );
      if (existing) {
        openOrderModal(existing);
        return;
      }

      try {
        const res = await fetch(
          `/api/admin/orders?orderNumber=${encodeURIComponent(orderNumber)}`,
          {
            credentials: 'include',
            headers: getAdminAuthHeaders(),
            cache: 'no-store',
          }
        );
        const data = await res.json();
        if (res.ok && data?.success && data.order) {
          openOrderModal(data.order as FullOrderView);
        }
      } catch {
        toast.error(`Could not load order ${orderNumber}`);
      }
    },
    [openOrderModal]
  );

  useEffect(() => {
    if (!pendingOrderNumber) return;
    void handleOpenOrderByNumber(pendingOrderNumber);
    onClearPendingOrderRef.current?.();
  }, [pendingOrderNumber, handleOpenOrderByNumber]);

  const handleUpdateOrderStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    if (nextStatus === 'Order Cancelled' && !cancelReasonInput.trim() && !statusNoteInput.trim()) {
      toast.error('Please enter a cancellation reason.');
      return;
    }

    setIsUpdatingStatus(true);
    const toastId = toast.loading(`Updating ${selectedOrder.order.orderNumber} to "${nextStatus}"...`);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        credentials: 'include',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          orderNumber: selectedOrder.order.orderNumber,
          status: nextStatus,
          carrier: carrierInput.trim(),
          trackingNumber: trackingInput.trim(),
          estimatedDelivery: estDeliveryInput.trim(),
          note: statusNoteInput.trim(),
          cancelReason: nextStatus === 'Order Cancelled' ? cancelReasonInput.trim() : undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        handleAdminUnauthorized(res.status, data?.error);
        throw new Error(data?.error || 'Failed to update order');
      }

      toast.success(data.message || 'Order status updated!', { id: toastId });
      if (data.order) setSelectedOrder(data.order);
      setStatusNoteInput('');
      notifyStorefrontChanged('orders');
      await fetchOrders(true);
      onOrdersUpdatedRef.current?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Update failed', { id: toastId });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !newAdminNote.trim()) return;

    setIsAddingNote(true);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        credentials: 'include',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          orderNumber: selectedOrder.order.orderNumber,
          note: newAdminNote.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        handleAdminUnauthorized(res.status, data?.error);
        throw new Error(data?.error || 'Could not add note');
      }
      toast.success('Admin note added');
      setNewAdminNote('');
      await fetchOrders();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    const toastId = toast.loading(`Exporting orders to ${format.toUpperCase()}...`);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'All') params.set('status', statusFilter);
      if (paymentFilter !== 'All') params.set('paymentStatus', paymentFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      params.set('sort', sortBy);
      params.set('export', format);

      const res = await fetch(`/api/admin/orders?${params.toString()}`, {
        credentials: 'include',
        headers: getAdminAuthHeaders(),
      });
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stepstyle-orders-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Orders exported (${format.toUpperCase()})`, { id: toastId });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Export failed', { id: toastId });
    }
  };

  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const paginatedOrders = orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Live Order Notifications Alert Panel inside Admin Orders Section */}
      {unreadNotifs.length > 0 ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <BellRing className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">
                    New Order Notifications
                  </h2>
                  <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[11px] font-bold tabular-nums">
                    {unreadNotifs.length} unread
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Live incoming orders and customer return requests ready for fulfillment.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void markNotificationsRead({ all: true })}
              className="min-h-[44px] px-3.5 py-2 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-100 text-indigo-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark All Read</span>
            </button>
          </div>

          <div className="divide-y divide-indigo-100 rounded-xl border border-indigo-200/80 bg-white overflow-hidden">
            {unreadNotifs.slice(0, 6).map((notif) => (
              <div
                key={notif.id}
                className="p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                        notif.type === 'return_requested'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {notif.type === 'return_requested' ? 'Return Requested' : 'New Order'}
                    </span>
                    <span className="font-mono text-xs sm:text-sm font-bold text-slate-900">
                      {notif.orderNumber}
                    </span>
                    <span className="text-xs text-slate-500 tabular-nums">
                      {formatDateTimeIN(notif.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-slate-800">
                    {notif.customerName}{' '}
                    <span className="font-normal text-slate-500 font-mono">
                      ({notif.customerPhone})
                    </span>{' '}
                    · {notif.itemCount} {notif.itemCount === 1 ? 'pair' : 'pairs'} (
                    {notif.primaryItemName})
                  </p>
                  <p className="text-xs text-slate-600 tabular-nums">
                    Total:{' '}
                    <strong className="text-slate-900 font-mono">
                      ₹{notif.totalAmount.toLocaleString('en-IN')}
                    </strong>{' '}
                    · {notif.paymentMethod} ({notif.paymentStatus})
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleOpenOrderByNumber(notif.orderNumber)}
                    className="min-h-[44px] px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View &amp; Manage Order</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void markNotificationsRead({ id: notif.id })}
                    className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    Mark Read
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-700">
              <Bell className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-900">Order Notifications:</span>
              <span className="text-slate-500">All caught up — no unread order alerts.</span>
            </div>
            {activeNotifications.length > 0 && (
              <button
                type="button"
                onClick={() => setShowReadNotifications((prev) => !prev)}
                className="min-h-[44px] px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                {showReadNotifications
                  ? 'Hide Recent Alerts'
                  : `Recent Alerts (${activeNotifications.length})`}
              </button>
            )}
          </div>

          {showReadNotifications && activeNotifications.length > 0 && (
            <div className="divide-y divide-slate-100 border-t border-slate-100 pt-2">
              {activeNotifications.slice(0, 6).map((notif) => (
                <div
                  key={notif.id}
                  className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-slate-900 mr-2">
                      {notif.orderNumber}
                    </span>
                    <span className="text-slate-700">
                      {notif.customerName} · ₹{notif.totalAmount.toLocaleString('en-IN')} ·{' '}
                      {notif.paymentMethod}
                    </span>
                    <span className="text-slate-400 ml-2 tabular-nums">
                      {formatDateTimeIN(notif.createdAt)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleOpenOrderByNumber(notif.orderNumber)}
                    className="min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold cursor-pointer self-start sm:self-auto"
                  >
                    Open Order
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 8 Overview KPIs */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <div className="text-xs font-medium text-slate-500">Total Orders</div>
            <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {overview.totalOrders}
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <div className="text-xs font-medium text-slate-500">Total Revenue</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
              ₹{overview.totalRevenue.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <div className="text-xs font-medium text-slate-500">Pending · Confirmed</div>
            <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
              {overview.pendingOrders} · {overview.confirmedOrders}
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <div className="text-xs font-medium text-slate-500">Processing · Shipped</div>
            <div className="text-xl font-bold text-indigo-700 mt-1 tabular-nums">
              {overview.processingOrders} · {overview.shippedOrders}
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <div className="text-xs font-medium text-slate-500">Delivered</div>
            <div className="text-xl font-bold text-emerald-700 mt-1 tabular-nums">
              {overview.deliveredOrders}
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <div className="text-xs font-medium text-slate-500">Cancelled</div>
            <div className="text-xl font-bold text-rose-700 mt-1 tabular-nums">
              {overview.cancelledOrders}
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 col-span-2">
            <div className="text-xs font-medium text-slate-500">Returns & Refunds Active</div>
            <div className="text-xl font-bold text-amber-700 mt-1 tabular-nums">
              {overview.returnedOrRefundedOrders} order(s)
            </div>
          </div>
        </div>
      )}

      {/* Search, Filters & Export Controls */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Order Number, customer name, phone, or email..."
              className="w-full min-h-[44px] text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void fetchOrders(false);
                onOrdersUpdatedRef.current?.();
              }}
              className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport('csv')}
              className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport('xlsx')}
              className="min-h-[44px] px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-100 text-xs">
          <div>
            <label className="block font-semibold text-slate-500 mb-1">Order Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full min-h-[44px] text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800"
            >
              <option value="All">All Statuses</option>
              {ALL_ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-500 mb-1">Payment Status</label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full min-h-[44px] text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800"
            >
              <option value="All">All Payments</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Failed">Failed</option>
              <option value="Refund Initiated">Refund Initiated</option>
              <option value="Refunded">Refunded</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-500 mb-1">From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full min-h-[44px] text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-500 mb-1">To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full min-h-[44px] text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-500 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as 'newest' | 'oldest' | 'amountDesc' | 'amountAsc'
                )
              }
              className="w-full min-h-[44px] text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="amountDesc">Amount (High → Low)</option>
              <option value="amountAsc">Amount (Low → High)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loadError && !isLoading ? (
          <div className="p-8 sm:p-10 text-center space-y-3">
            <AlertTriangle className="w-9 h-9 text-rose-500 mx-auto" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Unable to load orders</h3>
              <p className="text-xs text-slate-500 mt-1">{loadError}</p>
            </div>
            <button
              type="button"
              onClick={() => void fetchOrders(false)}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Loading Orders</span>
            </button>
          </div>
        ) : isLoading ? (
          <div className="p-6 sm:p-8 space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : paginatedOrders.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-base font-bold text-slate-900">No matching orders found</h3>
            <p className="text-xs text-slate-500">
              Customer orders placed through checkout will appear here immediately.
            </p>
            {(search || statusFilter !== 'All' || paymentFilter !== 'All' || dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('All');
                  setPaymentFilter('All');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="mt-2 min-h-[40px] px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile & Tablet Order Cards */}
            <div className="lg:hidden divide-y divide-slate-100">
              {paginatedOrders.map((view) => {
                const { order, items, shipping } = view;
                const qtySum = items.reduce((s, i) => s + i.quantity, 0);
                return (
                  <div key={order.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono font-bold text-sm text-slate-900">
                          {order.orderNumber}
                        </div>
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          {formatDateTimeIN(order.createdAt)}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-md border text-[11px] font-semibold shrink-0 ${statusBadgeStyle(
                          order.status
                        )}`}
                      >
                        {order.status}
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <div className="font-semibold text-slate-900">{order.customerName}</div>
                      <div className="text-slate-600 break-all font-mono tabular-nums">
                        {order.customerPhone}
                        {order.customerEmail ? ` · ${order.customerEmail}` : ''}
                      </div>
                      <div className="text-slate-500 flex items-start gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="break-words">
                          {order.deliveryAddress}
                          {order.pincode && order.pincode !== 'N/A' ? ` · PIN ${order.pincode}` : ''}
                        </span>
                      </div>
                      <div className="text-slate-700 tabular-nums pt-0.5">
                        {qtySum} pair{qtySum === 1 ? '' : 's'}
                        {items[0]?.name ? ` · ${items[0].name}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <div className="tabular-nums">
                        <div className="text-sm font-bold text-slate-900">
                          ₹{order.totalAmount.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {order.paymentStatus} · {order.paymentMethod}
                        </div>
                      </div>
                      {shipping?.trackingNumber && (
                        <div className="text-[11px] font-mono text-slate-400 text-right truncate max-w-[160px]">
                          {shipping.trackingNumber}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => openOrderModal(view)}
                      className="w-full min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect / Update</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Desktop Orders Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-3 px-4">Order</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Items</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Manage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedOrders.map((view) => {
                    const { order, items, shipping } = view;
                    const qtySum = items.reduce((s, i) => s + i.quantity, 0);
                    return (
                      <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono font-bold text-slate-900">
                            {order.orderNumber}
                          </div>
                          <div className="text-[11px] text-slate-500 tabular-nums">
                            {formatDateTimeIN(order.createdAt)}
                          </div>
                        </td>
                        <td className="py-3 px-4 max-w-[260px]">
                          <div className="font-semibold text-slate-900 truncate">
                            {order.customerName}
                          </div>
                          <div className="text-[11px] text-slate-600 font-mono tabular-nums truncate">
                            {order.customerPhone}
                            {order.customerEmail ? ` · ${order.customerEmail}` : ''}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5" title={`${order.deliveryAddress} (${order.pincode})`}>
                            {order.deliveryAddress}
                            {order.pincode && order.pincode !== 'N/A' ? ` · ${order.pincode}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap tabular-nums">
                          <div className="font-medium text-slate-900">
                            {qtySum} pair{qtySum === 1 ? '' : 's'}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[160px]">
                            {items[0]?.name}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-bold text-slate-900 tabular-nums">
                          ₹{order.totalAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-xs">
                          <div className="font-semibold text-slate-800">{order.paymentStatus}</div>
                          <div className="text-[11px] text-slate-500">{order.paymentMethod}</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-semibold ${statusBadgeStyle(
                              order.status
                            )}`}
                          >
                            {order.status}
                          </span>
                          {shipping?.trackingNumber && (
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                              {shipping.carrier}: {shipping.trackingNumber}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-right">
                          <button
                            type="button"
                            onClick={() => openOrderModal(view)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect / Update</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination */}
        {orders.length > PAGE_SIZE && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span className="tabular-nums">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, orders.length)} of{' '}
              {orders.length} orders
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label="Previous page"
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-semibold tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Next page"
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Order Details & Workflow Drawer Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex justify-end">
          <div className="bg-white w-full max-w-3xl h-full overflow-y-auto border-l border-slate-200 flex flex-col">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 font-mono">
                    {selectedOrder.order.orderNumber}
                  </h2>
                  <span
                    className={`px-2 py-0.5 rounded-md border text-xs font-semibold ${statusBadgeStyle(
                      selectedOrder.order.status
                    )}`}
                  >
                    {selectedOrder.order.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Placed {formatDateTimeIN(selectedOrder.order.createdAt)} · Customer:{' '}
                  {selectedOrder.order.customerName}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    generateTaxInvoicePDF({
                      orderId: selectedOrder.order.orderNumber,
                      date: selectedOrder.order.createdAt,
                      items: selectedOrder.items.map((i) => ({
                        id: i.productId,
                        name: i.name,
                        price: i.unitPrice,
                        quantity: i.quantity,
                        selectedColor: i.selectedColor,
                        selectedSize: i.selectedSize,
                        brand: i.brand,
                        category: i.category,
                      })),
                      totalAmount: selectedOrder.order.totalAmount,
                      paymentStatus: selectedOrder.order.paymentStatus,
                      paymentMethod: selectedOrder.order.paymentMethod,
                      transactionId: selectedOrder.payment?.transactionId,
                      utrNumber: selectedOrder.payment?.utrNumber,
                      customer: {
                        name: selectedOrder.order.customerName,
                        phone: selectedOrder.order.customerPhone,
                        address: selectedOrder.order.deliveryAddress,
                        pincode: selectedOrder.order.pincode,
                        email: selectedOrder.order.customerEmail,
                      },
                      estimatedDelivery: selectedOrder.order.estimatedDelivery,
                    })
                  }
                  className="min-h-[44px] px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>PDF Invoice</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="min-h-[44px] px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  aria-label="Close drawer"
                  className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              {/* Update Status & Shipping Form */}
              <form
                onSubmit={handleUpdateOrderStatus}
                className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5 space-y-4"
              >
                <h3 className="text-sm font-bold text-slate-900">
                  Update Fulfillment Status & Logistics
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Order Status *
                    </label>
                    <select
                      value={nextStatus}
                      onChange={(e) => setNextStatus(e.target.value as OrderStatus)}
                      className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm bg-white border border-slate-300 rounded-lg font-medium"
                    >
                      {ALL_ORDER_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Shipping Company
                    </label>
                    <input
                      type="text"
                      value={carrierInput}
                      onChange={(e) => setCarrierInput(e.target.value)}
                      placeholder="BlueDart Express, Delhivery..."
                      className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tracking / AWB Number
                    </label>
                    <input
                      type="text"
                      value={trackingInput}
                      onChange={(e) => setTrackingInput(e.target.value)}
                      placeholder="BD-IN-12345678"
                      className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm font-mono bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Estimated Delivery
                    </label>
                    <input
                      type="text"
                      value={estDeliveryInput}
                      onChange={(e) => setEstDeliveryInput(e.target.value)}
                      placeholder="e.g. Friday, 27 Nov"
                      className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  {nextStatus === 'Order Cancelled' && (
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-rose-700 mb-1">
                        Cancellation Reason * (Restores inventory if deducted)
                      </label>
                      <input
                        type="text"
                        required
                        value={cancelReasonInput}
                        onChange={(e) => setCancelReasonInput(e.target.value)}
                        placeholder="Customer requested cancellation / Out of warehouse stock..."
                        className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm bg-white border border-rose-300 rounded-lg"
                      />
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Status Update Note (Visible in Customer Timeline)
                    </label>
                    <input
                      type="text"
                      value={statusNoteInput}
                      onChange={(e) => setStatusNoteInput(e.target.value)}
                      placeholder="e.g. Dispatched from Mumbai hub"
                      className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <p className="text-[11px] text-slate-500">
                    Saving automatically logs admin identity, updates customer tracker & notifications, and enforces stock rules.
                  </p>
                  <button
                    type="submit"
                    disabled={isUpdatingStatus}
                    className="min-h-[44px] w-full sm:w-auto px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                  >
                    {isUpdatingStatus ? 'Saving...' : 'Save Order Update'}
                  </button>
                </div>
              </form>

              {/* Customer & Payment Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl border border-slate-200 space-y-2 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">Customer & Shipping Address</span>
                    {(selectedOrder.order.customerPhone !== 'N/A' || selectedOrder.order.customerEmail) && (
                      <button
                        type="button"
                        onClick={() => {
                          const query =
                            selectedOrder.order.customerPhone !== 'N/A'
                              ? selectedOrder.order.customerPhone
                              : selectedOrder.order.customerEmail;
                          setSearch(query);
                          setSelectedOrder(null);
                        }}
                        className="text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer shrink-0"
                      >
                        All orders by customer →
                      </button>
                    )}
                  </div>
                  <p className="font-semibold text-slate-800 text-sm">{selectedOrder.order.customerName}</p>
                  <p className="text-slate-600">
                    Phone: <span className="font-mono tabular-nums">{selectedOrder.order.customerPhone}</span>
                  </p>
                  {selectedOrder.order.customerEmail && (
                    <p className="text-slate-600 break-all">Email: {selectedOrder.order.customerEmail}</p>
                  )}
                  <p className="text-slate-600 break-words">
                    Address: {selectedOrder.order.deliveryAddress}
                  </p>
                  <p className="text-slate-600">
                    Pincode: <span className="font-mono tabular-nums font-semibold text-slate-800">{selectedOrder.order.pincode}</span>
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-1.5 tabular-nums min-w-0">
                  <div className="font-bold text-slate-900 mb-1">Payment & Stock Accounting</div>
                  <p className="text-slate-600">
                    Payment Status:{' '}
                    <strong className="text-slate-900">{selectedOrder.order.paymentStatus}</strong>
                  </p>
                  <p className="text-slate-600">Method: {selectedOrder.order.paymentMethod}</p>
                  {selectedOrder.payment?.transactionId && (
                    <p className="text-slate-600 break-all">
                      Txn ID: <span className="font-mono">{selectedOrder.payment.transactionId}</span>
                    </p>
                  )}
                  <p className="text-slate-600">
                    Inventory Reserved:{' '}
                    <strong>{selectedOrder.order.stockDeducted ? 'Yes (Deducted)' : 'No'}</strong>
                  </p>
                  <p className="text-sm font-bold text-slate-900 pt-1">
                    Total: ₹{selectedOrder.order.totalAmount.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              {/* Ordered Footwear Items */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                  Purchased Items ({selectedOrder.items.length})
                </div>
                <div className="divide-y divide-slate-100">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="p-3.5 flex items-center gap-3 text-xs">
                      <div className="relative w-12 h-12 rounded-lg bg-slate-50 border border-slate-200 overflow-hidden shrink-0">
                        <Image
                          src={item.imagePath || '/images/Empty-cart.jpg'}
                          alt={item.name}
                          fill
                          referrerPolicy="no-referrer"
                          className="object-contain p-1"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{item.name}</div>
                        <div className="text-slate-500">
                          SKU {item.sku} · Size UK {item.selectedSize || 'Std'} · Qty {item.quantity}
                        </div>
                      </div>
                      <div className="font-bold text-slate-900 tabular-nums shrink-0">
                        ₹{item.lineTotal.toLocaleString('en-IN')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Returns & Refunds */}
              {(selectedOrder.returns.length > 0 || selectedOrder.refunds.length > 0) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-2 text-xs">
                  <div className="font-bold text-amber-900 flex items-center gap-1.5">
                    <RotateCcw className="w-4 h-4" />
                    <span>Returns & Refunds History</span>
                  </div>
                  {selectedOrder.returns.map((r) => (
                    <div key={r.id} className="text-slate-700">
                      Return ({r.status}): {r.reason} · Requested {formatDateTimeIN(r.requestedAt)}
                    </div>
                  ))}
                  {selectedOrder.refunds.map((rf) => (
                    <div key={rf.id} className="text-slate-700 font-mono">
                      Refund {rf.referenceId}: ₹{rf.amount.toLocaleString('en-IN')} ({rf.status})
                    </div>
                  ))}
                </div>
              )}

              {/* Internal Admin Notes */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <MessageSquarePlus className="w-4 h-4 text-indigo-600" />
                  <span>Internal Admin Notes ({selectedOrder.adminNotes.length})</span>
                </div>
                <form onSubmit={handleAddNote} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newAdminNote}
                    onChange={(e) => setNewAdminNote(e.target.value)}
                    placeholder="Add private dispatch or customer support note..."
                    className="flex-1 min-h-[44px] px-3 py-2 text-base sm:text-xs border border-slate-300 rounded-lg"
                  />
                  <button
                    type="submit"
                    disabled={isAddingNote || !newAdminNote.trim()}
                    className="min-h-[44px] px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    Add Note
                  </button>
                </form>
                {selectedOrder.adminNotes.length > 0 && (
                  <div className="space-y-2">
                    {selectedOrder.adminNotes.map((n) => (
                      <div key={n.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                        <div className="flex justify-between text-slate-500 mb-0.5">
                          <span className="font-semibold text-slate-800">{n.adminName}</span>
                          <span className="tabular-nums">{formatDateTimeIN(n.createdAt)}</span>
                        </div>
                        <p className="text-slate-700">{n.note}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Permanent Status Audit History */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Permanent Order Status History</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {[...selectedOrder.statusHistory].reverse().map((h) => (
                    <div key={h.id} className="px-4 py-2.5 text-xs flex justify-between gap-4">
                      <div>
                        <span className="font-semibold text-slate-900">{h.status}</span>{' '}
                        <span className="text-slate-500">
                          by {h.updatedByAdminName} ({h.updatedByRole})
                        </span>
                        {h.note && <p className="text-slate-600 mt-0.5">{h.note}</p>}
                      </div>
                      <span className="font-mono text-slate-500 shrink-0 tabular-nums">
                        {formatDateTimeIN(h.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dispatched Customer Notifications */}
              {selectedOrder.notifications.length > 0 && (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Customer Notification Log ({selectedOrder.notifications.length})</span>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {selectedOrder.notifications.map((n) => (
                      <div key={n.id} className="px-4 py-2 text-xs flex justify-between gap-2">
                        <div>
                          <span className="font-semibold uppercase text-indigo-700">
                            {n.channel}
                          </span>{' '}
                          <span className="text-slate-800">{n.message}</span>
                        </div>
                        <span className="font-mono text-slate-400 shrink-0 tabular-nums">
                          {formatDateTimeIN(n.sentAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

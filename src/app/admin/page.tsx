'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Product } from '@/lib/data';
import type { AdminNotificationRecord } from '@/lib/db/schema';
import { formatDateTimeIN } from '@/lib/orderTypes';
import CatalogStats from '@/components/admin/CatalogStats';
import ProductList from '@/components/admin/ProductList';
import ProductForm from '@/components/admin/ProductForm';
import AdminAuth from '@/components/admin/AdminAuth';
import AdminOrdersManager from '@/components/admin/AdminOrdersManager';
import AdminBulkUpload from '@/components/admin/AdminBulkUpload';
import {
  OverviewPayload,
  OverviewSection,
  CategoriesSection,
  CustomersSection,
  InventorySection,
  PaymentsSection,
  ShippingSection,
  ReportsSection,
  SettingsSection,
} from '@/components/admin/AdminSections';
import {
  AdminUser,
  checkAdminSession,
  adminSignOut,
  getAdminAuthHeaders,
  handleAdminUnauthorized,
} from '@/lib/adminAuth';
import {
  ADMIN_SESSION_EXPIRED_EVENT,
  subscribeStorefrontChanges,
} from '@/lib/storefrontSync';
import { toast } from 'react-hot-toast';
import {
  ShieldCheck,
  Plus,
  RefreshCw,
  LayoutDashboard,
  ShoppingCart,
  Package,
  UploadCloud,
  Layers,
  Users,
  Boxes,
  CreditCard,
  Truck,
  BarChart3,
  Settings,
  Store,
  LogOut,
  Menu,
  X,
  Bell,
  CheckCheck,
  ArrowRight,
} from 'lucide-react';

type AdminNavTab =
  | 'overview'
  | 'orders'
  | 'products'
  | 'create'
  | 'bulk'
  | 'categories'
  | 'customers'
  | 'inventory'
  | 'payments'
  | 'shipping'
  | 'reports'
  | 'settings';

const NAV_ITEMS: Array<{
  id: AdminNavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: ShoppingCart },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'bulk', label: 'Bulk Upload', icon: UploadCloud },
  { id: 'categories', label: 'Categories', icon: Layers },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'shipping', label: 'Shipping', icon: Truck },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function AdminContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [overviewData, setOverviewData] = useState<OverviewPayload | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [adminNotifications, setAdminNotifications] = useState<AdminNotificationRecord[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [pendingInspectOrderNumber, setPendingInspectOrderNumber] = useState<string | null>(null);
  const [pendingOrdersSearch, setPendingOrdersSearch] = useState<{
    query: string;
    nonce: number;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<AdminNavTab>('overview');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const seenNotifIdsRef = useRef<Set<string> | null>(null);
  const lastSyncKeyRef = useRef<string | null>(null);
  const notifDropdownRef = useRef<HTMLDivElement | null>(null);
  const isSyncingLocalOrdersRef = useRef<boolean>(false);

  const loadDashboardData = useCallback(async (showToast = false) => {
    setIsLoadingOverview(true);
    try {
      const [prodRes, ovRes] = await Promise.all([
        fetch('/api/admin/products', {
          credentials: 'include',
          headers: getAdminAuthHeaders(),
          cache: 'no-store',
        }),
        fetch('/api/admin/overview', {
          credentials: 'include',
          headers: getAdminAuthHeaders(),
          cache: 'no-store',
        }),
      ]);

      const [prodData, ovJson] = await Promise.all([
        prodRes.json().catch(() => null),
        ovRes.json().catch(() => null),
      ]);

      if (
        handleAdminUnauthorized(prodRes.status, prodData?.error) ||
        handleAdminUnauthorized(ovRes.status, ovJson?.error)
      ) {
        return;
      }

      if (prodRes.ok && prodData?.success) {
        const list: Product[] = prodData.products || [];
        setProducts(list);
        setCategories(Array.from(new Set(list.map((p) => p.category).filter(Boolean))));
      }

      let activeOvJson = ovJson;

      // Recover any placed storefront orders sitting only in this browser's localStorage
      if (ovRes.ok && ovJson?.success && !isSyncingLocalOrdersRef.current) {
        try {
          const rawLocal = localStorage.getItem('orders');
          if (rawLocal) {
            const parsedLocal = JSON.parse(rawLocal);
            if (Array.isArray(parsedLocal) && parsedLocal.length > 0) {
              const serverNums = new Set(
                (Array.isArray(ovJson.orders) ? ovJson.orders : []).map(
                  (o: { order?: { orderNumber?: string } }) =>
                    String(o?.order?.orderNumber || '').trim().toUpperCase()
                )
              );
              const missingLocal = parsedLocal.filter(
                (o: { orderNumber?: string; orderId?: string }) => {
                  const code = String(o?.orderNumber || o?.orderId || '').trim().toUpperCase();
                  return code.length >= 4 && !serverNums.has(code);
                }
              );

              if (missingLocal.length > 0) {
                isSyncingLocalOrdersRef.current = true;
                const syncRes = await fetch('/api/admin/orders/sync', {
                  method: 'POST',
                  credentials: 'include',
                  headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
                  body: JSON.stringify({ orders: missingLocal.slice(0, 100) }),
                });
                const syncData = await syncRes.json().catch(() => null);
                if (syncRes.ok && syncData?.success && Number(syncData.importedCount) > 0) {
                  toast.success(
                    `Synced ${syncData.importedCount} placed order(s) into Admin Orders`
                  );
                  const refreshedOvRes = await fetch('/api/admin/overview', {
                    credentials: 'include',
                    headers: getAdminAuthHeaders(),
                    cache: 'no-store',
                  });
                  const refreshedOvJson = await refreshedOvRes.json().catch(() => null);
                  if (refreshedOvRes.ok && refreshedOvJson?.success) {
                    activeOvJson = refreshedOvJson;
                  }
                }
              }
            }
          }
        } catch {
          // ignore localStorage recovery errors
        } finally {
          isSyncingLocalOrdersRef.current = false;
        }
      }

      if (ovRes.ok && activeOvJson?.success) {
        setOverviewData(activeOvJson);
        setOverviewError(null);
        if (Array.isArray(activeOvJson.adminNotifications)) {
          const list = activeOvJson.adminNotifications as AdminNotificationRecord[];
          setAdminNotifications(list);
          setUnreadNotificationsCount(Number(activeOvJson.unreadNotificationsCount) || 0);
          if (seenNotifIdsRef.current === null) {
            seenNotifIdsRef.current = new Set(list.map((n) => n.id));
          }
        }
      } else {
        setOverviewError(activeOvJson?.error || 'Could not load customer & order overview');
      }

      if (showToast) {
        toast.success('Admin dashboard refreshed');
      }
    } catch {
      setOverviewError('Network error loading dashboard data');
      toast.error('Could not load dashboard data');
    } finally {
      setIsLoadingOverview(false);
    }
  }, []);

  const fetchAdminNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications', {
        credentials: 'include',
        headers: getAdminAuthHeaders(),
        cache: 'no-store',
      });
      const data = await res.json().catch(() => null);
      if (handleAdminUnauthorized(res.status, data?.error)) return;
      if (!res.ok || !data?.success || !Array.isArray(data.notifications)) return;

      const list = data.notifications as AdminNotificationRecord[];
      const count = Number(data.unreadCount) || 0;
      const syncKey = `${Number(data.totalOrders ?? 0)}|${Number(data.totalCustomers ?? 0)}|${
        data.latestOrderAt || ''
      }|${data.latestCustomerAt || ''}`;

      let shouldRefreshDashboard = false;

      if (lastSyncKeyRef.current === null) {
        lastSyncKeyRef.current = syncKey;
      } else if (lastSyncKeyRef.current !== syncKey) {
        lastSyncKeyRef.current = syncKey;
        shouldRefreshDashboard = true;
      }

      if (seenNotifIdsRef.current === null) {
        seenNotifIdsRef.current = new Set(list.map((n) => n.id));
      } else {
        const newUnread = list.filter(
          (n) => !n.isRead && !seenNotifIdsRef.current!.has(n.id)
        );
        for (const n of list) {
          seenNotifIdsRef.current.add(n.id);
        }
        if (newUnread.length > 0) {
          toast.success(
            newUnread.length === 1
              ? newUnread[0].message
              : `${newUnread.length} new customer order notifications received!`
          );
          shouldRefreshDashboard = true;
        }
      }

      if (shouldRefreshDashboard) {
        void loadDashboardData();
      }

      setAdminNotifications(list);
      setUnreadNotificationsCount(count);
    } catch {
      // silent background polling failure
    }
  }, [loadDashboardData]);

  const handleMarkNotificationsRead = useCallback(
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
        const data = await res.json();
        if (res.ok && data?.success) {
          setAdminNotifications(data.notifications || []);
          setUnreadNotificationsCount(Number(data.unreadCount) || 0);
        }
      } catch {
        // ignore mark-read error
      }
    },
    []
  );

  const handleInspectOrderFromNotification = (notif: AdminNotificationRecord) => {
    setNotifDropdownOpen(false);
    setMobileSidebarOpen(false);
    setEditingProduct(null);
    setPendingInspectOrderNumber(notif.orderNumber);
    setActiveTab('orders');
    if (!notif.isRead) {
      void handleMarkNotificationsRead({ orderNumber: notif.orderNumber });
    }
  };

  const handleClearPendingOrder = useCallback(() => {
    setPendingInspectOrderNumber(null);
  }, []);

  const handleNotificationsSync = useCallback(
    (list: AdminNotificationRecord[], count: number) => {
      setAdminNotifications(list);
      setUnreadNotificationsCount(count);
    },
    []
  );

  const handleOrdersUpdated = useCallback(() => {
    void loadDashboardData();
    void fetchAdminNotifications();
  }, [loadDashboardData, fetchAdminNotifications]);

  const handleInspectOrderFromCustomer = useCallback((orderNumber: string) => {
    setEditingProduct(null);
    setPendingInspectOrderNumber(orderNumber);
    setActiveTab('orders');
  }, []);

  const handleFilterOrdersByCustomer = useCallback((query: string) => {
    setEditingProduct(null);
    setPendingOrdersSearch({ query, nonce: Date.now() });
    setActiveTab('orders');
  }, []);

  useEffect(() => {
    const verify = async () => {
      const session = await checkAdminSession();
      if (session.authenticated && session.user) {
        setCurrentAdmin(session.user);
      }
      setIsCheckingAuth(false);
    };
    verify();

    const handleExpired = () => {
      seenNotifIdsRef.current = null;
      lastSyncKeyRef.current = null;
      setCurrentAdmin(null);
      toast.error('Admin session expired. Please sign in again.');
    };
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, handleExpired);
    return () => {
      window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, handleExpired);
    };
  }, []);

  useEffect(() => {
    if (currentAdmin) {
      void loadDashboardData();
      void fetchAdminNotifications();
    }
  }, [currentAdmin, loadDashboardData, fetchAdminNotifications]);

  useEffect(() => {
    if (
      currentAdmin &&
      (activeTab === 'customers' || activeTab === 'overview' || activeTab === 'orders')
    ) {
      void loadDashboardData();
    }
  }, [currentAdmin, activeTab, loadDashboardData]);

  useEffect(() => {
    if (!currentAdmin) return;

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchAdminNotifications();
      }
    }, 4000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchAdminNotifications();
      }
    };

    const handleFocus = () => {
      void fetchAdminNotifications();
    };

    const unsubscribe = subscribeStorefrontChanges((reason) => {
      if (
        reason === 'orders' ||
        reason === 'customers' ||
        reason === 'products' ||
        reason === 'banners' ||
        reason === 'all'
      ) {
        void loadDashboardData();
        void fetchAdminNotifications();
      }
    });

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(timer);
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentAdmin, fetchAdminNotifications, loadDashboardData]);

  useEffect(() => {
    if (!notifDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        notifDropdownRef.current &&
        !notifDropdownRef.current.contains(e.target as Node)
      ) {
        setNotifDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notifDropdownOpen]);

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && products.length > 0) {
      const target = products.find((p) => p.id === Number(editId));
      if (target) {
        setEditingProduct(target);
        setActiveTab('create');
      }
    }
  }, [searchParams, products]);

  const handleSignOut = async () => {
    await adminSignOut();
    seenNotifIdsRef.current = null;
    lastSyncKeyRef.current = null;
    setCurrentAdmin(null);
    toast.success('Logged out of Admin Portal');
  };

  const handleStartEdit = (product: Product) => {
    setEditingProduct(product);
    setActiveTab('create');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFormSuccess = () => {
    setEditingProduct(null);
    setActiveTab('products');
    loadDashboardData();
    router.replace('/admin');
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-9 h-9 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400 font-mono tracking-wider">
            Verifying Admin Session...
          </p>
        </div>
      </div>
    );
  }

  if (!currentAdmin) {
    return (
      <AdminAuth
        onSuccess={(user) => {
          setCurrentAdmin(user);
        }}
      />
    );
  }

  const activeNavTitle =
    activeTab === 'create'
      ? editingProduct
        ? `Edit Shoe #${editingProduct.id}`
        : 'Add New Shoe'
      : NAV_ITEMS.find((i) => i.id === activeTab)?.label || 'Dashboard Overview';

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-x-clip">
      {/* Desktop Sidebar: Icon-only rail before hover, expands on hover as a floating overlay without shifting content */}
      <aside
        aria-label="Admin navigation"
        className="group hidden lg:flex lg:w-[72px] lg:hover:w-64 lg:focus-within:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 bg-slate-950 text-slate-300 border-r border-slate-800 z-40 transition-[width] duration-200 ease-out overflow-hidden lg:hover:shadow-2xl lg:focus-within:shadow-2xl"
      >
        <div className="h-16 px-3 flex items-center border-b border-slate-800 shrink-0">
          <div className="w-12 h-10 flex items-center justify-center shrink-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="overflow-hidden whitespace-nowrap opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 transition-opacity duration-150">
            <div className="text-sm font-bold text-white leading-none">StepStyle</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Admin Operations</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-1 no-scrollbar">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeTab === item.id || (item.id === 'products' && activeTab === 'create');
            return (
              <button
                key={item.id}
                type="button"
                title={item.label}
                aria-label={item.label}
                onClick={() => {
                  setEditingProduct(null);
                  setActiveTab(item.id);
                }}
                className={`relative w-full min-h-[44px] flex items-center justify-between pr-0 lg:group-hover:pr-3 lg:group-focus-within:pr-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <span className="flex items-center min-w-0">
                  <span className="relative w-12 h-6 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 shrink-0" />
                    {item.id === 'orders' && unreadNotificationsCount > 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute -top-0.5 right-2.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-slate-950 lg:group-hover:hidden lg:group-focus-within:hidden"
                      />
                    )}
                  </span>
                  <span className="opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 transition-opacity duration-150 truncate">
                    {item.label}
                  </span>
                </span>
                {item.id === 'orders' && (
                  <span className="hidden lg:group-hover:flex lg:group-focus-within:flex items-center gap-1.5 shrink-0">
                    {unreadNotificationsCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-md bg-rose-500 text-white text-[10px] font-bold tabular-nums leading-none">
                        {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount} new
                      </span>
                    )}
                    {overviewData && (
                      <span className="tabular-nums text-[11px] opacity-80">
                        {overviewData.overview.totalOrders}
                      </span>
                    )}
                  </span>
                )}
                {item.id === 'products' && (
                  <span className="hidden lg:group-hover:inline lg:group-focus-within:inline tabular-nums text-[11px] opacity-80 shrink-0">
                    {products.length}
                  </span>
                )}
                {item.id === 'customers' && overviewData && (
                  <span className="hidden lg:group-hover:inline lg:group-focus-within:inline tabular-nums text-[11px] opacity-80 shrink-0">
                    {overviewData.customers.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-3 shrink-0">
          <div className="hidden lg:group-hover:block lg:group-focus-within:block px-1 text-xs whitespace-nowrap overflow-hidden">
            <div className="font-semibold text-white truncate">{currentAdmin.name}</div>
            <div className="text-[11px] text-slate-400 truncate">
              {currentAdmin.role} · {currentAdmin.email}
            </div>
          </div>
          <div className="flex flex-col lg:group-hover:flex-row lg:group-focus-within:flex-row items-center gap-2">
            <Link
              href="/"
              onClick={() => router.refresh()}
              title="Open Storefront"
              aria-label="Open Storefront"
              className="w-12 lg:group-hover:w-auto lg:group-hover:flex-1 lg:group-focus-within:w-auto lg:group-focus-within:flex-1 min-h-[44px] py-2 px-0 lg:group-hover:px-2.5 lg:group-focus-within:px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Store className="w-4 h-4 shrink-0" />
              <span className="hidden lg:group-hover:inline lg:group-focus-within:inline">
                Storefront
              </span>
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-12 lg:group-hover:w-11 lg:group-focus-within:w-11 min-h-[44px] py-2 px-2 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-200 text-xs font-medium flex items-center justify-center cursor-pointer shrink-0"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile & Tablet Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-slate-950 text-slate-300 h-full flex flex-col z-10">
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="font-bold text-white text-sm">StepStyle Admin</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white cursor-pointer"
                aria-label="Close admin menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive =
                  activeTab === item.id || (item.id === 'products' && activeTab === 'create');
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setEditingProduct(null);
                      setActiveTab(item.id);
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full min-h-[44px] flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer ${
                      isActive ? 'bg-indigo-600 text-white font-semibold' : 'text-slate-400 hover:bg-slate-900'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                    {item.id === 'orders' && (
                      <span className="flex items-center gap-1.5">
                        {unreadNotificationsCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-md bg-rose-500 text-white text-[10px] font-bold tabular-nums leading-none">
                            {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount} new
                          </span>
                        )}
                        {overviewData && (
                          <span className="tabular-nums text-[11px] opacity-80">
                            {overviewData.overview.totalOrders}
                          </span>
                        )}
                      </span>
                    )}
                    {item.id === 'products' && (
                      <span className="tabular-nums text-[11px] opacity-80">
                        {products.length}
                      </span>
                    )}
                    {item.id === 'customers' && overviewData && (
                      <span className="tabular-nums text-[11px] opacity-80">
                        {overviewData.customers.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-800 space-y-3 shrink-0">
              <div className="text-xs">
                <div className="font-semibold text-white truncate">{currentAdmin.name}</div>
                <div className="text-[11px] text-slate-400 truncate">
                  {currentAdmin.role}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Link
                  href="/"
                  onClick={() => {
                    setMobileSidebarOpen(false);
                    router.refresh();
                  }}
                  className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 text-xs text-slate-200 hover:text-white px-3"
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>Storefront</span>
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="min-h-[44px] px-3 rounded-lg bg-rose-950/60 text-xs text-rose-300 font-semibold cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 lg:pl-[72px] flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200 px-3.5 sm:px-6 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-700 cursor-pointer shrink-0"
              aria-label="Open admin menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-sm sm:text-lg font-bold text-slate-900 truncate">
              {activeNavTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Admin Order Notifications Bell */}
            <div className="relative" ref={notifDropdownRef}>
              <button
                type="button"
                onClick={() => setNotifDropdownOpen((prev) => !prev)}
                aria-label={`Order notifications (${unreadNotificationsCount} unread)`}
                className={`relative min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                  unreadNotificationsCount > 0
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-md bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums shadow-xs">
                    {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                  </span>
                )}
              </button>

              {notifDropdownOpen && (
                <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-sm bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">Order Notifications</span>
                      {unreadNotificationsCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[10px] font-bold tabular-nums">
                          {unreadNotificationsCount} new
                        </span>
                      )}
                    </div>
                    {unreadNotificationsCount > 0 && (
                      <button
                        type="button"
                        onClick={() => void handleMarkNotificationsRead({ all: true })}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 cursor-pointer py-1 px-1.5 rounded"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {adminNotifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        No order notifications yet. New customer orders will appear here live.
                      </div>
                    ) : (
                      adminNotifications.slice(0, 12).map((notif) => (
                        <button
                          key={notif.id}
                          type="button"
                          onClick={() => handleInspectOrderFromNotification(notif)}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                            notif.isRead ? 'opacity-70' : 'bg-indigo-50/40'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              {!notif.isRead && (
                                <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                              )}
                              <span className="font-mono text-xs font-bold text-slate-900 truncate">
                                {notif.orderNumber}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  notif.type === 'return_requested'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {notif.type === 'return_requested' ? 'Return' : 'New Order'}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-slate-800 truncate">
                              {notif.customerName} · {notif.itemCount}{' '}
                              {notif.itemCount === 1 ? 'pair' : 'pairs'}
                            </p>
                            <p className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                              ₹{notif.totalAmount.toLocaleString('en-IN')} · {notif.paymentMethod} ·{' '}
                              {formatDateTimeIN(notif.createdAt)}
                            </p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                        </button>
                      ))
                    )}
                  </div>

                  <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        setNotifDropdownOpen(false);
                        setEditingProduct(null);
                        setActiveTab('orders');
                      }}
                      className="w-full min-h-[40px] rounded-lg bg-slate-900 hover:bg-indigo-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <span>Open Orders Section</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                void loadDashboardData(true);
                void fetchAdminNotifications();
              }}
              title="Refresh data"
              aria-label="Refresh dashboard data"
              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setActiveTab('bulk');
              }}
              className="hidden sm:inline-flex min-h-[44px] items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
            >
              <UploadCloud className="w-4 h-4 text-indigo-600" />
              <span>Bulk Upload</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setActiveTab('create');
              }}
              className="inline-flex min-h-[44px] items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Add Shoe</span>
            </button>
          </div>
        </header>

        {/* Active View Content */}
        <div className="p-3.5 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewSection
              data={overviewData}
              products={products}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'orders' && (
            <AdminOrdersManager
              initialOrders={overviewData?.orders}
              initialOverview={overviewData?.overview}
              notifications={adminNotifications}
              unreadCount={unreadNotificationsCount}
              pendingOrderNumber={pendingInspectOrderNumber}
              externalSearch={pendingOrdersSearch}
              onClearPendingOrder={handleClearPendingOrder}
              onNotificationsSync={handleNotificationsSync}
              onOrdersUpdated={handleOrdersUpdated}
            />
          )}

          {activeTab === 'products' && (
            <div className="space-y-6">
              <CatalogStats products={products} />
              <ProductList
                products={products}
                categories={categories}
                onEdit={handleStartEdit}
                onRefresh={() => loadDashboardData()}
              />
            </div>
          )}

          {activeTab === 'create' && (
            <div className="max-w-4xl mx-auto">
              <ProductForm
                initialProduct={editingProduct}
                categories={categories}
                onSuccess={handleFormSuccess}
                onCancel={() => {
                  setEditingProduct(null);
                  setActiveTab('products');
                }}
              />
            </div>
          )}

          {activeTab === 'bulk' && (
            <AdminBulkUpload onImportComplete={() => loadDashboardData()} />
          )}

          {activeTab === 'categories' && <CategoriesSection data={overviewData} />}

          {activeTab === 'customers' && (
            <CustomersSection
              data={overviewData}
              isLoading={isLoadingOverview}
              error={overviewError}
              onRefresh={() => void loadDashboardData(true)}
              onInspectOrder={handleInspectOrderFromCustomer}
              onFilterOrdersByCustomer={handleFilterOrdersByCustomer}
            />
          )}

          {activeTab === 'inventory' && (
            <InventorySection
              products={products}
              onRefresh={() => loadDashboardData()}
            />
          )}

          {activeTab === 'payments' && <PaymentsSection data={overviewData} />}

          {activeTab === 'shipping' && <ShippingSection data={overviewData} />}

          {activeTab === 'reports' && (
            <ReportsSection data={overviewData} products={products} />
          )}

          {activeTab === 'settings' && (
            <SettingsSection
              admins={overviewData?.admins || [currentAdmin]}
              currentAdmin={currentAdmin}
              products={products}
              onResetComplete={() => loadDashboardData()}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AdminContent />
    </Suspense>
  );
}

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Product } from '@/lib/data';
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
} from '@/lib/adminAuth';
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
  const [activeTab, setActiveTab] = useState<AdminNavTab>('overview');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const loadDashboardData = useCallback(async (showToast = false) => {
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

      const prodData = await prodRes.json();
      if (prodRes.ok && prodData.success) {
        const list: Product[] = prodData.products || [];
        setProducts(list);
        setCategories(Array.from(new Set(list.map((p) => p.category).filter(Boolean))));
      }

      if (ovRes.ok) {
        const ovJson = await ovRes.json();
        if (ovJson.success) {
          setOverviewData(ovJson);
        }
      }

      if (showToast) {
        toast.success('Admin dashboard refreshed');
      }
    } catch {
      toast.error('Could not load dashboard data');
    }
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
  }, []);

  useEffect(() => {
    if (currentAdmin) {
      loadDashboardData();
    }
  }, [currentAdmin, loadDashboardData]);

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
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-slate-950 text-slate-300 border-r border-slate-800 z-30">
        <div className="h-16 px-5 flex items-center gap-2.5 border-b border-slate-800 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-none">StepStyle</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Admin Operations</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
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
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.id === 'orders' && overviewData && (
                  <span className="tabular-nums text-[11px] opacity-80">
                    {overviewData.overview.totalOrders}
                  </span>
                )}
                {item.id === 'products' && (
                  <span className="tabular-nums text-[11px] opacity-80">
                    {products.length}
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
              {currentAdmin.role} · {currentAdmin.email}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="flex-1 py-2 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Storefront</span>
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="py-2 px-2.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-200 text-xs font-medium flex items-center justify-center gap-1 cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-slate-950 text-slate-300 h-full flex flex-col z-10">
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800">
              <span className="font-bold text-white text-sm">StepStyle Admin</span>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setEditingProduct(null);
                      setActiveTab(item.id);
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium ${
                      isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-800 flex items-center justify-between">
              <Link href="/" className="text-xs text-slate-300 hover:text-white">
                ← Storefront
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-xs text-rose-400 font-semibold"
              >
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700"
              aria-label="Open admin menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
              {activeNavTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => loadDashboardData(true)}
              title="Refresh data"
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setActiveTab('bulk');
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Add Shoe</span>
            </button>
          </div>
        </header>

        {/* Active View Content */}
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && (
            <OverviewSection
              data={overviewData}
              products={products}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'orders' && (
            <AdminOrdersManager onOrdersUpdated={() => loadDashboardData()} />
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

          {activeTab === 'customers' && <CustomersSection data={overviewData} />}

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

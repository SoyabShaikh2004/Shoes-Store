'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Product } from '@/lib/data';
import CatalogStats from '@/components/admin/CatalogStats';
import ProductList from '@/components/admin/ProductList';
import ProductForm from '@/components/admin/ProductForm';
import AdminAuth from '@/components/admin/AdminAuth';
import {
  AdminUser,
  getAdminSession,
  adminSignOut,
  getAdminUsers,
} from '@/lib/adminAuth';
import { toast } from 'react-hot-toast';
import {
  ShieldCheck,
  Plus,
  RefreshCw,
  Eye,
  RotateCcw,
  Download,
  UploadCloud,
  Sliders,
  Package,
  Layers,
  BarChart3,
  Settings,
  Store,
  CheckCircle2,
  LogOut,
  Users,
  UserCheck,
} from 'lucide-react';

function AdminContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [allAdmins, setAllAdmins] = useState<AdminUser[]>([]);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'inventory' | 'create' | 'analytics' | 'settings'>('inventory');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Check existing admin session on mount
  useEffect(() => {
    const session = getAdminSession();
    if (session) {
      setCurrentAdmin(session);
    }
    setAllAdmins(getAdminUsers());
    setIsCheckingAuth(false);
  }, []);

  const handleSignOut = () => {
    adminSignOut();
    setCurrentAdmin(null);
    toast.success('Logged out of Admin Portal');
  };

  // Fetch all products from API
  const fetchProducts = useCallback(async (showToast = false) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/products', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch catalog');

      const fetchedProducts: Product[] = data.products || [];
      setProducts(fetchedProducts);

      // Extract unique categories
      const cats = Array.from(new Set(fetchedProducts.map((p) => p.category).filter(Boolean)));
      setCategories(cats);

      if (showToast) {
        toast.success(`Catalog refreshed! ${fetchedProducts.length} items loaded.`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Could not load products');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Handle URL edit param: ?edit=3
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

  // Handle switching to Edit
  const handleStartEdit = (product: Product) => {
    setEditingProduct(product);
    setActiveTab('create');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle form success
  const handleFormSuccess = () => {
    setEditingProduct(null);
    setActiveTab('inventory');
    fetchProducts();
    router.replace('/admin');
  };

  // Reset to default seed catalog
  const handleResetCatalog = async () => {
    if (
      !window.confirm(
        'Are you sure you want to reset the entire store catalog back to the original 20 default shoes? Any custom uploaded shoes will be overwritten.'
      )
    ) {
      return;
    }

    const toastId = toast.loading('Restoring default catalog template...');
    try {
      const res = await fetch('/api/admin/reset', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Reset failed');

      toast.success('Store inventory reset to default catalog!', { id: toastId });
      fetchProducts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset catalog', { id: toastId });
    }
  };

  // Export catalog as JSON
  const handleExportCatalog = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(products, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `stepstyle-catalog-backup-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success('Catalog JSON exported successfully');
  };

  // Auth loading gate
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-9 h-9 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-gray-400 font-mono tracking-wider">Verifying Admin Access...</p>
        </div>
      </div>
    );
  }

  // Not signed in -> show Admin Auth (Sign In / Sign Up)
  if (!currentAdmin) {
    return (
      <AdminAuth
        onSuccess={(user) => {
          setCurrentAdmin(user);
          setAllAdmins(getAdminUsers());
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/60 pb-16">
      {/* Admin Top App Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Title & Badge */}
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-bold text-gray-900">
                    StepStyle Admin Console
                  </h1>
                  <span className="text-[11px] font-semibold uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                    Backend Portal
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Manage shoe catalog, image uploads, MRP discounts, and storefront customization.
                </p>
              </div>
            </div>

            {/* Quick Actions & Logged-in Admin Badge */}
            <div className="flex items-center flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fetchProducts(true)}
                title="Refresh product list"
                className="p-2 text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <Link
                href="/"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                <Store className="w-3.5 h-3.5 text-gray-500" />
                <span>← Storefront</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  setEditingProduct(null);
                  setActiveTab('create');
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Shoe</span>
              </button>

              {/* Active Admin Session Badge & Sign Out */}
              <div className="flex items-center gap-1.5 pl-2 border-l border-gray-200">
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-xl">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center uppercase shadow-xs">
                    {currentAdmin.name?.charAt(0) || 'S'}
                  </div>
                  <div className="text-left hidden lg:block">
                    <div className="text-xs font-bold text-gray-900 leading-none flex items-center gap-1.5">
                      <span>{currentAdmin.name}</span>
                      <span className="text-[10px] bg-indigo-100 text-indigo-800 font-semibold px-1.5 py-0.5 rounded-full">
                        {currentAdmin.role}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                      {currentAdmin.email}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  title="Sign out of Admin Portal"
                  className="flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center space-x-1 sm:space-x-2 mt-4 pt-2 border-t border-gray-100 overflow-x-auto">
            <button
              type="button"
              onClick={() => {
                setActiveTab('inventory');
                setEditingProduct(null);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'inventory'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Products Catalog ({products.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('create');
              }}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'create'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>{editingProduct ? `Edit Shoe #${editingProduct.id}` : 'Add / Customize Shoe'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'analytics'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Catalog Analytics</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Store Management & Backup</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="container mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Top Summary Banner */}
        <CatalogStats products={products} />

        {/* TAB 1: Inventory List */}
        {activeTab === 'inventory' && (
          <ProductList
            products={products}
            categories={categories}
            onEdit={handleStartEdit}
            onRefresh={() => fetchProducts()}
          />
        )}

        {/* TAB 2: Add / Edit Product Studio */}
        {activeTab === 'create' && (
          <div className="max-w-4xl mx-auto">
            <ProductForm
              initialProduct={editingProduct}
              categories={categories}
              onSuccess={handleFormSuccess}
              onCancel={() => {
                setEditingProduct(null);
                setActiveTab('inventory');
              }}
            />
          </div>
        )}

        {/* TAB 3: Analytics & Breakdown */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Category Distribution & Pricing Breakdown
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((cat) => {
                  const catProducts = products.filter((p) => p.category === cat);
                  const inStock = catProducts.filter((p) => p.inStock).length;
                  const avgPrice = Math.round(
                    catProducts.reduce((acc, p) => acc + (p.price || 0), 0) / (catProducts.length || 1)
                  );
                  const avgMrp = Math.round(
                    catProducts.reduce((acc, p) => acc + (p.mrp || p.price || 0), 0) /
                      (catProducts.length || 1)
                  );

                  return (
                    <div
                      key={cat}
                      className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-gray-900 text-sm">{cat}</span>
                          <span className="text-xs bg-indigo-100 text-indigo-800 font-semibold px-2 py-0.5 rounded-full">
                            {catProducts.length} models
                          </span>
                        </div>
                        <div className="space-y-1 text-xs text-gray-600">
                          <div className="flex justify-between">
                            <span>Available in stock:</span>
                            <span className="font-semibold text-emerald-600">{inStock} / {catProducts.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Avg Selling Price:</span>
                            <span className="font-semibold">₹{avgPrice.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Avg MRP:</span>
                            <span className="text-gray-400 line-through">₹{avgMrp.toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Store Management & Backup */}
        {activeTab === 'settings' && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Admin Team & Access Control */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-gray-900">
                      Administrative Team & Access Control
                    </h3>
                    <span className="text-xs bg-indigo-100 text-indigo-800 font-semibold px-2.5 py-0.5 rounded-full">
                      {allAdmins.length} Active {allAdmins.length === 1 ? 'Admin' : 'Admins'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Authorized staff accounts with console access to modify catalog, inventory, and discounts.
                  </p>
                </div>
                <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                {allAdmins.map((admin) => {
                  const isSoyab = admin.email.toLowerCase() === 'soyxbshxikh@gmail.com';
                  return (
                    <div
                      key={admin.id || admin.email}
                      className="p-4 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-xs uppercase">
                          {admin.name?.charAt(0) || 'A'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-gray-900">{admin.name}</span>
                            {isSoyab && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md border border-amber-200">
                                Primary Super Admin
                              </span>
                            )}
                            <span className="text-[10px] bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
                              {admin.role}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 font-mono mt-0.5">
                            {admin.email}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Active Access</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3.5 text-xs text-indigo-900 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold">Super Admin Clearance: </span>
                  <span>
                    Authenticated Super Administrators have full clearance to manage products, update inventory, upload media, and perform store resets.
                  </span>
                </div>
              </div>
            </div>

            {/* Catalog Backup & Reset Utilities */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 shadow-sm space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Catalog Backup & Reset Utilities
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Export your current products configuration or restore the factory catalog.
                </p>
              </div>

              {/* Export JSON */}
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">Export Catalog Data (JSON)</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Download a full snapshot of all products, images, MRPs, sizes, and colors.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportCatalog}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 hover:border-gray-400 rounded-lg text-xs font-semibold text-gray-700 shadow-xs transition-colors self-start sm:self-auto"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Backup JSON</span>
                </button>
              </div>

              {/* Reset to Default */}
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-rose-900 text-sm">
                    Restore Default Factory Inventory
                  </h4>
                  <p className="text-xs text-rose-700 mt-0.5">
                    Resets the catalog to the initial 20 shoes catalog with default images and MRPs.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetCatalog}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] rounded-lg text-xs font-semibold text-white shadow-xs transition-all self-start sm:self-auto"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Factory Defaults</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-500">Loading Admin Console...</p>
          </div>
        </div>
      }
    >
      <AdminContent />
    </Suspense>
  );
}

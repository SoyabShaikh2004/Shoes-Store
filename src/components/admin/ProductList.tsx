'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Product } from '@/lib/data';
import { getAdminAuthHeaders, handleAdminUnauthorized } from '@/lib/adminAuth';
import { resolveProductImage } from '@/lib/productImages';
import { notifyStorefrontChanged } from '@/lib/storefrontSync';
import { toast } from 'react-hot-toast';
import {
  Search,
  Filter,
  ArrowUpDown,
  Edit2,
  Trash2,
  Copy,
  ExternalLink,
  CheckCircle,
  XCircle,
  LayoutGrid,
  List,
  Sparkles,
  Tag,
  CheckSquare,
  Square,
  X,
} from 'lucide-react';

interface ProductListProps {
  products: Product[];
  categories: string[];
  onEdit: (product: Product) => void;
  onRefresh: () => void;
}

type BulkActionType =
  | 'bulk_edit_price'
  | 'bulk_update_stock'
  | 'bulk_assign_category'
  | 'bulk_assign_brand'
  | 'bulk_update_discount';

export default function ProductList({
  products,
  categories,
  onEdit,
  onRefresh,
}: ProductListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [stockFilter, setStockFilter] = useState<'All' | 'inStock' | 'outOfStock'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'active' | 'inactive'>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'priceAsc' | 'priceDesc' | 'discountDesc'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isUpdatingStock, setIsUpdatingStock] = useState<number | null>(null);

  // Bulk selection & modal states
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [bulkModal, setBulkModal] = useState<BulkActionType | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingDeleteProduct, setPendingDeleteProduct] = useState<{
    id: number;
    name: string;
  } | null>(null);

  // Bulk modal form values
  const [priceMode, setPriceMode] = useState<'fixed' | 'percent_increase' | 'percent_decrease'>('percent_decrease');
  const [priceValue, setPriceValue] = useState('10');
  const [bulkStockVal, setBulkStockVal] = useState('35');
  const [bulkCategoryVal, setBulkCategoryVal] = useState(categories[0] || 'Running');
  const [bulkBrandVal, setBulkBrandVal] = useState('StepStyle');
  const [bulkDiscountVal, setBulkDiscountVal] = useState('15');

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          const matchName = p.name.toLowerCase().includes(q);
          const matchBrand = p.brand?.toLowerCase().includes(q);
          const matchCat = p.category.toLowerCase().includes(q);
          const matchSku = p.sku?.toLowerCase().includes(q);
          const matchId = String(p.id).includes(q);
          if (!matchName && !matchBrand && !matchCat && !matchSku && !matchId) return false;
        }
        if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
        if (stockFilter === 'inStock' && !p.inStock) return false;
        if (stockFilter === 'outOfStock' && p.inStock) return false;
        if (statusFilter === 'active' && p.status === 'inactive') return false;
        if (statusFilter === 'inactive' && p.status !== 'inactive') return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return (b.id || 0) - (a.id || 0);
        if (sortBy === 'priceAsc') return (a.price || 0) - (b.price || 0);
        if (sortBy === 'priceDesc') return (b.price || 0) - (a.price || 0);
        if (sortBy === 'discountDesc') {
          const discA = a.mrp && a.mrp > a.price ? (a.mrp - a.price) / a.mrp : 0;
          const discB = b.mrp && b.mrp > b.price ? (b.mrp - b.price) / b.mrp : 0;
          return discB - discA;
        }
        return 0;
      });
  }, [products, searchTerm, selectedCategory, stockFilter, statusFilter, sortBy]);

  const allFilteredSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((p) => selectedIds.includes(p.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map((p) => p.id));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const getProductImage = resolveProductImage;

  const runBulkAction = async (payload: Record<string, unknown>) => {
    if (selectedIds.length === 0) return;
    setIsBulkRunning(true);
    const toastId = toast.loading(`Applying bulk update to ${selectedIds.length} product(s)...`);

    try {
      const res = await fetch('/api/admin/products/bulk', {
        method: 'POST',
        credentials: 'include',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ...payload, ids: selectedIds }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        handleAdminUnauthorized(res.status);
        throw new Error(data.error || 'Bulk action failed');
      }
      toast.success(data.message || 'Bulk update completed', { id: toastId });
      setBulkModal(null);
      setConfirmDeleteOpen(false);
      setSelectedIds([]);
      notifyStorefrontChanged('products');
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Bulk update failed', {
        id: toastId,
      });
    } finally {
      setIsBulkRunning(false);
    }
  };

  const handleToggleStock = async (product: Product) => {
    setIsUpdatingStock(product.id);
    const newStock = !product.inStock;
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          inStock: newStock,
          stockQuantity: newStock ? Math.max(1, product.stockQuantity || 20) : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        handleAdminUnauthorized(res.status);
        throw new Error(data.error || 'Failed to update stock');
      }

      toast.success(
        `${product.sku || `#${product.id}`} is now ${newStock ? 'In Stock' : 'Out of Stock'}`
      );
      notifyStorefrontChanged('products');
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update stock status');
    } finally {
      setIsUpdatingStock(null);
    }
  };

  const handleDelete = (id: number, name: string) => {
    setPendingDeleteProduct({ id, name });
  };

  const executeSingleDelete = async () => {
    if (!pendingDeleteProduct) return;
    const { id } = pendingDeleteProduct;
    setDeletingId(id);
    const toastId = toast.loading(`Deleting shoe #${id}...`);

    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAdminAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        handleAdminUnauthorized(res.status);
        throw new Error(data.error || 'Failed to delete');
      }

      toast.success(`Shoe #${id} deleted successfully`, { id: toastId });
      setPendingDeleteProduct(null);
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      notifyStorefrontChanged('products');
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete shoe', {
        id: toastId,
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDuplicate = async (product: Product) => {
    const toastId = toast.loading(`Cloning "${product.name}"...`);
    try {
      const { id: _id, sku: origSku, ...copyData } = product;
      const payload = {
        ...copyData,
        sku: origSku ? `${origSku}-COPY-${Math.floor(10 + Math.random() * 89)}` : undefined,
        name: `${product.name} (Copy)`,
      };

      const res = await fetch('/api/admin/products', {
        method: 'POST',
        credentials: 'include',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        handleAdminUnauthorized(res.status);
        throw new Error(data.error || 'Failed to clone');
      }

      toast.success(`Duplicated as "${data.product.name}"!`, { id: toastId });
      notifyStorefrontChanged('products');
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to duplicate product', {
        id: toastId,
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Control Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by shoe name, SKU, category, brand, or ID..."
              className="w-full min-h-[44px] text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-16 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:bg-white transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[36px] px-2 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'All' | 'active' | 'inactive')}
              className="min-h-[44px] text-base sm:text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-medium cursor-pointer focus:outline-none"
            >
              <option value="All">Status: All</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            <div className="min-h-[44px] flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(e.target.value as 'newest' | 'priceAsc' | 'priceDesc' | 'discountDesc')
                }
                className="min-h-[36px] text-base sm:text-xs bg-transparent border-none focus:outline-none text-slate-700 font-medium cursor-pointer"
              >
                <option value="newest">Sort: Newest First</option>
                <option value="priceAsc">Sort: Price (Low → High)</option>
                <option value="priceDesc">Sort: Price (High → Low)</option>
                <option value="discountDesc">Sort: Highest Discount %</option>
              </select>
            </div>

            <div className="flex items-center border border-slate-200 rounded-lg p-1 bg-slate-50 gap-1">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title="Table view"
                aria-label="List view"
                className={`min-w-[38px] min-h-[36px] inline-flex items-center justify-center rounded-md transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title="Cards grid view"
                aria-label="Grid view"
                className={`min-w-[38px] min-h-[36px] inline-flex items-center justify-center rounded-md transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-500 font-medium mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Category:
            </span>
            <button
              type="button"
              onClick={() => setSelectedCategory('All')}
              className={`min-h-[36px] px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                selectedCategory === 'All'
                  ? 'bg-slate-900 text-white border-slate-900 font-medium'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              All ({products.length})
            </button>
            {categories.map((cat) => {
              const count = products.filter((p) => p.category === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`min-h-[36px] px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-slate-900 text-white border-slate-900 font-medium'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-500 font-medium mr-1">Stock:</span>
            <button
              type="button"
              onClick={() => setStockFilter('All')}
              className={`min-h-[36px] px-2.5 py-1 rounded-md cursor-pointer ${
                stockFilter === 'All'
                  ? 'bg-slate-800 text-white font-medium'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStockFilter('inStock')}
              className={`min-h-[36px] px-2.5 py-1 rounded-md cursor-pointer ${
                stockFilter === 'inStock'
                  ? 'bg-emerald-600 text-white font-medium'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              In Stock
            </button>
            <button
              type="button"
              onClick={() => setStockFilter('outOfStock')}
              className={`min-h-[36px] px-2.5 py-1 rounded-md cursor-pointer ${
                stockFilter === 'outOfStock'
                  ? 'bg-rose-600 text-white font-medium'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              Out of Stock
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Product Management Action Bar */}
      {selectedIds.length > 0 && (
        <div className="bg-slate-900 text-white px-4 py-3 rounded-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
            <CheckSquare className="w-4 h-4 text-indigo-400" />
            <span className="tabular-nums">{selectedIds.length} shoe(s) selected</span>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="min-h-[36px] px-2 text-xs text-slate-400 hover:text-white underline cursor-pointer ml-1"
            >
              Clear
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              disabled={isBulkRunning}
              onClick={() => setBulkModal('bulk_edit_price')}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 font-medium cursor-pointer whitespace-nowrap"
            >
              Edit Price
            </button>
            <button
              type="button"
              disabled={isBulkRunning}
              onClick={() => setBulkModal('bulk_update_stock')}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 font-medium cursor-pointer whitespace-nowrap"
            >
              Update Stock
            </button>
            <button
              type="button"
              disabled={isBulkRunning}
              onClick={() => setBulkModal('bulk_update_discount')}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 font-medium cursor-pointer whitespace-nowrap"
            >
              Set Discount
            </button>
            <button
              type="button"
              disabled={isBulkRunning}
              onClick={() => setBulkModal('bulk_assign_category')}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 font-medium cursor-pointer whitespace-nowrap"
            >
              Assign Category
            </button>
            <button
              type="button"
              disabled={isBulkRunning}
              onClick={() => setBulkModal('bulk_assign_brand')}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 font-medium cursor-pointer whitespace-nowrap"
            >
              Assign Brand
            </button>
            <button
              type="button"
              disabled={isBulkRunning}
              onClick={() => runBulkAction({ action: 'bulk_activate' })}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 font-semibold cursor-pointer whitespace-nowrap"
            >
              Activate
            </button>
            <button
              type="button"
              disabled={isBulkRunning}
              onClick={() => runBulkAction({ action: 'bulk_deactivate' })}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 font-semibold cursor-pointer whitespace-nowrap"
            >
              Deactivate
            </button>
            <button
              type="button"
              disabled={isBulkRunning}
              onClick={() => setConfirmDeleteOpen(true)}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 font-semibold cursor-pointer whitespace-nowrap"
            >
              Delete ({selectedIds.length})
            </button>
          </div>
        </div>
      )}

      {/* Product Display */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Tag className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 mb-1">No shoes found</h3>
          <p className="text-sm text-slate-500 mb-4">
            Try adjusting your search query, category filter, or stock status.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('All');
              setStockFilter('All');
              setStatusFilter('All');
            }}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg cursor-pointer"
          >
            Clear all filters
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Mobile & Tablet Card List */}
          <div className="lg:hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-600">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="min-h-[36px] inline-flex items-center gap-2 text-slate-700 cursor-pointer"
              >
                {allFilteredSelected ? (
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>Select All ({filteredProducts.length})</span>
              </button>
              <span className="tabular-nums text-slate-500">Tap stock badge to toggle</span>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredProducts.map((product) => {
                const hasDiscount = product.mrp && product.mrp > product.price;
                const discountPercent = hasDiscount
                  ? Math.round(((product.mrp! - product.price) / product.mrp!) * 100)
                  : 0;
                const isSelected = selectedIds.includes(product.id);
                const isInactive = product.status === 'inactive';

                return (
                  <div
                    key={product.id}
                    className={`p-4 space-y-3 ${isSelected ? 'bg-indigo-50/40' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(product.id)}
                        aria-label={`Select ${product.name}`}
                        className="mt-1 h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                      />
                      <div className="relative w-14 h-14 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 shrink-0">
                        <Image
                          src={getProductImage(product)}
                          alt={product.name}
                          fill
                          referrerPolicy="no-referrer"
                          className="object-contain p-1"
                          unoptimized={getProductImage(product).startsWith('data:')}
                        />
                        {product.featured && (
                          <div className="absolute top-0.5 left-0.5 bg-amber-500 text-white rounded p-0.5">
                            <Sparkles className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-slate-900 truncate">
                              {product.name}
                            </div>
                            <div className="text-xs text-slate-500 font-mono truncate">
                              {product.sku || `STEP-${String(product.id).padStart(4, '0')}`} ·{' '}
                              <span className="font-sans">{product.category}</span>
                            </div>
                          </div>
                          <span
                            className={`text-[11px] font-semibold shrink-0 ${
                              isInactive ? 'text-slate-400' : 'text-emerald-700'
                            }`}
                          >
                            {isInactive ? 'Inactive' : 'Active'}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-baseline gap-2 tabular-nums">
                          <span className="text-sm font-bold text-slate-900">
                            ₹{product.price.toLocaleString('en-IN')}
                          </span>
                          {hasDiscount && (
                            <>
                              <span className="text-xs text-slate-400 line-through">
                                ₹{product.mrp!.toLocaleString('en-IN')}
                              </span>
                              <span className="text-xs font-semibold text-rose-700">
                                {discountPercent}% OFF
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isUpdatingStock === product.id}
                        onClick={() => handleToggleStock(product)}
                        className={`min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors tabular-nums ${
                          product.inStock
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        {product.inStock ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{product.stockQuantity ?? 25} qty</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Out of Stock</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/products/${product.id}`}
                          target="_blank"
                          title="Preview on Storefront"
                          aria-label={`Preview ${product.name}`}
                          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-slate-500 hover:text-indigo-600 rounded-lg border border-slate-200 hover:bg-indigo-50 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDuplicate(product)}
                          title="Duplicate Shoe"
                          aria-label={`Duplicate ${product.name}`}
                          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(product)}
                          title="Edit Shoe Details"
                          aria-label={`Edit ${product.name}`}
                          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-indigo-600 hover:text-indigo-800 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === product.id}
                          onClick={() => handleDelete(product.id, product.name)}
                          title="Delete Shoe"
                          aria-label={`Delete ${product.name}`}
                          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-rose-600 hover:text-rose-700 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="py-3 pl-4 pr-2 w-10">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      title="Select all visible shoes"
                      className="text-slate-500 hover:text-indigo-600 cursor-pointer"
                    >
                      {allFilteredSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th scope="col" className="py-3 px-4">Shoe & SKU</th>
                  <th scope="col" className="py-3 px-4">Category / Gender</th>
                  <th scope="col" className="py-3 px-4">Price & MRP</th>
                  <th scope="col" className="py-3 px-4">Discount</th>
                  <th scope="col" className="py-3 px-4">Inventory</th>
                  <th scope="col" className="py-3 px-4">Visibility</th>
                  <th scope="col" className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((product) => {
                  const hasDiscount = product.mrp && product.mrp > product.price;
                  const discountPercent = hasDiscount
                    ? Math.round(((product.mrp! - product.price) / product.mrp!) * 100)
                    : 0;
                  const isSelected = selectedIds.includes(product.id);
                  const isInactive = product.status === 'inactive';

                  return (
                    <tr
                      key={product.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      <td className="py-3 pl-4 pr-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(product.id)}
                          aria-label={`Select ${product.name}`}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-12 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 shrink-0 flex items-center justify-center">
                            <Image
                              src={getProductImage(product)}
                              alt={product.name}
                              fill
                              referrerPolicy="no-referrer"
                              className="object-contain p-1"
                              unoptimized={getProductImage(product).startsWith('data:')}
                            />
                            {product.featured && (
                              <div className="absolute top-0.5 left-0.5 bg-amber-500 text-white rounded p-0.5">
                                <Sparkles className="w-2.5 h-2.5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate max-w-[240px]">
                              {product.name}
                            </div>
                            <div className="text-xs text-slate-500 font-mono truncate">
                              {product.sku || `STEP-${String(product.id).padStart(4, '0')}`} ·{' '}
                              <span className="font-sans">{product.brand || 'StepStyle'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-xs">
                        <div className="font-medium text-slate-900">{product.category}</div>
                        <div className="text-slate-500">
                          {product.gender || 'Men'} · {product.shoeType || product.category}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap tabular-nums">
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold text-slate-900">
                            ₹{product.price.toLocaleString('en-IN')}
                          </span>
                          {hasDiscount && (
                            <span className="text-xs text-slate-400 line-through">
                              ₹{product.mrp!.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap tabular-nums">
                        {discountPercent > 0 ? (
                          <span className="text-xs font-semibold text-rose-700">
                            {discountPercent}% OFF
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          disabled={isUpdatingStock === product.id}
                          onClick={() => handleToggleStock(product)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border cursor-pointer transition-colors tabular-nums ${
                            product.inStock
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          }`}
                          title="Click to toggle stock status"
                        >
                          {product.inStock ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{product.stockQuantity ?? 25} qty</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              <span>Out of Stock</span>
                            </>
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-xs">
                        <span
                          className={`font-semibold ${
                            isInactive ? 'text-slate-400' : 'text-emerald-700'
                          }`}
                        >
                          {isInactive ? 'Inactive' : 'Active'}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/products/${product.id}`}
                            target="_blank"
                            title="Preview on Storefront"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDuplicate(product)}
                            title="Duplicate Shoe"
                            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEdit(product)}
                            title="Edit Shoe Details"
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 rounded-md hover:bg-indigo-50 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === product.id}
                            onClick={() => handleDelete(product.id, product.name)}
                            title="Delete Shoe"
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((product) => {
            const hasDiscount = product.mrp && product.mrp > product.price;
            const discountPercent = hasDiscount
              ? Math.round(((product.mrp! - product.price) / product.mrp!) * 100)
              : 0;
            const isSelected = selectedIds.includes(product.id);

            return (
              <div
                key={product.id}
                className={`bg-white rounded-xl border overflow-hidden flex flex-col justify-between transition-colors ${
                  isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="relative aspect-square bg-slate-50 flex items-center justify-center p-3 border-b border-slate-100">
                    <Image
                      src={getProductImage(product)}
                      alt={product.name}
                      fill
                      referrerPolicy="no-referrer"
                      className="object-contain p-2"
                      unoptimized={getProductImage(product).startsWith('data:')}
                    />
                    <div className="absolute top-2 left-2 z-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(product.id)}
                        className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </div>
                    <div className="absolute top-2 right-2">
                      <button
                        type="button"
                        onClick={() => handleToggleStock(product)}
                        className={`min-h-[32px] text-[11px] font-semibold px-2.5 py-1 rounded border cursor-pointer tabular-nums ${
                          product.inStock
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {product.inStock ? `${product.stockQuantity ?? 25} qty` : 'Out of Stock'}
                      </button>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="text-xs text-slate-500 font-mono mb-1">
                      {product.sku || `#${product.id}`} · {product.category}
                    </div>
                    <h4 className="font-semibold text-slate-900 text-sm line-clamp-1 mb-2">
                      {product.name}
                    </h4>
                    <div className="flex items-baseline gap-2 tabular-nums">
                      <span className="text-base font-bold text-slate-900">
                        ₹{product.price.toLocaleString('en-IN')}
                      </span>
                      {hasDiscount && (
                        <>
                          <span className="text-xs text-slate-400 line-through">
                            ₹{product.mrp!.toLocaleString('en-IN')}
                          </span>
                          <span className="text-xs font-semibold text-rose-700">
                            {discountPercent}% OFF
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-1">
                  <Link
                    href={`/products/${product.id}`}
                    target="_blank"
                    className="min-h-[40px] text-xs text-slate-600 hover:text-indigo-600 flex items-center gap-1 font-medium px-2.5 py-1.5 rounded-lg hover:bg-white transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Preview
                  </Link>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDuplicate(product)}
                      className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-lg hover:bg-white cursor-pointer"
                      aria-label={`Duplicate ${product.name}`}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(product)}
                      className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-indigo-600 hover:text-indigo-800 rounded-lg hover:bg-white cursor-pointer"
                      aria-label={`Edit ${product.name}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(product.id, product.name)}
                      className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-rose-500 hover:text-rose-700 rounded-lg hover:bg-white cursor-pointer"
                      aria-label={`Delete ${product.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bulk Action Modals */}
      {bulkModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full max-h-[90dvh] overflow-y-auto p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Bulk Update ({selectedIds.length} products)
              </h3>
              <button
                type="button"
                onClick={() => setBulkModal(null)}
                aria-label="Close modal"
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {bulkModal === 'bulk_edit_price' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Adjustment Mode
                  </label>
                  <select
                    value={priceMode}
                    onChange={(e) =>
                      setPriceMode(
                        e.target.value as 'fixed' | 'percent_increase' | 'percent_decrease'
                      )
                    }
                    className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-lg"
                  >
                    <option value="percent_decrease">Decrease Price by %</option>
                    <option value="percent_increase">Increase Price by %</option>
                    <option value="fixed">Set Fixed Selling Price (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {priceMode === 'fixed' ? 'New Selling Price (₹)' : 'Percentage (%)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={priceValue}
                    onChange={(e) => setPriceValue(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setBulkModal(null)}
                    className="min-h-[44px] px-4 py-2 text-xs font-semibold bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isBulkRunning}
                    onClick={() =>
                      runBulkAction({
                        action: 'bulk_edit_price',
                        mode: priceMode,
                        value: Number(priceValue),
                      })
                    }
                    className="min-h-[44px] px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg cursor-pointer"
                  >
                    Apply Prices
                  </button>
                </div>
              </div>
            )}

            {bulkModal === 'bulk_update_stock' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    New Stock Quantity per Shoe
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={bulkStockVal}
                    onChange={(e) => setBulkStockVal(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setBulkModal(null)}
                    className="min-h-[44px] px-4 py-2 text-xs font-semibold bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isBulkRunning}
                    onClick={() =>
                      runBulkAction({
                        action: 'bulk_update_stock',
                        stockQuantity: Number(bulkStockVal),
                      })
                    }
                    className="min-h-[44px] px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg cursor-pointer"
                  >
                    Update Stock
                  </button>
                </div>
              </div>
            )}

            {bulkModal === 'bulk_update_discount' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Discount % Off MRP (0 - 90%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="90"
                    value={bulkDiscountVal}
                    onChange={(e) => setBulkDiscountVal(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setBulkModal(null)}
                    className="min-h-[44px] px-4 py-2 text-xs font-semibold bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isBulkRunning}
                    onClick={() =>
                      runBulkAction({
                        action: 'bulk_update_discount',
                        discountPercentage: Number(bulkDiscountVal),
                      })
                    }
                    className="min-h-[44px] px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg cursor-pointer"
                  >
                    Apply Discount
                  </button>
                </div>
              </div>
            )}

            {bulkModal === 'bulk_assign_category' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Category
                  </label>
                  <input
                    type="text"
                    value={bulkCategoryVal}
                    onChange={(e) => setBulkCategoryVal(e.target.value)}
                    placeholder="e.g. Running, Basketball, Sneakers"
                    className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setBulkModal(null)}
                    className="min-h-[44px] px-4 py-2 text-xs font-semibold bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isBulkRunning}
                    onClick={() =>
                      runBulkAction({
                        action: 'bulk_assign_category',
                        category: bulkCategoryVal.trim(),
                      })
                    }
                    className="min-h-[44px] px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg cursor-pointer"
                  >
                    Assign Category
                  </button>
                </div>
              </div>
            )}

            {bulkModal === 'bulk_assign_brand' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Brand
                  </label>
                  <input
                    type="text"
                    value={bulkBrandVal}
                    onChange={(e) => setBulkBrandVal(e.target.value)}
                    placeholder="e.g. StepStyle Elite"
                    className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setBulkModal(null)}
                    className="min-h-[44px] px-4 py-2 text-xs font-semibold bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isBulkRunning}
                    onClick={() =>
                      runBulkAction({
                        action: 'bulk_assign_brand',
                        brand: bulkBrandVal.trim(),
                      })
                    }
                    className="min-h-[44px] px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg cursor-pointer"
                  >
                    Assign Brand
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      {confirmDeleteOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Delete {selectedIds.length} Selected Shoe(s)?
            </h3>
            <p className="text-sm text-slate-600">
              This action permanently removes the selected shoes, their variant matrices, and catalog entries. It cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBulkRunning}
                onClick={() => runBulkAction({ action: 'bulk_delete' })}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer"
              >
                {isBulkRunning ? 'Deleting...' : 'Confirm Bulk Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Shoe Delete Confirmation Dialog */}
      {pendingDeleteProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Delete &ldquo;{pendingDeleteProduct.name}&rdquo;?
            </h3>
            <p className="text-sm text-slate-600">
              This will permanently remove shoe ID #{pendingDeleteProduct.id} from the live storefront catalog. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deletingId === pendingDeleteProduct.id}
                onClick={() => setPendingDeleteProduct(null)}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingId === pendingDeleteProduct.id}
                onClick={executeSingleDelete}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg cursor-pointer"
              >
                {deletingId === pendingDeleteProduct.id ? 'Deleting...' : 'Delete Shoe'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

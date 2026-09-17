'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Product } from '@/lib/data';
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
  AlertTriangle,
} from 'lucide-react';

interface ProductListProps {
  products: Product[];
  categories: string[];
  onEdit: (product: Product) => void;
  onRefresh: () => void;
}

export default function ProductList({
  products,
  categories,
  onEdit,
  onRefresh,
}: ProductListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [stockFilter, setStockFilter] = useState<'All' | 'inStock' | 'outOfStock'>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'priceAsc' | 'priceDesc' | 'discountDesc'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isUpdatingStock, setIsUpdatingStock] = useState<number | null>(null);

  // Filter & Sort Logic
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        // Search
        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          const matchName = p.name.toLowerCase().includes(q);
          const matchBrand = p.brand?.toLowerCase().includes(q);
          const matchCat = p.category.toLowerCase().includes(q);
          const matchId = String(p.id).includes(q);
          if (!matchName && !matchBrand && !matchCat && !matchId) return false;
        }

        // Category
        if (selectedCategory !== 'All' && p.category !== selectedCategory) {
          return false;
        }

        // Stock
        if (stockFilter === 'inStock' && !p.inStock) return false;
        if (stockFilter === 'outOfStock' && p.inStock) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return (b.id || 0) - (a.id || 0);
        }
        if (sortBy === 'priceAsc') {
          return (a.price || 0) - (b.price || 0);
        }
        if (sortBy === 'priceDesc') {
          return (b.price || 0) - (a.price || 0);
        }
        if (sortBy === 'discountDesc') {
          const discA = a.mrp && a.mrp > a.price ? (a.mrp - a.price) / a.mrp : 0;
          const discB = b.mrp && b.mrp > b.price ? (b.mrp - b.price) / b.mrp : 0;
          return discB - discA;
        }
        return 0;
      });
  }, [products, searchTerm, selectedCategory, stockFilter, sortBy]);

  // Image helper
  const getProductImage = (product: Product) => {
    if (product.images && product.images.length > 0 && product.images[0]) {
      return product.images[0];
    }
    if (
      product.imagePath &&
      (product.imagePath.startsWith('/uploads/') ||
        product.imagePath.startsWith('http') ||
        product.imagePath.startsWith('data:') ||
        /\.(jpg|jpeg|png|webp|svg)$/i.test(product.imagePath))
    ) {
      return product.imagePath;
    }
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
    const format = productFormats[product.id] || '.jpg';
    return `${product.imagePath}/HomeProduct${format}`;
  };

  // Toggle inStock status inline
  const handleToggleStock = async (product: Product) => {
    setIsUpdatingStock(product.id);
    const newStock = !product.inStock;
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inStock: newStock }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update stock');

      toast.success(
        `#${product.id} ${product.name} is now ${newStock ? 'In Stock' : 'Out of Stock'}`
      );
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update stock status');
    } finally {
      setIsUpdatingStock(null);
    }
  };

  // Delete product
  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${name}" (ID #${id}) from the catalog?`)) {
      return;
    }

    setDeletingId(id);
    const toastId = toast.loading(`Deleting shoe #${id}...`);

    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete');

      toast.success(`Shoe #${id} deleted successfully`, { id: toastId });
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete shoe', { id: toastId });
    } finally {
      setDeletingId(null);
    }
  };

  // Duplicate product
  const handleDuplicate = async (product: Product) => {
    const toastId = toast.loading(`Cloning "${product.name}"...`);
    try {
      const { id, ...copyData } = product;
      const payload = {
        ...copyData,
        name: `${product.name} (Copy)`,
      };

      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to clone');

      toast.success(`Duplicated as "${data.product.name}"!`, { id: toastId });
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to duplicate product', { id: toastId });
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Bar: Search, Filters, Sorters */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by shoe name, category, brand, or ID..."
              className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
              >
                Clear
              </button>
            )}
          </div>

          {/* Sort & View Mode controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-500" />
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="text-xs bg-transparent border-none focus:outline-none text-gray-700 font-medium cursor-pointer"
              >
                <option value="newest">Sort: Newest First</option>
                <option value="priceAsc">Sort: Price (Low → High)</option>
                <option value="priceDesc">Sort: Price (High → Low)</option>
                <option value="discountDesc">Sort: Highest Discount %</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center border border-gray-200 rounded-xl p-1 bg-gray-50">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title="Table view"
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'table' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title="Cards grid view"
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 text-xs">
          {/* Category Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-gray-500 font-medium mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Category:
            </span>
            <button
              type="button"
              onClick={() => setSelectedCategory('All')}
              className={`px-2.5 py-1 rounded-full transition-all ${
                selectedCategory === 'All'
                  ? 'bg-indigo-600 text-white font-medium shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                  className={`px-2.5 py-1 rounded-full transition-all ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white font-medium shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>

          {/* Stock Filter Chips */}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 font-medium mr-1">Stock:</span>
            <button
              type="button"
              onClick={() => setStockFilter('All')}
              className={`px-2 py-0.5 rounded-md ${
                stockFilter === 'All' ? 'bg-gray-800 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStockFilter('inStock')}
              className={`px-2 py-0.5 rounded-md ${
                stockFilter === 'inStock' ? 'bg-emerald-600 text-white font-medium' : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              In Stock
            </button>
            <button
              type="button"
              onClick={() => setStockFilter('outOfStock')}
              className={`px-2 py-0.5 rounded-md ${
                stockFilter === 'outOfStock' ? 'bg-rose-600 text-white font-medium' : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              Out of Stock
            </button>
          </div>
        </div>
      </div>

      {/* Product Display */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-900 mb-1">No shoes found</h3>
          <p className="text-sm text-gray-500 mb-4">
            Try adjusting your search query, category filter, or stock status.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('All');
              setStockFilter('All');
            }}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg"
          >
            Clear all filters
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/75 border-b border-gray-200 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th scope="col" className="py-3.5 px-4">Shoe</th>
                  <th scope="col" className="py-3.5 px-4">Category</th>
                  <th scope="col" className="py-3.5 px-4">Selling Price & MRP</th>
                  <th scope="col" className="py-3.5 px-4">Discount</th>
                  <th scope="col" className="py-3.5 px-4">Stock</th>
                  <th scope="col" className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((product) => {
                  const hasDiscount = product.mrp && product.mrp > product.price;
                  const discountPercent = hasDiscount
                    ? Math.round(((product.mrp! - product.price) / product.mrp!) * 100)
                    : 0;

                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-gray-50/60 transition-colors group"
                    >
                      {/* Product Thumbnail & Title */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-14 h-14 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex-shrink-0 flex items-center justify-center">
                            <Image
                              src={getProductImage(product)}
                              alt={product.name}
                              fill
                              className="object-contain p-1"
                              unoptimized={getProductImage(product).startsWith('data:')}
                            />
                            {product.featured && (
                              <div className="absolute top-1 left-1 bg-amber-500 text-white rounded-full p-0.5">
                                <Sparkles className="w-2.5 h-2.5" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-gray-400">#{product.id}</span>
                              <span className="font-semibold text-gray-900 truncate hover:text-indigo-600">
                                {product.name}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {product.brand || 'StepStyle'} • {product.sizes?.length || 0} sizes • {product.colors?.length || 0} colors
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {product.category}
                        </span>
                      </td>

                      {/* Pricing with MRP */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold text-gray-900 text-base">
                            ₹{product.price.toLocaleString('en-IN')}
                          </span>
                          {hasDiscount && (
                            <span className="text-xs text-gray-400 line-through">
                              ₹{product.mrp!.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          MRP: ₹{(product.mrp || product.price).toLocaleString('en-IN')}
                        </div>
                      </td>

                      {/* Discount Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {discountPercent > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            {discountPercent}% OFF
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      {/* Stock Status with quick toggle */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          disabled={isUpdatingStock === product.id}
                          onClick={() => handleToggleStock(product)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                            product.inStock
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                          }`}
                          title="Click to toggle stock status"
                        >
                          {product.inStock ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span>In Stock</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              <span>Out of Stock</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/products/${product.id}`}
                            target="_blank"
                            title="Preview on Storefront"
                            className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDuplicate(product)}
                            title="Duplicate Shoe"
                            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEdit(product)}
                            title="Edit Shoe Details"
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 rounded-lg hover:bg-indigo-50 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === product.id}
                            onClick={() => handleDelete(product.id, product.name)}
                            title="Delete Shoe"
                            className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
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
        /* GRID CARDS VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredProducts.map((product) => {
            const hasDiscount = product.mrp && product.mrp > product.price;
            const discountPercent = hasDiscount
              ? Math.round(((product.mrp! - product.price) / product.mrp!) * 100)
              : 0;

            return (
              <div
                key={product.id}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="relative aspect-square bg-gray-50 flex items-center justify-center p-3 border-b border-gray-100">
                    <Image
                      src={getProductImage(product)}
                      alt={product.name}
                      fill
                      className="object-contain p-2"
                      unoptimized={getProductImage(product).startsWith('data:')}
                    />

                    {/* Top Badges */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                      {discountPercent > 0 && (
                        <span className="bg-rose-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
                          {discountPercent}% OFF
                        </span>
                      )}
                      {product.featured && (
                        <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
                          Featured
                        </span>
                      )}
                    </div>

                    <div className="absolute top-2 right-2">
                      <button
                        type="button"
                        onClick={() => handleToggleStock(product)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow border transition-colors ${
                          product.inStock
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        {product.inStock ? 'In Stock' : 'Out of Stock'}
                      </button>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>#{product.id} • {product.brand || 'StepStyle'}</span>
                      <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-medium">
                        {product.category}
                      </span>
                    </div>

                    <h4 className="font-semibold text-gray-900 text-sm line-clamp-1 mb-2">
                      {product.name}
                    </h4>

                    {/* Price with MRP */}
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-lg font-bold text-gray-900">
                        ₹{product.price.toLocaleString('en-IN')}
                      </span>
                      {hasDiscount && (
                        <span className="text-xs text-gray-400 line-through">
                          MRP ₹{product.mrp!.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-1">
                  <Link
                    href={`/products/${product.id}`}
                    target="_blank"
                    className="text-xs text-gray-500 hover:text-indigo-600 flex items-center gap-1 font-medium px-2 py-1 rounded hover:bg-white transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Preview
                  </Link>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDuplicate(product)}
                      title="Duplicate"
                      className="p-1.5 text-gray-500 hover:text-gray-800 rounded hover:bg-white transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(product)}
                      title="Edit"
                      className="p-1.5 text-indigo-600 hover:text-indigo-800 rounded hover:bg-white transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(product.id, product.name)}
                      title="Delete"
                      className="p-1.5 text-rose-500 hover:text-rose-700 rounded hover:bg-white transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

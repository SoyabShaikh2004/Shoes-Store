'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, X, ArrowRight, RotateCcw } from 'lucide-react';
import { Product } from '@/lib/data';
import ImageCarousel, { HeroSlideItem } from '@/components/ImageCarousel';
import ProductCard from '@/components/ProductCard';

interface HomeMobileShopShellProps {
  products: Product[];
  heroBanners?: HeroSlideItem[];
}

export default function HomeMobileShopShell({ products, heroBanners }: HomeMobileShopShellProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');

  const tabs = [
    { id: 'all', label: 'All Shoes' },
    { id: 'bestsellers', label: 'Best Sellers' },
    { id: 'Running', label: 'Running' },
    { id: 'Casual', label: 'Casual' },
    { id: 'Sports', label: 'Sports' },
    { id: 'Formal', label: 'Formal' },
  ];

  // Only list active & purchasable products first
  const activeCatalog = useMemo(
    () => products.filter((p) => p.status !== 'inactive' && p.inStock && (p.stockQuantity ?? 1) > 0),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    let list = activeCatalog;
    if (activeTab === 'bestsellers') {
      list = list.filter((p) => p.featured || (p.mrp && p.mrp > p.price));
    } else if (activeTab !== 'all') {
      list = list.filter((p) => p.category.toLowerCase() === activeTab.toLowerCase());
    }

    if (query) {
      list = list.filter((p) => {
        const haystack = [
          p.name,
          p.brand || '',
          p.category,
          p.shoeType || '',
          p.gender || '',
          ...(p.tags || []),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      });
      return list.slice(0, 12);
    }

    return list.slice(0, 8);
  }, [activeCatalog, activeTab, searchQuery]);

  const isSearching = searchQuery.trim().length > 0;

  return (
    <div className="bg-white">
      {/* 1. Instant Search Strip (Mobile-First Top Action) */}
      <section className="border-b border-slate-100 bg-white">
        <div className="container mx-auto px-4 max-w-7xl py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search running, casual, sneakers, size..."
                aria-label="Search shoes"
                className="w-full min-h-[44px] pl-10 pr-10 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
              {isSearching && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <Link
              href="/products"
              className="hidden sm:inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 whitespace-nowrap shrink-0 transition-colors"
            >
              <span>Full Catalog ({activeCatalog.length})</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Tall Mobile Hero Banner (Collapses while actively searching on mobile so shoes snap to top) */}
      {!isSearching && (
        <section className="px-3.5 pt-3 sm:px-0 sm:pt-0">
          <ImageCarousel slides={heroBanners} />
        </section>
      )}

      {/* 3. Immediate Category Tabs + 2-Column Mobile Shoe Grid */}
      <section className="py-5 sm:py-10 md:py-12 bg-slate-50/70 border-b border-slate-200/70">
        <div className="container mx-auto px-3.5 sm:px-4 max-w-7xl">
          {/* Concise Header */}
          <div className="flex items-end justify-between gap-4 mb-4 sm:mb-6">
            <div>
              <h1 className="text-lg sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight text-balance">
                {isSearching
                  ? `Search Results (${filteredProducts.length})`
                  : 'Order Ready-to-Ship Shoes'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Tap Quick Buy on any pair to pick your UK size and check out in seconds.
              </p>
            </div>

            <Link
              href="/products"
              className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-indigo-600 hover:text-indigo-800 whitespace-nowrap shrink-0 py-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Segmented Horizontal Category Tabs */}
          <div
            role="tablist"
            aria-label="Filter shoes by category"
            className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 sm:mb-6 no-scrollbar"
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* 2-Column Mobile Grid -> 3/4-Column Tablet & Desktop Grid */}
          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center max-w-md mx-auto">
              <p className="text-sm font-bold text-slate-800">
                No matching in-stock shoes found.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Try clearing your search or switching to All Shoes.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveTab('all');
                  }}
                  className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Filters</span>
                </button>
                <Link
                  href="/products"
                  className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs font-bold"
                >
                  <span>Browse Full Catalog</span>
                </Link>
              </div>
            </div>
          )}

          {/* Bottom Catalog Action */}
          <div className="mt-6 sm:mt-10 text-center">
            <Link
              href={
                isSearching
                  ? `/products?search=${encodeURIComponent(searchQuery.trim())}`
                  : activeTab !== 'all' && activeTab !== 'bestsellers'
                  ? `/products?category=${encodeURIComponent(activeTab)}`
                  : '/products'
              }
              className="inline-flex items-center justify-center gap-2 min-h-[48px] bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-7 py-3 rounded-xl shadow-sm transition-all active:scale-[0.98]"
            >
              <span>Explore All {activeCatalog.length} Available Pairs</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

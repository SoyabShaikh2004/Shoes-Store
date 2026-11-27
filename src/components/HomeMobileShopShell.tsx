'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, X, ArrowRight, RotateCcw } from 'lucide-react';
import { Product } from '@/lib/data';
import ImageCarousel, { HeroSlideItem } from '@/components/ImageCarousel';
import ProductCard from '@/components/ProductCard';
import { subscribeStorefrontChanges } from '@/lib/storefrontSync';

interface HomeMobileShopShellProps {
  products: Product[];
  heroBanners?: HeroSlideItem[];
}

export default function HomeMobileShopShell({ products, heroBanners }: HomeMobileShopShellProps) {
  const [liveProducts, setLiveProducts] = useState<Product[]>(products);
  const [liveBanners, setLiveBanners] = useState<HeroSlideItem[] | undefined>(heroBanners);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const lastSyncRef = useRef<number>(0);

  useEffect(() => {
    setLiveProducts(products);
  }, [products]);

  useEffect(() => {
    setLiveBanners(heroBanners);
  }, [heroBanners]);

  const refreshStorefront = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastSyncRef.current < 1200) return;
    lastSyncRef.current = now;
    try {
      const res = await fetch('/api/storefront', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data?.success) {
        if (Array.isArray(data.products)) {
          setLiveProducts(data.products);
        }
        if (Array.isArray(data.heroBanners)) {
          setLiveBanners(data.heroBanners);
        }
      }
    } catch {
      // ignore transient network errors
    }
  }, []);

  useEffect(() => {
    void refreshStorefront(true);
    const unsubscribe = subscribeStorefrontChanges(() => {
      void refreshStorefront(true);
    });

    const handleFocus = () => {
      void refreshStorefront(false);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshStorefront(false);
      }
    };

    const pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshStorefront(false);
      }
    }, 4500);

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubscribe();
      clearInterval(pollTimer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshStorefront]);

  // Only list active & purchasable products first
  const activeCatalog = useMemo(
    () =>
      liveProducts.filter(
        (p) => p.status !== 'inactive' && p.inStock && (p.stockQuantity ?? 1) > 0
      ),
    [liveProducts]
  );

  const tabs = useMemo(() => {
    const core = [
      { id: 'all', label: 'All Shoes' },
      { id: 'bestsellers', label: 'Best Sellers' },
      { id: 'Running', label: 'Running' },
      { id: 'Casual', label: 'Casual' },
      { id: 'Sports', label: 'Sports' },
      { id: 'Formal', label: 'Formal' },
    ];
    const known = new Set(core.map((t) => t.id.toLowerCase()));
    known.add('walking');

    const extraTabs: Array<{ id: string; label: string }> = [];
    for (const p of activeCatalog) {
      const cat = (p.category || '').trim();
      if (!cat) continue;
      if (!known.has(cat.toLowerCase())) {
        known.add(cat.toLowerCase());
        extraTabs.push({ id: cat, label: cat });
      }
    }
    return [...core, ...extraTabs];
  }, [activeCatalog]);

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
    }

    return list;
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
                className="w-full min-h-[44px] pl-10 pr-10 py-2 text-base sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
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

      {/* 2. Contained Rounded Hero Banner (Collapses while actively searching so shoes snap to top) */}
      {!isSearching && (
        <section className="container mx-auto max-w-7xl px-3.5 sm:px-4 pt-3 sm:pt-4 pb-1">
          <ImageCarousel slides={liveBanners} />
        </section>
      )}

      {/* 3. Immediate Category Tabs + Full 2-Column Mobile Shoe Grid */}
      <section className="py-5 sm:py-8 md:py-10 bg-slate-50/70">
        <div className="container mx-auto px-3.5 sm:px-4 max-w-7xl">
          <h1 className="sr-only">StepStyle Footwear Collection</h1>

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
        </div>
      </section>
    </div>
  );
}

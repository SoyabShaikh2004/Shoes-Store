'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Product } from '@/lib/data';
import ProductCard from '@/components/ProductCard';
import { Sparkles, ArrowRight, SlidersHorizontal } from 'lucide-react';

interface HomeProductSectionProps {
  products: Product[];
}

export default function HomeProductSection({ products }: HomeProductSectionProps) {
  const [activeTab, setActiveTab] = useState<string>('all');

  const tabs = [
    { id: 'all', label: 'All Featured' },
    { id: 'bestsellers', label: '⚡ Best Sellers' },
    { id: 'Running', label: '🏃 Running' },
    { id: 'Casual', label: '👟 Casual' },
    { id: 'Sports', label: '🏀 Sports' },
    { id: 'Formal', label: '👞 Formal' },
  ];

  const filteredProducts = useMemo(() => {
    if (activeTab === 'all') {
      return products.slice(0, 8);
    }
    if (activeTab === 'bestsellers') {
      // Products with discounts or featured flag
      return products
        .filter((p) => p.featured || (p.mrp && p.mrp > p.price))
        .slice(0, 8);
    }
    return products.filter((p) => p.category === activeTab).slice(0, 8);
  }, [activeTab, products]);

  return (
    <section className="py-14 sm:py-20 bg-gray-50/60">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 sm:mb-12">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Engineered For Movement</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
              Featured Footwear Collection
            </h2>
            <p className="text-sm sm:text-base text-gray-500 mt-1 max-w-xl">
              Precision ergonomics, multi-zone Aeroknit™ breathability, and kinetic cushioning across every silhouette.
            </p>
          </div>

          {/* Catalog Link */}
          <Link
            href="/products"
            className="mt-4 md:mt-0 inline-flex items-center gap-2 bg-white hover:bg-gray-100 border border-gray-200 text-gray-900 text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-2xs transition-all hover:border-gray-300"
          >
            <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
            <span>Browse All {products.length} Styles</span>
            <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
          </Link>
        </div>

        {/* Filter Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 no-scrollbar scroll-smooth">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20 scale-[1.02]'
                    : 'bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200/80 shadow-2xs'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Product Cards Grid */}
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center max-w-md mx-auto">
            <p className="text-sm font-semibold text-gray-700">No silhouettes found in this category.</p>
            <button
              onClick={() => setActiveTab('all')}
              className="mt-3 text-xs font-bold text-indigo-600 hover:underline"
            >
              Reset to All Featured
            </button>
          </div>
        )}

        {/* Bottom CTA Banner */}
        <div className="mt-12 text-center">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-8 py-4 rounded-xl shadow-lg shadow-indigo-600/20 transition-all hover:translate-y-[-1px] active:scale-[0.98]"
          >
            <span>Explore Entire Footwear Catalog</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

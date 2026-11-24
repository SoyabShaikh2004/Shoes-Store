'use client';

import { Product } from '@/lib/data';
import { Package, CheckCircle2, XCircle, TrendingDown, IndianRupee, Sparkles } from 'lucide-react';

interface CatalogStatsProps {
  products: Product[];
}

export default function CatalogStats({ products }: CatalogStatsProps) {
  const total = products.length;
  const inStockCount = products.filter((p) => p.inStock).length;
  const outOfStockCount = total - inStockCount;

  const totalSellingValue = products.reduce((acc, p) => acc + (p.price || 0), 0);
  const totalMrpValue = products.reduce((acc, p) => acc + (p.mrp || p.price || 0), 0);
  const totalSavings = Math.max(0, totalMrpValue - totalSellingValue);

  const avgDiscount =
    totalMrpValue > 0
      ? Math.round((totalSavings / totalMrpValue) * 100)
      : 0;

  const featuredCount = products.filter((p) => p.featured).length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Metric 1: Total Catalog */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500">
            Catalog Size
          </span>
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
            <Package className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-xl sm:text-3xl font-extrabold text-gray-900 tabular-nums">
            {total} <span className="text-xs sm:text-sm font-normal text-gray-500">shoes</span>
          </div>
          <div className="text-xs text-gray-500 mt-1 flex items-center gap-1 tabular-nums">
            <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
            <span className="truncate">{featuredCount} featured items</span>
          </div>
        </div>
      </div>

      {/* Metric 2: Stock Health */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500">
            Stock Health
          </span>
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-xl sm:text-3xl font-extrabold text-emerald-600 tabular-nums">
            {inStockCount}{' '}
            <span className="text-xs sm:text-sm font-normal text-gray-500">in stock</span>
          </div>
          <div className="text-xs text-gray-500 mt-1 tabular-nums">
            {outOfStockCount > 0 ? (
              <span className="text-rose-600 font-medium">{outOfStockCount} out of stock</span>
            ) : (
              <span className="text-emerald-700">100% available</span>
            )}
          </div>
        </div>
      </div>

      {/* Metric 3: Avg Store Discount */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500">
            Avg Discount
          </span>
          <div className="p-2 rounded-xl bg-rose-50 text-rose-600 shrink-0">
            <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-xl sm:text-3xl font-extrabold text-rose-600 tabular-nums">
            {avgDiscount}% <span className="text-xs sm:text-sm font-normal text-gray-500">OFF</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Average markdown vs MRP
          </div>
        </div>
      </div>

      {/* Metric 4: Total Inventory Value */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500">
            Catalog Value
          </span>
          <div className="p-2 rounded-xl bg-purple-50 text-purple-600 shrink-0">
            <IndianRupee className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-xl sm:text-3xl font-extrabold text-gray-900 tabular-nums">
            ₹{(totalSellingValue / 1000).toFixed(1)}k
          </div>
          <div className="text-xs text-gray-500 mt-1 tabular-nums">
            ₹{(totalMrpValue / 1000).toFixed(1)}k MRP total
          </div>
        </div>
      </div>
    </div>
  );
}

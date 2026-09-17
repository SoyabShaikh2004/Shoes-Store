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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Metric 1: Total Catalog */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Catalog Size
          </span>
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
            <Package className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            {total} <span className="text-sm font-normal text-gray-500">shoes</span>
          </div>
          <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>{featuredCount} featured items</span>
          </div>
        </div>
      </div>

      {/* Metric 2: Stock Health */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Stock Availability
          </span>
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600">
            {inStockCount}{' '}
            <span className="text-sm font-normal text-gray-500">in stock</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {outOfStockCount > 0 ? (
              <span className="text-rose-600 font-medium">{outOfStockCount} out of stock</span>
            ) : (
              <span className="text-emerald-700">100% available</span>
            )}
          </div>
        </div>
      </div>

      {/* Metric 3: Avg Store Discount */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Average Discount
          </span>
          <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl sm:text-3xl font-extrabold text-rose-600">
            {avgDiscount}% <span className="text-sm font-normal text-gray-500">OFF</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Average customer markdown vs MRP
          </div>
        </div>
      </div>

      {/* Metric 4: Total Inventory Value */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Catalog Value
          </span>
          <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
            <IndianRupee className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            ₹{(totalSellingValue / 1000).toFixed(1)}k
          </div>
          <div className="text-xs text-gray-500 mt-1">
            ₹{(totalMrpValue / 1000).toFixed(1)}k MRP total
          </div>
        </div>
      </div>
    </div>
  );
}

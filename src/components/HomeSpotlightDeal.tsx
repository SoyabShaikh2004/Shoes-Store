'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, ShieldCheck, Star, Zap, ShoppingBag } from 'lucide-react';
import { Product } from '@/lib/data';
import { useQuickOrder } from '@/components/QuickOrderContext';

interface HomeSpotlightDealProps {
  product?: Product;
}

export default function HomeSpotlightDeal({ product }: HomeSpotlightDealProps) {
  const { openQuickOrder } = useQuickOrder();

  if (!product) return null;

  const discountPercent =
    product.mrp && product.mrp > product.price
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0;

  const isAvailable = product.inStock && product.status !== 'inactive';
  const coverSrc =
    product.images?.[0] ||
    (product.imagePath?.includes('.') ? product.imagePath : `${product.imagePath}/HomeProduct.jpeg`);

  return (
    <section className="py-10 sm:py-16 bg-slate-950 text-white relative overflow-hidden">
      <div className="container mx-auto px-4 max-w-7xl relative z-10">
        <div className="bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-800 p-5 sm:p-10 lg:p-12 shadow-xl">
          <div className="grid lg:grid-cols-12 gap-6 lg:gap-12 items-center">
            {/* Content Column */}
            <div className="lg:col-span-7 space-y-4 sm:space-y-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
                <span className="uppercase tracking-wider">Featured Pair of the Week</span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-400">
                  {isAvailable ? 'In Stock & Ready to Ship' : 'Restocking Soon'}
                </span>
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight text-balance">
                  {product.name}
                </h2>

                <div className="flex items-center gap-2.5 mt-2.5 text-xs sm:text-sm text-slate-400">
                  <div className="flex items-center text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <span className="font-bold text-white tabular-nums">4.9</span>
                  <span>·</span>
                  <span>184 Verified Reviews</span>
                </div>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed max-w-xl line-clamp-3">
                {product.description}
              </p>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="flex items-start gap-2 text-xs text-slate-300">
                  <Zap className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block">Kinetic Rebound</span>
                    <span className="text-slate-400">Dual-density cushioning</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 text-xs text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block">VibraGrip Sole</span>
                    <span className="text-slate-400">Anti-slip traction</span>
                  </div>
                </div>
              </div>

              {/* Pricing & Direct Actions */}
              <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                    Direct Store Price
                  </div>
                  <div className="flex items-baseline gap-2.5 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-black text-white tabular-nums">
                      ₹{product.price.toLocaleString('en-IN')}
                    </span>
                    {product.mrp && product.mrp > product.price && (
                      <span className="text-sm text-slate-400 line-through tabular-nums">
                        ₹{product.mrp.toLocaleString('en-IN')}
                      </span>
                    )}
                    {discountPercent > 0 && (
                      <span className="text-xs font-bold text-emerald-400 tabular-nums">
                        Save {discountPercent}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => openQuickOrder(product)}
                    className="flex-1 sm:flex-initial min-h-[48px] inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm px-5 py-3 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer whitespace-nowrap"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Quick Buy</span>
                  </button>

                  <Link
                    href={`/products/${product.id}`}
                    className="min-h-[48px] inline-flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm px-4 py-3 rounded-xl transition-colors whitespace-nowrap"
                  >
                    <span>3D View</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Product Image */}
            <div className="lg:col-span-5 flex items-center justify-center">
              <Link
                href={`/products/${product.id}`}
                className="relative w-full aspect-[4/3] sm:aspect-square max-w-sm rounded-2xl overflow-hidden bg-slate-800/60 border border-slate-700/70 p-4 group"
              >
                <Image
                  src={coverSrc}
                  alt={product.name}
                  fill
                  className="object-contain p-4 group-hover:scale-105 transition-transform duration-500"
                />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

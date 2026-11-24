'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { Product } from '@/lib/data';
import { useQuickOrder } from '@/components/QuickOrderContext';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const [imageError, setImageError] = useState(false);
  const { openQuickOrder } = useQuickOrder();

  const getImagePath = () => {
    if (product.images && product.images.length > 0 && product.images[0]) {
      return product.images[0];
    }

    if (
      product.imagePath &&
      (product.imagePath.startsWith('/uploads/') ||
        product.imagePath.startsWith('/api/uploads/') ||
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

  const hasDiscount = product.mrp && product.mrp > product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.mrp! - product.price) / product.mrp!) * 100)
    : 0;
  const isAvailable = product.inStock && product.status !== 'inactive';

  return (
    <article className="group relative rounded-2xl border border-slate-200 bg-white transition-all duration-200 hover:shadow-md hover:border-slate-300 flex flex-col justify-between overflow-hidden">
      <Link href={`/products/${product.id}`} className="block flex-1">
        <div className="relative h-36 sm:h-52 md:h-56 w-full overflow-hidden bg-slate-50 flex items-center justify-center">
          <Image
            src={imageError ? '/images/Empty-cart.jpg' : getImagePath()}
            alt={product.name}
            className="h-full w-full object-contain p-2.5 sm:p-4 transition-transform duration-300 group-hover:scale-105"
            width={400}
            height={400}
            onError={() => setImageError(true)}
          />

          {/* At most 1 subtle corner tag */}
          {!isAvailable ? (
            <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px] flex items-center justify-center">
              <span className="rounded-md bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white uppercase tracking-wider">
                Out of Stock
              </span>
            </div>
          ) : discountPercent > 0 ? (
            <span className="absolute top-2 left-2 rounded-md bg-slate-900/85 px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-white tabular-nums">
              {discountPercent}% OFF
            </span>
          ) : null}
        </div>

        <div className="px-3 pt-2.5 pb-1.5 sm:px-4 sm:pt-3.5 sm:pb-2">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 truncate">
            <span className="uppercase tracking-wider">{product.brand || 'StepStyle'}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{product.category}</span>
          </div>

          <h3 className="mt-1 text-xs sm:text-sm md:text-base font-bold text-slate-900 line-clamp-1 group-hover:text-indigo-600 transition-colors">
            {product.name}
          </h3>

          <div className="mt-1.5 flex items-baseline flex-wrap gap-1.5">
            <span className="text-sm sm:text-lg font-extrabold text-slate-900 tabular-nums">
              ₹{product.price.toLocaleString('en-IN')}
            </span>
            {hasDiscount && (
              <span className="text-[11px] sm:text-xs text-slate-400 line-through tabular-nums">
                ₹{product.mrp!.toLocaleString('en-IN')}
              </span>
            )}
          </div>
        </div>
      </Link>

      <div className="px-3 pb-3 pt-1.5 sm:px-4 sm:pb-4">
        <button
          type="button"
          disabled={!isAvailable}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openQuickOrder(product);
          }}
          className={`w-full min-h-[44px] rounded-xl px-3 py-2 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] whitespace-nowrap ${
            !isAvailable
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-slate-900 hover:bg-indigo-600 text-white cursor-pointer shadow-xs'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
          <span>{isAvailable ? 'Quick Buy' : 'Unavailable'}</span>
        </button>
      </div>
    </article>
  );
}

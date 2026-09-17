'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Product } from '@/lib/data';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const [imageError, setImageError] = useState(false);
  
  // Function to get the correct image path based on product data
  const getImagePath = () => {
    // 1. If explicit images array is provided, use first slide
    if (product.images && product.images.length > 0 && product.images[0]) {
      return product.images[0];
    }

    // 2. If imagePath is already a direct path (e.g. /uploads/..., http..., data:..., or has extension)
    if (
      product.imagePath &&
      (product.imagePath.startsWith('/uploads/') ||
        product.imagePath.startsWith('http') ||
        product.imagePath.startsWith('data:') ||
        /\.(jpg|jpeg|png|webp|svg)$/i.test(product.imagePath))
    ) {
      return product.imagePath;
    }

    // 3. Fallback to default catalog mapping
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

  const getFallbackImage = () => {
    return '/images/Empty-cart.jpg';
  };

  const hasDiscount = product.mrp && product.mrp > product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.mrp! - product.price) / product.mrp!) * 100)
    : 0;

  return (
    <div className="group relative rounded-2xl border border-gray-200 bg-white shadow-2xs transition-all duration-200 hover:shadow-lg hover:border-gray-300 flex flex-col justify-between overflow-hidden">
      <Link href={`/products/${product.id}`} className="block h-full w-full">
        <div className="relative h-52 sm:h-56 md:h-60 lg:h-64 w-full overflow-hidden bg-gray-50 flex items-center justify-center">
          <Image
            src={imageError ? getFallbackImage() : getImagePath()}
            alt={product.name}
            className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-105"
            width={400}
            height={400}
            onError={() => setImageError(true)}
          />

          {/* Badges */}
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10">
            {discountPercent > 0 && (
              <span className="rounded-md bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
                {discountPercent}% OFF
              </span>
            )}
            {product.featured && (
              <span className="rounded-md bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
                Featured
              </span>
            )}
          </div>

          {!product.inStock && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
              <span className="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold text-white uppercase tracking-wider">
                Out of Stock
              </span>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-5 flex flex-col flex-1 justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                {product.brand || 'StepStyle'}
              </span>
              <span className="inline-block rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
                {product.category}
              </span>
            </div>
            
            <h3 className="mb-2 text-sm sm:text-base font-bold text-gray-900 line-clamp-1 group-hover:text-indigo-600 transition-colors">
              {product.name}
            </h3>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-100">
            {/* Price with MRP */}
            <div className="mb-3 flex items-baseline flex-wrap gap-2">
              <span className="text-lg sm:text-xl font-extrabold text-indigo-600">
                ₹{product.price.toLocaleString('en-IN')}
              </span>
              {hasDiscount && (
                <span className="text-xs sm:text-sm text-gray-400 line-through">
                  ₹{product.mrp!.toLocaleString('en-IN')}
                </span>
              )}
            </div>

            <span className="w-full inline-flex items-center justify-center rounded-xl bg-indigo-600 px-3 py-2.5 min-h-[44px] text-sm font-semibold text-white transition-all group-hover:bg-indigo-700 shadow-sm active:scale-[0.98]">
              View Details
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}

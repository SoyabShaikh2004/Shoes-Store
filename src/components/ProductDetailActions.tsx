'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Product } from '@/lib/data';
import ProductOptions from './ProductOptions';
import AddToCartButton from './AddToCartButton';
import AddToWishlistButton from './AddToWishlistButton';

interface ProductDetailActionsProps {
  product: Product;
}

export default function ProductDetailActions({ product }: ProductDetailActionsProps) {
  const [selectedColor, setSelectedColor] = useState<string>(product.colors?.[0] || '');
  const [selectedSize, setSelectedSize] = useState<number | null>(null);

  const handleSizeChange = (size: number) => {
    setSelectedSize(size);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {product.colors && product.colors.length > 1 && (
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-2">
            Colorway: <span className="font-semibold text-indigo-600">{selectedColor}</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {product.colors.map((color) => {
              const active = selectedColor === color;
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                    active
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {active && <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}
                  <span>{color}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Product Options (Sizes) */}
      <ProductOptions
        sizes={product.sizes}
        onSizeChange={handleSizeChange}
        selectedSize={selectedSize ?? undefined}
      />

      {/* Action Buttons */}
      <div className="mt-4 sm:mt-6 md:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="flex-1">
          <AddToCartButton
            product={product}
            selectedColor={selectedColor}
            selectedSize={selectedSize}
          />
        </div>
        <div className="w-full sm:w-auto">
          <AddToWishlistButton product={product} />
        </div>
      </div>
    </div>
  );
} 
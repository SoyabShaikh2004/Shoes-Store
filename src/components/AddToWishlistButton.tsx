'use client';

import { useState, useEffect } from 'react';
import { Product } from '@/lib/data';

// Helper function to trigger wishlist update notification
const notifyWishlistUpdated = () => {
  window.dispatchEvent(new Event('wishlistUpdated'));
};

interface AddToWishlistButtonProps {
  product: Product;
}

export default function AddToWishlistButton({ product }: AddToWishlistButtonProps) {
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Check if product is already in wishlist on load
  useEffect(() => {
    const wishlistItems = JSON.parse(localStorage.getItem('wishlistItems') || '[]');
    const exists = wishlistItems.some((item: any) => item.id === product.id);
    setIsInWishlist(exists);
  }, [product.id]);

  const toggleWishlist = () => {
    // Prevent multiple clicks
    if (isProcessing) return;
    
    setIsProcessing(true);
    
    // Get existing wishlist
    const wishlistItems = JSON.parse(localStorage.getItem('wishlistItems') || '[]');
    
    if (isInWishlist) {
      // Remove from wishlist
      const updatedWishlist = wishlistItems.filter((item: any) => item.id !== product.id);
      localStorage.setItem('wishlistItems', JSON.stringify(updatedWishlist));
      setIsInWishlist(false);
    } else {
      // Add to wishlist
      wishlistItems.push(product);
      localStorage.setItem('wishlistItems', JSON.stringify(wishlistItems));
      setIsInWishlist(true);
    }

    // Notify about wishlist update
    notifyWishlistUpdated();
    
    // Reset processing state after a short delay
    setTimeout(() => {
      setIsProcessing(false);
    }, 500);
  };
  
  return (
    <button
      onClick={toggleWishlist}
      disabled={isProcessing}
      className={`flex w-full items-center justify-center rounded-xl border px-6 py-3 min-h-[48px] text-sm sm:text-base font-bold transition-all duration-150 active:scale-[0.99] cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
        isInWishlist
          ? 'border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100'
          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400'
      }`}
    >
      {isProcessing
        ? 'Updating...'
        : isInWishlist
          ? '♥ Saved to Wishlist'
          : '♡ Add to Wishlist'}
    </button>
  );
} 
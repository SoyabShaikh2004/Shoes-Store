'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { WishlistItem } from '@/app/wishlist/page';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { resolveProductImage } from '@/lib/productImages';

// Helper functions to trigger update notifications
const notifyWishlistUpdated = () => {
  window.dispatchEvent(new Event('wishlistUpdated'));
};

const notifyCartUpdated = () => {
  window.dispatchEvent(new Event('cartUpdated'));
};

export default function WishlistItems() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const router = useRouter();

  // Load wishlist items from localStorage when component mounts
  useEffect(() => {
    const loadWishlistItems = () => {
      try {
        const wishlistData = localStorage.getItem('wishlistItems');
        if (wishlistData) {
          const wishlistItems = JSON.parse(wishlistData);
          setItems(wishlistItems);
        }
      } catch (error) {
        // Remove console.error for production
        // console.error('Error loading wishlist items:', error);
        setItems([]);
      }
    };

    loadWishlistItems();
    
    // Add event listener for storage events from other tabs
    window.addEventListener('storage', loadWishlistItems);
    
    return () => {
      window.removeEventListener('storage', loadWishlistItems);
    };
  }, []);

  const getImagePath = resolveProductImage;

  const handleImageError = (imagePath: string) => {
    setFailedImages(prev => ({ ...prev, [imagePath]: true }));
  };

  const handleRemoveFromWishlist = (id: number) => {
    // Remove item from wishlist
    const updatedItems = items.filter(item => item.id !== id);
    
    // Update localStorage
    localStorage.setItem('wishlistItems', JSON.stringify(updatedItems));
    
    // Update state
    setItems(updatedItems);

    // Notify about wishlist update
    notifyWishlistUpdated();
  };

  const handleAddToCart = (item: WishlistItem) => {
    try {
      const cartItems = JSON.parse(localStorage.getItem('cartItems') || '[]');
      const defaultSize = item.sizes?.[0] || 8;
      const defaultColor = item.colors?.[0] || 'Standard';

      const existingProductIndex = cartItems.findIndex(
        (cartItem: any) =>
          cartItem.id === item.id &&
          (cartItem.selectedSize || defaultSize) === defaultSize &&
          (cartItem.selectedColor || defaultColor) === defaultColor
      );

      if (existingProductIndex !== -1) {
        cartItems[existingProductIndex].quantity =
          (cartItems[existingProductIndex].quantity || 1) + 1;
      } else {
        cartItems.push({
          ...item,
          selectedSize: defaultSize,
          selectedColor: defaultColor,
          quantity: 1,
        });
      }

      localStorage.setItem('cartItems', JSON.stringify(cartItems));
      
      // Notify about cart update
      notifyCartUpdated();
      
      // Show a success toast message
      toast.success(`${item.name} has been added to your cart`);
      
      router.push('/cart');
    } catch (error) {
      // Show an error toast message
      toast.error("There was a problem adding this item to your cart");
    }
  };

  // If wishlist is empty, show empty state
  if (items.length === 0) {
    return (
      <div className="mt-4 sm:mt-8 text-center">
        <div className="mb-4 sm:mb-6 flex justify-center">
          <Image 
            src="/images/Empty-cart.jpg" 
            alt="Empty wishlist" 
            width={200} 
            height={200} 
            className="object-contain max-w-[150px] sm:max-w-[200px]" 
          />
        </div>
        <p className="mb-3 sm:mb-4 text-base sm:text-lg text-gray-600">Your wishlist is empty</p>
        <Link 
          href="/products" 
          className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-black px-5 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-medium text-white transition-opacity hover:opacity-90"
        >
          Explore Products
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => {
        const imagePath = getImagePath(item);
        
        return (
          <div key={item.id} className="group relative flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
            <Link href={`/products/${item.id}`} className="relative aspect-square overflow-hidden bg-slate-50">
              <Image 
                src={failedImages[imagePath] ? '/images/Empty-cart.jpg' : imagePath} 
                alt={item.name} 
                fill 
                referrerPolicy="no-referrer"
                unoptimized={imagePath.startsWith('data:')}
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-contain p-2.5 transition-transform duration-300 group-hover:scale-105"
                onError={() => handleImageError(imagePath)}
              />
            </Link>
            <div className="flex flex-1 flex-col justify-between p-3 sm:p-4">
              <div className="mb-3 flex flex-col sm:flex-row sm:items-start justify-between gap-1.5">
                <Link href={`/products/${item.id}`} className="text-xs sm:text-sm md:text-base font-semibold text-slate-900 hover:text-indigo-600 line-clamp-2 leading-snug">
                  {item.name}
                </Link>
                <span className="text-sm sm:text-base font-bold text-slate-900 tabular-nums shrink-0">₹{item.price.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex-1 min-h-[44px] rounded-full bg-black py-2 px-3 text-xs sm:text-sm font-medium text-white transition-opacity hover:opacity-90 whitespace-nowrap cursor-pointer"
                  onClick={() => handleAddToCart(item)}
                >
                  Add to Cart
                </button>
                <button
                  type="button"
                  className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-full bg-red-50 text-red-500 transition-colors hover:bg-red-100 shrink-0 cursor-pointer"
                  aria-label={`Remove ${item.name} from wishlist`}
                  onClick={() => handleRemoveFromWishlist(item.id)}
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
} 
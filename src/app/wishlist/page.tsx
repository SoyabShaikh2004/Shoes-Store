import { Metadata } from 'next';
import dynamic from 'next/dynamic';

// Use dynamic import with no SSR to ensure client-side rendering
const WishlistItems = dynamic(() => import('@/components/WishlistItems'), { ssr: false });

export const metadata: Metadata = {
  title: 'My Wishlist | StepStyle',
  description: 'View and manage your saved items',
};

// Wishlist item type
export type WishlistItem = {
  id: number;
  name: string;
  price: number;
  imagePath: string;
  description?: string;
  category?: string;
  inStock?: boolean;
  sizes?: number[];
  colors?: string[];
};

export default function WishlistPage() {
  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 md:py-10 max-w-7xl">
      <h1 className="mb-4 sm:mb-6 text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">My Wishlist</h1>
      <WishlistItems />
    </div>
  );
} 
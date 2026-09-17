import { Metadata } from 'next';
import dynamic from 'next/dynamic';

// Use dynamic import with no SSR for cart items 
const CartItems = dynamic(() => import('@/components/CartItems'), { ssr: false });

export const metadata: Metadata = {
  title: 'Your Cart | StepStyle',
  description: 'View and manage your cart items',
};

export type CartItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
  imagePath: string;
  selectedSize?: number;
  selectedColor?: string;
};

export default function CartPage() {
  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 md:py-10 max-w-7xl">
      <h1 className="mb-4 sm:mb-6 text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Shopping Cart</h1>
      <CartItems />
    </div>
  );
} 
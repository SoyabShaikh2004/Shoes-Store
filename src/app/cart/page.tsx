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
  mrp?: number;
  brand?: string;
  category?: string;
  quantity: number;
  imagePath: string;
  selectedSize?: number;
  selectedColor?: string;
};

export default function CartPage() {
  return (
    <div className="container mx-auto px-3.5 sm:px-4 py-4 sm:py-8 md:py-10 max-w-7xl">
      <div className="mb-4 sm:mb-6 flex items-baseline justify-between gap-3">
        <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Checkout &amp; Payment
        </h1>
        <span className="text-xs font-medium text-slate-500">
          Secure Encrypted Order
        </span>
      </div>
      <CartItems />
    </div>
  );
}
import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import OrderTrackingClient from '@/components/OrderTrackingClient';

export const metadata = {
  title: 'Order Tracking | StepStyle',
  description: 'Track your StepStyle footwear shipment status and view purchased items by Order ID.',
};

export default function TrackOrderPage() {
  return (
    <div className="min-h-screen bg-gray-50/50 py-8 sm:py-12">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/account"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Account</span>
          </Link>

          <Link
            href="/products"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            Continue Shopping →
          </Link>
        </div>

        <Suspense
          fallback={
            <div className="rounded-2xl border border-gray-200 bg-white p-12 flex items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600" />
            </div>
          }
        >
          <OrderTrackingClient />
        </Suspense>
      </div>
    </div>
  );
}

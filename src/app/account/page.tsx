'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, Truck, Search, ArrowRight, Heart, LogOut, ShoppingBag } from 'lucide-react';
import { CustomerOrderView, mapLegacyStageToStatus } from '@/lib/orderTypes';

interface UserData {
  email?: string;
  name?: string;
  phone?: string;
  loginMethod?: string;
  loginTime?: string;
}

export default function AccountPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [quickOrderId, setQuickOrderId] = useState('');
  const [orders, setOrders] = useState<CustomerOrderView[]>([]);

  useEffect(() => {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';

    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    let parsedUser: UserData | null = null;
    const userDataString = localStorage.getItem('authUser');
    if (userDataString) {
      try {
        parsedUser = JSON.parse(userDataString);
        setUserData(parsedUser);
      } catch {
        // ignore invalid user data
      }
    }

    const loadOrders = async () => {
      const merged = new Map<string, CustomerOrderView>();

      try {
        const localOrdersRaw = localStorage.getItem('orders');
        if (localOrdersRaw) {
          const parsedOrders: CustomerOrderView[] = JSON.parse(localOrdersRaw);
          if (Array.isArray(parsedOrders)) {
            parsedOrders.forEach((order) => {
              const code = order?.orderNumber || order?.orderId;
              if (code) {
                merged.set(code.toUpperCase(), order);
              }
            });
          }
        }
      } catch {
        // ignore
      }

      if (parsedUser?.email || parsedUser?.phone) {
        try {
          const params = new URLSearchParams();
          if (parsedUser.email) params.set('email', parsedUser.email);
          if (parsedUser.phone) params.set('phone', parsedUser.phone);
          const res = await fetch(`/api/orders?${params.toString()}`, {
            cache: 'no-store',
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.orders)) {
              data.orders.forEach((order: CustomerOrderView) => {
                const code = order?.orderNumber || order?.orderId;
                if (code) {
                  merged.set(code.toUpperCase(), order);
                }
              });
            }
          }
        } catch {
          // ignore
        }
      }

      const sorted = Array.from(merged.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setOrders(sorted);
      setIsLoading(false);
    };

    loadOrders();
  }, [router]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-IN');
  };

  const handleQuickTrack = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = quickOrderId.trim().replace(/^#+/, '');
    if (cleaned) {
      router.push(`/track-order?orderId=${encodeURIComponent(cleaned)}`);
    } else {
      router.push('/track-order');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100dvh-5rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-3.5 sm:px-4 py-6 sm:py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">My Account</h1>
          <Link
            href="/track-order"
            className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            <Truck className="w-4 h-4" />
            <span>Order Tracking</span>
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center mb-6">
              <div className="h-16 w-16 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xl font-medium mx-auto sm:mx-0 sm:mr-4 mb-3 sm:mb-0">
                {userData?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="text-center sm:text-left">
                <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
                  {userData?.name || 'User'}
                </h2>
                <p className="text-sm text-slate-600">{userData?.email}</p>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-base sm:text-lg font-medium text-slate-900 mb-2">
                Account Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs sm:text-sm text-slate-500">Email</p>
                  <p className="text-sm sm:text-base text-slate-900 break-words">
                    {userData?.email || 'Not available'}
                  </p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-slate-500">Phone</p>
                  <p className="text-sm sm:text-base text-slate-900">
                    {userData?.phone || 'Not available'}
                  </p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-slate-500">Login Method</p>
                  <p className="text-sm sm:text-base text-slate-900 capitalize">
                    {userData?.loginMethod || 'Password'}
                  </p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-slate-500">Last Login</p>
                  <p className="text-sm sm:text-base text-slate-900">
                    {userData?.loginTime ? formatDate(userData.loginTime) : 'Not available'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 px-4 sm:px-6 py-4 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row flex-wrap gap-2.5">
              <Link
                href="/track-order"
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
              >
                <Truck className="h-4 w-4" />
                <span>Order Tracking</span>
              </Link>
              <Link
                href="/wishlist"
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
              >
                <Heart className="h-4 w-4 text-slate-500" />
                <span>My Wishlist</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('isAuthenticated');
                  localStorage.removeItem('authUser');
                  window.dispatchEvent(new Event('authUpdated'));
                  router.push('/auth/login');
                }}
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 border border-rose-300 rounded-lg text-sm font-medium text-rose-700 bg-white hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4 text-rose-500" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dedicated Order Tracking & Purchased Items Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">Order Tracking</h3>
                <p className="text-xs text-slate-500">
                  Check real-time shipping status and view your purchased footwear
                </p>
              </div>
            </div>
            <Link
              href="/track-order"
              className="min-h-[44px] inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              <span>Open Full Tracker</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <form onSubmit={handleQuickTrack} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={quickOrderId}
                onChange={(e) => setQuickOrderId(e.target.value)}
                placeholder="Enter Order ID (e.g. STEP-4829-1034)"
                className="w-full min-h-[44px] pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 text-base sm:text-sm font-mono placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Track Order</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {orders.length > 0 ? (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Your Recent Orders ({orders.length})
              </h4>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {orders.map((order) => {
                  const code = order.orderNumber || order.orderId;
                  const itemCount = order.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
                  const statusLabel = mapLegacyStageToStatus(order);

                  return (
                    <div
                      key={code}
                      className="p-3.5 sm:p-4 bg-white hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-sm text-slate-900">
                            {code}
                          </span>
                          <span className="text-xs font-semibold text-indigo-700">
                            · {statusLabel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 tabular-nums">
                          {new Date(order.date).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}{' '}
                          · {itemCount} {itemCount === 1 ? 'item' : 'items'} ·{' '}
                          <strong className="text-slate-900">
                            ₹{order.totalAmount.toLocaleString('en-IN')}
                          </strong>
                        </p>
                      </div>

                      <Link
                        href={`/track-order?orderId=${encodeURIComponent(code)}`}
                        className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors shrink-0"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Track Status</span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 border border-dashed border-slate-200 p-4 text-center">
              <ShoppingBag className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
              <p className="text-xs text-slate-600">
                No recent orders saved on this account yet. Have an Order ID? Enter it above or{' '}
                <Link href="/track-order" className="font-semibold text-indigo-600 hover:underline">
                  open Order Tracking
                </Link>
                .
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
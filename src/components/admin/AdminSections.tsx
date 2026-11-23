'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  Users,
  CheckCircle2,
  ShieldCheck,
  Download,
  RotateCcw,
  AlertTriangle,
  Truck,
  CreditCard,
  Layers,
  TrendingUp,
} from 'lucide-react';
import { Product } from '@/lib/data';
import { AdminUser, getAdminAuthHeaders } from '@/lib/adminAuth';
import { formatDateTimeIN, OrderStatus } from '@/lib/orderTypes';
import type { FullOrderView } from '@/lib/db/store';

export interface OverviewPayload {
  overview: {
    totalOrders: number;
    pendingOrders: number;
    confirmedOrders: number;
    processingOrders: number;
    shippedOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    returnedOrRefundedOrders: number;
    totalRevenue: number;
  };
  recentOrders: FullOrderView[];
  productsCount: number;
  lowStockProducts: Product[];
  categories: Array<{ id: string; name: string; productCount: number; totalStock: number }>;
  brands: Array<{ id: string; name: string; productCount: number }>;
  customers: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    ordersCount: number;
    totalSpent: number;
    lastOrderNumber?: string;
    lastOrderAt?: string;
  }>;
  payments: Array<{
    id: string;
    orderNumber?: string;
    customerName?: string;
    method: string;
    status: string;
    amount: number;
    transactionId?: string;
    utrNumber?: string;
    updatedAt: string;
  }>;
  shipping: Array<{
    id: string;
    orderNumber?: string;
    orderStatus?: OrderStatus;
    customerName?: string;
    carrier: string;
    trackingNumber: string;
    estimatedDelivery: string;
    pincode?: string;
    shippedAt?: string;
    deliveredAt?: string;
  }>;
  returns: Array<{
    id: string;
    orderNumber?: string;
    customerName?: string;
    reason: string;
    status: string;
    requestedAt: string;
  }>;
  refunds: Array<{
    id: string;
    orderNumber?: string;
    customerName?: string;
    amount: number;
    status: string;
    referenceId: string;
    initiatedAt: string;
  }>;
  admins: AdminUser[];
}

export function OverviewSection({
  data,
  products,
  onNavigate,
}: {
  data: OverviewPayload | null;
  products: Product[];
  onNavigate: (tab: 'orders' | 'products' | 'bulk' | 'inventory') => void;
}) {
  const ov = data?.overview;
  const maxStageCount = Math.max(
    1,
    ov?.pendingOrders || 0,
    ov?.confirmedOrders || 0,
    ov?.processingOrders || 0,
    ov?.shippedOrders || 0,
    ov?.deliveredOrders || 0
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs font-semibold text-slate-500">Total Revenue</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            ₹{(ov?.totalRevenue || 0).toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-emerald-700 mt-1">Excludes cancelled & refunded</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs font-semibold text-slate-500">Total Orders</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {ov?.totalOrders || 0}
          </div>
          <button
            type="button"
            onClick={() => onNavigate('orders')}
            className="text-xs font-semibold text-indigo-600 hover:underline mt-1 cursor-pointer"
          >
            Manage orders →
          </button>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs font-semibold text-slate-500">Active Footwear SKUs</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {products.length}
          </div>
          <button
            type="button"
            onClick={() => onNavigate('bulk')}
            className="text-xs font-semibold text-indigo-600 hover:underline mt-1 cursor-pointer"
          >
            Bulk upload shoes →
          </button>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs font-semibold text-slate-500">Low Stock Alerts</div>
          <div className="text-2xl font-bold text-rose-700 mt-1 tabular-nums">
            {data?.lowStockProducts.length || 0}
          </div>
          <button
            type="button"
            onClick={() => onNavigate('inventory')}
            className="text-xs font-semibold text-indigo-600 hover:underline mt-1 cursor-pointer"
          >
            Inspect inventory →
          </button>
        </div>
      </div>

      {/* Fulfillment Pipeline Chart & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Order Fulfillment Pipeline</h3>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="space-y-3 text-xs">
            {[
              { label: 'Pending / Accepted', count: ov?.pendingOrders || 0, bar: 'bg-amber-500' },
              { label: 'Confirmed', count: ov?.confirmedOrders || 0, bar: 'bg-indigo-600' },
              { label: 'Processing & Packed', count: ov?.processingOrders || 0, bar: 'bg-blue-600' },
              { label: 'Shipped & Out for Delivery', count: ov?.shippedOrders || 0, bar: 'bg-violet-600' },
              { label: 'Delivered', count: ov?.deliveredOrders || 0, bar: 'bg-emerald-600' },
              { label: 'Cancelled', count: ov?.cancelledOrders || 0, bar: 'bg-rose-600' },
            ].map((row) => (
              <div key={row.label} className="space-y-1">
                <div className="flex justify-between font-medium text-slate-700">
                  <span>{row.label}</span>
                  <span className="tabular-nums font-bold">{row.count}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${row.bar} rounded-full transition-all`}
                    style={{ width: `${Math.round((row.count / maxStageCount) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Recent Customer Orders</h3>
            <button
              type="button"
              onClick={() => onNavigate('orders')}
              className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>
          {!data?.recentOrders || data.recentOrders.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">
              No orders recorded yet. Orders placed via checkout appear here automatically.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.recentOrders.slice(0, 6).map((v) => (
                <div
                  key={v.order.id}
                  className="py-2.5 flex items-center justify-between text-xs gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-mono font-bold text-slate-900">
                      {v.order.orderNumber}
                    </div>
                    <div className="text-slate-500 truncate">
                      {v.order.customerName} · {v.order.status}
                    </div>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    <div className="font-bold text-slate-900">
                      ₹{v.order.totalAmount.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] text-slate-500">{v.order.paymentStatus}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CategoriesSection({ data }: { data: OverviewPayload | null }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600" />
          <h3 className="text-base font-bold text-slate-900">
            Categories ({data?.categories.length || 0})
          </h3>
        </div>
        <div className="divide-y divide-slate-100 text-xs sm:text-sm">
          {(data?.categories || []).map((cat) => (
            <div key={cat.id} className="py-3 flex items-center justify-between">
              <span className="font-semibold text-slate-900">{cat.name}</span>
              <span className="text-slate-600 tabular-nums">
                {cat.productCount} products · {cat.totalStock} pairs in stock
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-900">
          Brands Directory ({data?.brands.length || 0})
        </h3>
        <div className="divide-y divide-slate-100 text-xs sm:text-sm">
          {(data?.brands || []).map((b) => (
            <div key={b.id} className="py-3 flex items-center justify-between">
              <span className="font-semibold text-slate-900">{b.name}</span>
              <span className="text-slate-600 tabular-nums">{b.productCount} models</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CustomersSection({ data }: { data: OverviewPayload | null }) {
  const customers = data?.customers || [];
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-900">
          Registered & Ordering Customers ({customers.length})
        </h3>
      </div>
      {customers.length === 0 ? (
        <div className="p-10 text-center text-xs text-slate-500">
          No customer orders have been placed yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Orders</th>
                <th className="py-3 px-4">Total Spent</th>
                <th className="py-3 px-4">Latest Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-semibold text-slate-900">{c.name}</td>
                  <td className="py-3 px-4 text-xs">
                    <div>{c.phone}</div>
                    <div className="text-slate-500">{c.email || '—'}</div>
                  </td>
                  <td className="py-3 px-4 tabular-nums font-semibold">{c.ordersCount}</td>
                  <td className="py-3 px-4 tabular-nums font-bold text-emerald-700">
                    ₹{c.totalSpent.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs">{c.lastOrderNumber || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function InventorySection({
  products,
  onRefresh,
}: {
  products: Product[];
  onRefresh: () => void;
}) {
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const handleQuickRestock = async (product: Product, nextQty: number) => {
    setUpdatingId(product.id);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ stockQuantity: nextQty, inStock: nextQty > 0 }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed');
      toast.success(`Updated ${product.sku || product.name} stock to ${nextQty}`);
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Stock update failed');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">SKU Stock Ledger</h3>
          <p className="text-xs text-slate-500">
            Inventory automatically deducts on order confirmation and restores on cancellation/return.
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="py-3 px-4">SKU</th>
              <th className="py-3 px-4">Shoe Model</th>
              <th className="py-3 px-4">Sizes Available</th>
              <th className="py-3 px-4">Stock Qty</th>
              <th className="py-3 px-4 text-right">Quick Adjust</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((p) => {
              const qty = p.stockQuantity ?? 25;
              const isLow = qty <= 10;
              return (
                <tr key={p.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                    {p.sku || `STEP-${String(p.id).padStart(4, '0')}`}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900">{p.name}</td>
                  <td className="py-3 px-4 text-xs text-slate-500">
                    {p.sizes.join(', ')}
                  </td>
                  <td className="py-3 px-4 tabular-nums">
                    <span
                      className={`font-bold ${
                        qty === 0
                          ? 'text-rose-700'
                          : isLow
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {qty} pairs
                    </span>
                    {isLow && (
                      <span className="ml-2 text-[11px] text-amber-700 font-medium inline-flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3" /> Low
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={updatingId === p.id}
                        onClick={() => handleQuickRestock(p, qty + 10)}
                        className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                      >
                        +10
                      </button>
                      <button
                        type="button"
                        disabled={updatingId === p.id || qty === 0}
                        onClick={() => handleQuickRestock(p, 0)}
                        className="px-2.5 py-1 rounded border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold cursor-pointer"
                      >
                        Mark OOS
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PaymentsSection({ data }: { data: OverviewPayload | null }) {
  const payments = data?.payments || [];
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-indigo-600" />
        <h3 className="text-base font-bold text-slate-900">
          Payments & Refunds ({payments.length})
        </h3>
      </div>
      {payments.length === 0 ? (
        <div className="p-10 text-center text-xs text-slate-500">No payments recorded yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="py-3 px-4">Order</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Method & Ref</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                    {p.orderNumber}
                  </td>
                  <td className="py-3 px-4">{p.customerName}</td>
                  <td className="py-3 px-4 text-xs">
                    <div className="font-medium text-slate-800">{p.method}</div>
                    {p.transactionId && (
                      <div className="font-mono text-slate-500">{p.transactionId}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 font-semibold">{p.status}</td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900 tabular-nums">
                    ₹{p.amount.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ShippingSection({ data }: { data: OverviewPayload | null }) {
  const shipments = data?.shipping || [];
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
        <Truck className="w-4 h-4 text-indigo-600" />
        <h3 className="text-base font-bold text-slate-900">
          Shipments & Tracking Numbers ({shipments.length})
        </h3>
      </div>
      {shipments.length === 0 ? (
        <div className="p-10 text-center text-xs text-slate-500">No shipments created yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="py-3 px-4">Order</th>
                <th className="py-3 px-4">Carrier & AWB</th>
                <th className="py-3 px-4">Destination</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Est. Delivery</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shipments.map((s) => (
                <tr key={s.id}>
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                    {s.orderNumber}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{s.carrier}</div>
                    <div className="font-mono text-xs text-slate-500">{s.trackingNumber}</div>
                  </td>
                  <td className="py-3 px-4 text-xs">
                    {s.customerName} · {s.pincode}
                  </td>
                  <td className="py-3 px-4 font-semibold text-indigo-700">
                    {s.orderStatus}
                  </td>
                  <td className="py-3 px-4 text-xs">{s.estimatedDelivery}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ReportsSection({
  data,
  products,
}: {
  data: OverviewPayload | null;
  products: Product[];
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
        <h3 className="text-base font-bold text-slate-900">
          Category Distribution & Pricing Breakdown
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data?.categories || []).map((cat) => {
            const catProducts = products.filter((p) => p.category === cat.name);
            const inStock = catProducts.filter((p) => p.inStock).length;
            const avgPrice = Math.round(
              catProducts.reduce((acc, p) => acc + (p.price || 0), 0) /
                (catProducts.length || 1)
            );
            return (
              <div
                key={cat.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{cat.name}</span>
                  <span className="font-semibold text-indigo-700 tabular-nums">
                    {catProducts.length} models
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 tabular-nums">
                  <span>In Stock Models</span>
                  <span className="font-semibold text-emerald-700">
                    {inStock} / {catProducts.length}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 tabular-nums">
                  <span>Total Warehouse Stock</span>
                  <span className="font-semibold text-slate-900">{cat.totalStock} pairs</span>
                </div>
                <div className="flex justify-between text-slate-600 tabular-nums">
                  <span>Average Price</span>
                  <span className="font-semibold text-slate-900">
                    ₹{avgPrice.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {data && (data.returns.length > 0 || data.refunds.length > 0) && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-3">
          <h3 className="text-base font-bold text-slate-900">
            Returns & Refunds Summary ({data.returns.length} returns · {data.refunds.length} refunds)
          </h3>
          <div className="divide-y divide-slate-100 text-xs">
            {data.returns.map((r) => (
              <div key={r.id} className="py-2 flex justify-between">
                <span>
                  <strong className="font-mono">{r.orderNumber}</strong> · {r.customerName} —{' '}
                  {r.reason}
                </span>
                <span className="font-semibold text-amber-700">{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SettingsSection({
  admins,
  currentAdmin,
  products,
  onResetComplete,
}: {
  admins: AdminUser[];
  currentAdmin: AdminUser;
  products: Product[];
  onResetComplete: () => void;
}) {
  const handleExportCatalog = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(products, null, 2)
    )}`;
    const a = document.createElement('a');
    a.href = jsonString;
    a.download = `stepstyle-catalog-backup-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success('Catalog JSON exported successfully');
  };

  const handleResetCatalog = async () => {
    if (
      !window.confirm(
        'Reset catalog back to the 20 default shoes? Custom products will be overwritten.'
      )
    ) {
      return;
    }
    const toastId = toast.loading('Restoring default catalog...');
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        credentials: 'include',
        headers: getAdminAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Reset failed');
      toast.success('Default catalog restored', { id: toastId });
      onResetComplete();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Reset failed', { id: toastId });
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Admin Team & Access Control ({admins.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Authenticated via server-signed HttpOnly sessions and role permissions.
            </p>
          </div>
          <Users className="w-5 h-5 text-indigo-600" />
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {admins.map((admin) => (
            <div
              key={admin.id}
              className="p-3.5 bg-slate-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
            >
              <div>
                <div className="font-bold text-slate-900">
                  {admin.name}{' '}
                  <span className="font-semibold text-indigo-700">· {admin.role}</span>
                </div>
                <div className="font-mono text-slate-500">{admin.email}</div>
              </div>
              <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{admin.lastLogin ? `Last login ${formatDateTimeIN(admin.lastLogin)}` : 'Active'}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 rounded-lg bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <span>
            Signed in as <strong>{currentAdmin.name}</strong> ({currentAdmin.role}).
          </span>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
        <h3 className="text-base font-bold text-slate-900">Catalog Backup & Maintenance</h3>

        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Export Catalog JSON</div>
            <p className="text-xs text-slate-500">
              Download full snapshot of SKUs, prices, MRPs, sizes, and media paths.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportCatalog}
            className="px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Backup</span>
          </button>
        </div>

        {currentAdmin.role === 'Super Admin' && (
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-rose-900">
                Restore Factory Default Catalog
              </div>
              <p className="text-xs text-rose-700">
                Resets catalog back to the 20 baseline StepStyle footwear models.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetCatalog}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Defaults</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

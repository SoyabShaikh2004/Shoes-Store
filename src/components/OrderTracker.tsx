'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  ShieldCheck,
  Clock,
  Box,
  Package,
  Truck,
  MapPin,
  FileText,
  Printer,
  MessageCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import { generateTaxInvoicePDF } from '@/lib/invoiceGenerator';
import {
  CustomerOrderView,
  OrderStatus,
  PRIMARY_ORDER_STATUSES,
  formatDateTimeIN,
  mapLegacyStageToStatus,
} from '@/lib/orderTypes';

interface OrderTrackerProps {
  order: CustomerOrderView;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const PRIMARY_STEPS: Array<{
  status: (typeof PRIMARY_ORDER_STATUSES)[number];
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    status: 'Order Placed',
    label: 'Order Placed',
    description: 'Order submitted by customer',
    icon: ClipboardCheck,
  },
  {
    status: 'Order Accepted',
    label: 'Order Accepted',
    description: 'Reviewed by dispatch desk',
    icon: CheckCircle2,
  },
  {
    status: 'Order Confirmed',
    label: 'Order Confirmed',
    description: 'Verified & inventory reserved',
    icon: ShieldCheck,
  },
  {
    status: 'Processing',
    label: 'Processing',
    description: 'Quality & size check',
    icon: Clock,
  },
  {
    status: 'Packed',
    label: 'Packed',
    description: 'Sealed & labelled for courier',
    icon: Box,
  },
  {
    status: 'Shipped',
    label: 'Shipped',
    description: 'Handed over to carrier',
    icon: Package,
  },
  {
    status: 'Out for Delivery',
    label: 'Out for Delivery',
    description: 'Arriving at destination',
    icon: Truck,
  },
  {
    status: 'Delivered',
    label: 'Delivered',
    description: 'Completed & handed over',
    icon: MapPin,
  },
];

function getStatusAccent(status: OrderStatus): {
  text: string;
  bg: string;
  border: string;
} {
  if (status === 'Delivered' || status === 'Refunded') {
    return { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  }
  if (status === 'Order Cancelled' || status === 'Payment Failed') {
    return { text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' };
  }
  if (
    status === 'Return Requested' ||
    status === 'Returned' ||
    status === 'Refund Initiated'
  ) {
    return { text: 'text-amber-800', bg: 'bg-amber-50', border: 'border-amber-200' };
  }
  return { text: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' };
}

export default function OrderTracker({
  order,
  onRefresh,
  isRefreshing = false,
}: OrderTrackerProps) {
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);

  const currentStatus = mapLegacyStageToStatus(order);
  const history = order.statusHistory || [];

  // Map each status to its latest recorded timestamp
  const timestampByStatus = new Map<OrderStatus, string>();
  history.forEach((entry) => {
    timestampByStatus.set(entry.status, entry.timestamp);
  });
  if (!timestampByStatus.has('Order Placed') && order.date) {
    timestampByStatus.set('Order Placed', order.date);
  }

  const isExceptionStatus = !PRIMARY_ORDER_STATUSES.includes(
    currentStatus as (typeof PRIMARY_ORDER_STATUSES)[number]
  );

  // Determine highest primary step reached even if order later moved to Cancelled/Returned/Refunded
  let currentPrimaryIndex = PRIMARY_ORDER_STATUSES.indexOf(
    currentStatus as (typeof PRIMARY_ORDER_STATUSES)[number]
  );

  if (currentPrimaryIndex === -1) {
    let highestFromHistory = 0;
    history.forEach((h) => {
      const idx = PRIMARY_ORDER_STATUSES.indexOf(
        h.status as (typeof PRIMARY_ORDER_STATUSES)[number]
      );
      if (idx > highestFromHistory) highestFromHistory = idx;
    });
    currentPrimaryIndex = highestFromHistory;
  }

  const accent = getStatusAccent(currentStatus);

  const handleDownloadInvoice = () => {
    setIsDownloadingInvoice(true);
    try {
      generateTaxInvoicePDF({
        orderId: order.orderNumber || order.orderId,
        date: order.date,
        items: order.items.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          selectedColor: item.selectedColor,
          selectedSize: item.selectedSize,
          brand: item.brand,
          category: item.category,
        })),
        totalAmount: order.totalAmount,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        transactionId: order.transactionId,
        utrNumber: order.utrNumber,
        paidToUPI: order.paidToUPI,
        customer: {
          name: order.customer.name,
          phone: order.customer.phone,
          address: order.customer.address,
          pincode: order.customer.pincode,
          email: order.customer.email,
        },
        estimatedDelivery: order.estimatedDelivery,
      });
    } catch (err) {
      console.error('Invoice error:', err);
    } finally {
      setTimeout(() => setIsDownloadingInvoice(false), 600);
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <span className="font-mono font-semibold text-slate-900">
              {order.orderNumber || order.orderId}
            </span>
            <span>·</span>
            <span>Placed {formatDateTimeIN(order.date)}</span>
            {order.updatedAt && (
              <>
                <span>·</span>
                <span>Updated {formatDateTimeIN(order.updatedAt)}</span>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-0.5">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {currentStatus}
            </h2>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-xs font-semibold ${accent.bg} ${accent.text} ${accent.border}`}
            >
              Payment: {order.paymentStatus}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing' : 'Refresh'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handlePrint}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap print:hidden"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Summary</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadInvoice}
            disabled={isDownloadingInvoice}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap print:hidden"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{isDownloadingInvoice ? 'Generating...' : 'Download Tax Invoice'}</span>
          </button>
        </div>
      </div>

      {/* Special Status Alert Banner (Cancelled, Failed, Return, Refund) */}
      {isExceptionStatus && (
        <div
          className={`rounded-xl border p-4 flex items-start gap-3 ${accent.bg} ${accent.border}`}
        >
          {currentStatus === 'Order Cancelled' || currentStatus === 'Payment Failed' ? (
            <XCircle className={`w-5 h-5 shrink-0 mt-0.5 ${accent.text}`} />
          ) : currentStatus === 'Refunded' ? (
            <CheckCircle2 className={`w-5 h-5 shrink-0 mt-0.5 ${accent.text}`} />
          ) : (
            <RotateCcw className={`w-5 h-5 shrink-0 mt-0.5 ${accent.text}`} />
          )}
          <div className="space-y-1 text-xs sm:text-sm">
            <p className={`font-bold ${accent.text}`}>
              Current Order State: {currentStatus}
            </p>
            {order.cancelReason && (
              <p className="text-slate-700">
                <span className="font-semibold">Reason:</span> {order.cancelReason}
              </p>
            )}
            {order.returns && order.returns.length > 0 && (
              <p className="text-slate-700">
                <span className="font-semibold">Return Status:</span>{' '}
                {order.returns[order.returns.length - 1].status} —{' '}
                {order.returns[order.returns.length - 1].reason}
              </p>
            )}
            {order.refunds && order.refunds.length > 0 && (
              <p className="text-slate-700">
                <span className="font-semibold">Refund Reference:</span>{' '}
                <span className="font-mono font-semibold">
                  {order.refunds[order.refunds.length - 1].referenceId}
                </span>{' '}
                (₹{order.refunds[order.refunds.length - 1].amount.toLocaleString('en-IN')} ·{' '}
                {order.refunds[order.refunds.length - 1].status})
              </p>
            )}
            {currentStatus === 'Payment Failed' && (
              <p className="text-slate-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>Payment could not be confirmed. Contact support if any amount was debited.</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* 8-Step Primary Fulfillment Timeline */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Fulfillment Timeline
          </h3>
          <span className="text-xs text-slate-500">
            Auto-syncs with live admin updates
          </span>
        </div>

        {/* Desktop 8-Column Stepper */}
        <div className="hidden lg:block relative">
          <div className="absolute top-5 left-6 right-6 h-0.5 bg-slate-200 z-0">
            <div
              className={`h-full transition-all duration-500 ${
                currentStatus === 'Order Cancelled' || currentStatus === 'Payment Failed'
                  ? 'bg-rose-500'
                  : 'bg-emerald-600'
              }`}
              style={{
                width: `${(Math.max(0, currentPrimaryIndex) / (PRIMARY_STEPS.length - 1)) * 100}%`,
              }}
            />
          </div>

          <div className="grid grid-cols-8 gap-2 relative z-10">
            {PRIMARY_STEPS.map((step, idx) => {
              const Icon = step.icon;
              const recordedAt = timestampByStatus.get(step.status);
              const isCompleted =
                idx < currentPrimaryIndex ||
                (idx === currentPrimaryIndex &&
                  (currentStatus === 'Delivered' || !isExceptionStatus));
              const isCurrent = !isExceptionStatus && idx === currentPrimaryIndex;
              const isPassed = idx < currentPrimaryIndex || (idx === currentPrimaryIndex && currentStatus === 'Delivered');

              return (
                <div key={step.status} className="flex flex-col items-center text-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${
                      isPassed
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : isCurrent
                        ? 'bg-indigo-600 text-white border-indigo-600 ring-4 ring-indigo-100'
                        : 'bg-white text-slate-400 border-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span
                    className={`mt-2 text-xs font-semibold leading-snug ${
                      isCurrent
                        ? 'text-indigo-700'
                        : isCompleted
                        ? 'text-slate-900'
                        : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5 leading-tight px-1">
                    {recordedAt ? formatDateTimeIN(recordedAt) : step.description}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile / Tablet Vertical Timeline */}
        <div className="lg:hidden space-y-2.5">
          {PRIMARY_STEPS.map((step, idx) => {
            const Icon = step.icon;
            const recordedAt = timestampByStatus.get(step.status);
            const isPassed =
              idx < currentPrimaryIndex ||
              (idx === currentPrimaryIndex && currentStatus === 'Delivered');
            const isCurrent = !isExceptionStatus && idx === currentPrimaryIndex;

            return (
              <div
                key={step.status}
                className={`flex items-start gap-3 p-3 rounded-xl border ${
                  isCurrent
                    ? 'border-indigo-200 bg-indigo-50/40'
                    : isPassed
                    ? 'border-emerald-200/80 bg-emerald-50/20'
                    : 'border-slate-100 bg-slate-50/40 opacity-70'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                    isPassed
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : isCurrent
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-400 border-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`text-xs font-bold ${
                        isCurrent
                          ? 'text-indigo-700'
                          : isPassed
                          ? 'text-slate-900'
                          : 'text-slate-500'
                      }`}
                    >
                      {step.label}
                    </span>
                    {recordedAt ? (
                      <span className="text-[11px] font-medium text-slate-600 tabular-nums">
                        {formatDateTimeIN(recordedAt)}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">Pending</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Permanent Status History Log */}
      {history.length > 0 && (
        <div className="border-t border-slate-100 pt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Recorded Status Updates ({history.length})
          </h3>
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {[...history].reverse().map((entry) => (
              <div
                key={entry.id}
                className="px-4 py-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{entry.status}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500">Updated by {entry.updatedByRole}</span>
                  </div>
                  {entry.note && <p className="text-slate-600">{entry.note}</p>}
                </div>
                <span className="font-mono text-slate-500 shrink-0 tabular-nums">
                  {formatDateTimeIN(entry.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shipping & Support Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-900 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-indigo-600" />
              <span>Shipping Partner</span>
            </span>
            <span className="font-semibold text-slate-900">
              {order.carrier || 'BlueDart Express'}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>Tracking / AWB Number</span>
            <span className="font-mono font-semibold text-slate-900">
              {order.trackingNumber || 'Pending assignment'}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>Estimated Delivery</span>
            <span className="font-semibold text-emerald-700">
              {order.estimatedDelivery || '3-5 Business Days'}
            </span>
          </div>
          {order.shippedAt && (
            <div className="flex items-center justify-between text-slate-600">
              <span>Dispatched On</span>
              <span className="font-medium text-slate-800 tabular-nums">
                {formatDateTimeIN(order.shippedAt)}
              </span>
            </div>
          )}
          {order.deliveredAt && (
            <div className="flex items-center justify-between text-slate-600">
              <span>Delivered On</span>
              <span className="font-semibold text-emerald-700 tabular-nums">
                {formatDateTimeIN(order.deliveredAt)}
              </span>
            </div>
          )}
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-col justify-between gap-3">
          <div>
            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Need Dispatch Assistance?</span>
            </div>
            <p className="text-slate-600 mt-1 leading-relaxed">
              Reach our StepStyle logistics desk directly on WhatsApp or download your GST tax invoice for warranty claims.
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
            <a
              href={`https://wa.me/918830422747?text=${encodeURIComponent(
                `Hello StepStyle, I am checking order ${order.orderNumber || order.orderId} (Current status: ${currentStatus}).`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-h-[38px] px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp Support</span>
            </a>
            <button
              type="button"
              onClick={handleDownloadInvoice}
              className="flex-1 min-h-[38px] px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              <span>Tax Invoice PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

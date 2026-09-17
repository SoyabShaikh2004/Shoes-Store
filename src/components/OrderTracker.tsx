'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Package,
  Truck,
  Box,
  CreditCard,
  MapPin,
  FileText,
  MessageCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { generateTaxInvoicePDF, InvoiceOrderData } from '@/lib/invoiceGenerator';

export type OrderStage =
  | 'placed'
  | 'payment_confirmed'
  | 'processing'
  | 'packing'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered';

export interface OrderTrackerProps {
  order: InvoiceOrderData;
  initialStage?: OrderStage;
  allowSimulate?: boolean;
}

const ORDER_STAGES: Array<{
  id: OrderStage;
  label: string;
  sublabel: string;
  icon: any;
}> = [
  { id: 'placed', label: 'Order Placed', sublabel: 'Order ID verified', icon: CheckCircle2 },
  { id: 'payment_confirmed', label: 'Payment Confirmed', sublabel: 'Auto-verified via Gateway', icon: CreditCard },
  { id: 'processing', label: 'Processing', sublabel: 'Inventory allocated & checked', icon: Clock },
  { id: 'packing', label: 'Packing', sublabel: 'Quality check & gift boxed', icon: Box },
  { id: 'shipped', label: 'Shipped', sublabel: 'Handed to BlueDart Express', icon: Package },
  { id: 'out_for_delivery', label: 'Out for Delivery', sublabel: 'With courier partner', icon: Truck },
  { id: 'delivered', label: 'Delivered', sublabel: 'Safely handed over', icon: MapPin },
];

export default function OrderTracker({
  order,
  initialStage = 'payment_confirmed',
  allowSimulate = true,
}: OrderTrackerProps) {
  const [currentStage, setCurrentStage] = useState<OrderStage>(initialStage);
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);

  const currentStageIndex = ORDER_STAGES.findIndex((s) => s.id === currentStage);

  const handleDownloadInvoice = () => {
    setIsDownloadingInvoice(true);
    try {
      generateTaxInvoicePDF(order);
    } catch (e) {
      console.error('Invoice error:', e);
    } finally {
      setTimeout(() => setIsDownloadingInvoice(false), 800);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
              Live Order Tracker
            </span>
            <span className="text-xs font-mono text-gray-500">
              #{order.orderId}
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-gray-900 mt-1">
            Status: {ORDER_STAGES[currentStageIndex]?.label || 'In Progress'}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Placed on {new Date(order.date).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>

        {/* Action button: Download PDF Tax Invoice */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadInvoice}
            disabled={isDownloadingInvoice}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs sm:text-sm border border-indigo-200 transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>
              {isDownloadingInvoice ? 'Generating PDF...' : 'Download Tax Invoice (PDF)'}
            </span>
          </button>
        </div>
      </div>

      {/* Progress Timeline Stepper */}
      <div className="py-2">
        <div className="relative">
          {/* Horizontal connecting track (hidden on mobile, visible on tablet/desktop) */}
          <div className="hidden lg:block absolute top-5 left-8 right-8 h-1 bg-gray-100 -z-0">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-indigo-600 to-indigo-600 transition-all duration-500"
              style={{
                width: `${(currentStageIndex / (ORDER_STAGES.length - 1)) * 100}%`,
              }}
            />
          </div>

          {/* Desktop Stepper Grid */}
          <div className="hidden lg:grid grid-cols-7 gap-2 relative z-10">
            {ORDER_STAGES.map((stage, idx) => {
              const IconComponent = stage.icon;
              const isPassed = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;
              const isPending = idx > currentStageIndex;

              return (
                <div
                  key={stage.id}
                  onClick={() => allowSimulate && setCurrentStage(stage.id)}
                  className={`flex flex-col items-center text-center cursor-pointer transition-all ${
                    allowSimulate ? 'hover:opacity-90' : ''
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      isPassed
                        ? 'bg-emerald-500 text-white shadow-emerald-500/20 shadow-md'
                        : isCurrent
                        ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 shadow-indigo-600/30 shadow-md scale-110'
                        : 'bg-gray-100 text-gray-400 border border-gray-200'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <span
                    className={`mt-2 text-xs font-bold ${
                      isCurrent
                        ? 'text-indigo-600'
                        : isPassed
                        ? 'text-gray-900'
                        : 'text-gray-400'
                    }`}
                  >
                    {stage.label}
                  </span>
                  <span className="text-[10px] text-gray-400 mt-0.5 leading-tight max-w-[90px]">
                    {stage.sublabel}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Mobile Vertical Stepper */}
          <div className="lg:hidden space-y-3">
            {ORDER_STAGES.map((stage, idx) => {
              const IconComponent = stage.icon;
              const isPassed = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;
              const isPending = idx > currentStageIndex;

              return (
                <div
                  key={stage.id}
                  onClick={() => allowSimulate && setCurrentStage(stage.id)}
                  className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all ${
                    isCurrent
                      ? 'border-indigo-300 bg-indigo-50/50'
                      : isPassed
                      ? 'border-emerald-100 bg-emerald-50/30'
                      : 'border-gray-100 opacity-60'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      isPassed
                        ? 'bg-emerald-500 text-white'
                        : isCurrent
                        ? 'bg-indigo-600 text-white ring-2 ring-indigo-200'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4
                        className={`text-xs font-bold ${
                          isCurrent
                            ? 'text-indigo-700'
                            : isPassed
                            ? 'text-gray-900'
                            : 'text-gray-500'
                        }`}
                      >
                        {stage.label}
                      </h4>
                      {isCurrent && (
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100/70 px-1.5 py-0.2 rounded-full">
                          Current Stage
                        </span>
                      )}
                      {isPassed && (
                        <span className="text-[10px] font-bold text-emerald-600">
                          Completed ✓
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {stage.sublabel}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {allowSimulate && (
          <p className="text-[11px] text-gray-400 text-center mt-3 italic">
            * You can tap any stage to simulate progress or view courier shipment milestones.
          </p>
        )}
      </div>

      {/* Shipment & Courier Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
        {/* Logistics Detail */}
        <div className="p-3.5 rounded-xl bg-gray-50/80 border border-gray-200/80 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-900 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-indigo-600" />
              Delivery Partner
            </span>
            <span className="font-semibold text-indigo-600">BlueDart Express</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Airway Bill (AWB):</span>
            <span className="font-mono font-bold text-gray-900">
              BD-IN-{order.orderId.replace(/\D/g, '').slice(-8) || '84920194'}
            </span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Estimated Delivery:</span>
            <span className="font-bold text-emerald-700">
              {order.estimatedDelivery || 'Within 3-4 Working Days'}
            </span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Shipping Address:</span>
            <span className="font-medium text-gray-800 text-right truncate max-w-[180px]">
              {order.customer.address}, {order.customer.pincode}
            </span>
          </div>
        </div>

        {/* Security & Support */}
        <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100 text-xs space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-indigo-900">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            30-Day Fit & Authenticity Guarantee
          </div>
          <p className="text-[11px] text-gray-600 leading-relaxed">
            Need to change size or adjust delivery address? Our dispatch team is on standby to assist you directly.
          </p>
          <div className="flex gap-2 pt-1">
            <a
              href={`https://wa.me/918830422747?text=${encodeURIComponent(
                `Hello StepStyle, I am tracking my order #${order.orderId}. Can you please provide an update?`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-center flex items-center justify-center gap-1 transition-all"
            >
              <MessageCircle className="w-3 h-3" />
              <span>WhatsApp Update</span>
            </a>
            <button
              type="button"
              onClick={handleDownloadInvoice}
              className="flex-1 py-1.5 px-2.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-bold text-center flex items-center justify-center gap-1 transition-all"
            >
              <FileText className="w-3 h-3 text-indigo-600" />
              <span>Tax Invoice</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

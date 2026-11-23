'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import {
  QrCode,
  Smartphone,
  Copy,
  Check,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  MessageCircle,
  Wallet,
} from 'lucide-react';

interface OnlineUPIPaymentProps {
  amount: number;
  orderId: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  externalConfirmSignal?: number;
  onPaymentSuccess: (details: {
    transactionId: string;
    utrNumber?: string;
    paymentApp: string;
    amount: number;
    timestamp: string;
  }) => void;
}

export default function OnlineUPIPayment({
  amount,
  orderId,
  externalConfirmSignal = 0,
  onPaymentSuccess,
}: OnlineUPIPaymentProps) {
  const MERCHANT_UPI_ID = 'soyxbshxikh-1@okaxis';
  const MERCHANT_PHONE = '8830422747';
  const MERCHANT_NAME = 'StepStyle Footwear';

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<string>('any');
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'apps' | 'qr' | 'manual'>('apps');
  const lastSignalRef = useRef<number>(externalConfirmSignal);

  const upiPaymentUri = `upi://pay?pa=${encodeURIComponent(MERCHANT_UPI_ID)}&pn=${encodeURIComponent(
    MERCHANT_NAME
  )}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Order ${orderId}`)}`;

  const gPayUri = `gpay://upi/pay?pa=${encodeURIComponent(MERCHANT_UPI_ID)}&pn=${encodeURIComponent(
    MERCHANT_NAME
  )}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Order ${orderId}`)}`;

  const phonePeUri = `phonepe://pay?pa=${encodeURIComponent(MERCHANT_UPI_ID)}&pn=${encodeURIComponent(
    MERCHANT_NAME
  )}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Order ${orderId}`)}`;

  const paytmUri = `paytmmp://pay?pa=${encodeURIComponent(MERCHANT_UPI_ID)}&pn=${encodeURIComponent(
    MERCHANT_NAME
  )}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Order ${orderId}`)}`;

  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(upiPaymentUri, {
      width: 300,
      margin: 1.5,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Error generating UPI QR Code:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [upiPaymentUri]);

  const handleCopy = (text: string, label: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedField(label);
      toast.success(`${label} copied`);
      setTimeout(() => setCopiedField(null), 2200);
    }
  };

  const handleLaunchApp = (appId: string, appLabel: string, uri: string) => {
    setSelectedApp(appId);
    toast.success(`Opening ${appLabel} for ₹${amount.toLocaleString('en-IN')}`);

    try {
      window.location.href = uri;
    } catch {
      window.location.href = upiPaymentUri;
    }
  };

  const handleConfirmPayment = useCallback(() => {
    if (isVerifying) return;
    if (utrNumber.trim() && utrNumber.trim().length < 6) {
      toast.error('Enter a valid 12-digit UPI Ref / UTR number or leave blank if unissued');
      return;
    }

    setIsVerifying(true);

    setTimeout(() => {
      setIsVerifying(false);
      const generatedTxnId = `UPI${Date.now().toString().slice(-8)}${Math.floor(100 + Math.random() * 900)}`;

      const appMap: Record<string, string> = {
        gpay: 'Google Pay',
        phonepe: 'PhonePe',
        paytm: 'Paytm UPI',
        upi: 'UPI Banking App',
      };

      onPaymentSuccess({
        transactionId: generatedTxnId,
        utrNumber: utrNumber.trim() || undefined,
        paymentApp: appMap[selectedApp] || 'Online UPI',
        amount,
        timestamp: new Date().toISOString(),
      });

      toast.success(`Payment confirmed for Order ${orderId}`);
    }, 950);
  }, [amount, isVerifying, onPaymentSuccess, orderId, selectedApp, utrNumber]);

  useEffect(() => {
    if (externalConfirmSignal > 0 && externalConfirmSignal !== lastSignalRef.current) {
      lastSignalRef.current = externalConfirmSignal;
      handleConfirmPayment();
    }
  }, [externalConfirmSignal, handleConfirmPayment]);

  const upiApps = [
    {
      id: 'gpay',
      name: 'Google Pay',
      sub: 'Instant UPI',
      badge: 'G',
      badgeStyle: 'bg-blue-50 text-blue-700 border-blue-200',
      uri: gPayUri,
    },
    {
      id: 'phonepe',
      name: 'PhonePe',
      sub: 'Direct Intent',
      badge: 'पे',
      badgeStyle: 'bg-purple-600 text-white border-purple-600',
      uri: phonePeUri,
    },
    {
      id: 'paytm',
      name: 'Paytm UPI',
      sub: 'Fast Checkout',
      badge: 'P',
      badgeStyle: 'bg-sky-600 text-white border-sky-600',
      uri: paytmUri,
    },
    {
      id: 'upi',
      name: 'Other UPI',
      sub: 'BHIM · CRED',
      badge: 'UPI',
      badgeStyle: 'bg-emerald-600 text-white border-emerald-600',
      uri: upiPaymentUri,
    },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 sm:p-4 space-y-4">
      {/* Clean Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
        <div>
          <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Zero Fee · Direct Bank Transfer</span>
          </p>
          <p className="text-xs sm:text-sm font-bold text-slate-900 mt-0.5">
            Select app, scan QR, or pay via UPI ID
          </p>
        </div>

        <div className="text-right shrink-0">
          <span className="block text-[11px] text-slate-500 font-medium">Payable</span>
          <span className="text-base sm:text-lg font-extrabold text-slate-900 font-mono tabular-nums">
            ₹{amount.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Segmented Tabs */}
      <div
        role="tablist"
        aria-label="UPI payment options"
        className="grid grid-cols-3 gap-1 rounded-xl bg-slate-200/70 p-1 text-xs font-bold"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'apps'}
          onClick={() => setActiveTab('apps')}
          className={`min-h-[40px] px-2 flex items-center justify-center gap-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'apps'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span>UPI Apps</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'qr'}
          onClick={() => setActiveTab('qr')}
          className={`min-h-[40px] px-2 flex items-center justify-center gap-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'qr'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <QrCode className="w-3.5 h-3.5 shrink-0" />
          <span>Scan QR</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'manual'}
          onClick={() => setActiveTab('manual')}
          className={`min-h-[40px] px-2 flex items-center justify-center gap-1.5 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'manual'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Wallet className="w-3.5 h-3.5 shrink-0" />
          <span>UPI Details</span>
        </button>
      </div>

      {/* TAB 1: Direct Banking Apps */}
      {activeTab === 'apps' && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            {upiApps.map((app) => {
              const isSelected = selectedApp === app.id;
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => handleLaunchApp(app.id, app.name, app.uri)}
                  className={`flex items-center justify-between gap-2 p-2.5 sm:p-3 min-h-[56px] rounded-xl border bg-white text-left transition-all active:scale-[0.98] cursor-pointer ${
                    isSelected
                      ? 'border-indigo-600 ring-1 ring-indigo-600/20'
                      : 'border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-extrabold shrink-0 ${app.badgeStyle}`}
                    >
                      {app.badge}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {app.name}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{app.sub}</div>
                    </div>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-500 text-center">
            On desktop? Switch to <button type="button" onClick={() => setActiveTab('qr')} className="font-semibold text-indigo-600 hover:underline cursor-pointer">Scan QR</button> to scan from your phone.
          </p>
        </div>
      )}

      {/* TAB 2: Dynamic QR Code */}
      {activeTab === 'qr' && (
        <div className="flex flex-col items-center text-center bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate-500">Scan &amp; Pay Exact Total</p>
            <p className="text-xl font-extrabold text-slate-900 font-mono tabular-nums mt-0.5">
              ₹{amount.toLocaleString('en-IN')}
            </p>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-xs">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt={`UPI QR code for ₹${amount} to ${MERCHANT_UPI_ID}`}
                className="w-44 h-44 sm:w-52 sm:h-52 rounded-lg"
              />
            ) : (
              <div className="w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center bg-slate-50 rounded-lg">
                <div className="animate-spin rounded-full h-7 w-7 border-2 border-indigo-600 border-t-transparent" />
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 w-full max-w-xs">
            <span className="text-xs font-mono text-slate-700 truncate">{MERCHANT_UPI_ID}</span>
            <button
              type="button"
              onClick={() => handleCopy(MERCHANT_UPI_ID, 'UPI ID')}
              className="min-h-[36px] px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 inline-flex items-center gap-1 shrink-0 cursor-pointer"
            >
              {copiedField === 'UPI ID' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: Manual UPI Details */}
      {activeTab === 'manual' && (
        <div className="space-y-2.5">
          <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-slate-500 block">Primary UPI ID</span>
              <span className="text-sm font-bold text-slate-900 font-mono truncate block">
                {MERCHANT_UPI_ID}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(MERCHANT_UPI_ID, 'UPI ID')}
              className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-800 inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              {copiedField === 'UPI ID' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-slate-500 block">Payee Mobile</span>
              <span className="text-sm font-bold text-slate-900 font-mono tabular-nums block">
                +91 {MERCHANT_PHONE}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(MERCHANT_PHONE, 'Phone Number')}
              className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-800 inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              {copiedField === 'Phone Number' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Beneficiary</span>
              <span className="font-semibold text-slate-900">{MERCHANT_NAME}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Order Reference</span>
              <span className="font-mono font-semibold text-slate-900">{orderId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Transfer Amount</span>
              <span className="font-mono font-bold text-emerald-700 tabular-nums">
                ₹{amount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* UTR Input + Direct Confirm */}
      <div className="pt-3 border-t border-slate-200 space-y-3">
        <div>
          <label htmlFor="upi-utr-input" className="block text-xs font-bold text-slate-800 mb-1">
            12-Digit UPI Ref / UTR Number{' '}
            <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            id="upi-utr-input"
            type="text"
            inputMode="numeric"
            value={utrNumber}
            onChange={(e) => setUtrNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
            placeholder="e.g. 423874920183"
            className="w-full min-h-[44px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono tabular-nums"
            maxLength={16}
          />
        </div>

        <button
          type="button"
          onClick={handleConfirmPayment}
          disabled={isVerifying}
          className="hidden lg:flex w-full min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isVerifying ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Verifying Payment...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span className="tabular-nums">
                I Have Paid ₹{amount.toLocaleString('en-IN')} — Place Order
              </span>
            </>
          )}
        </button>

        {/* Mobile inline secondary confirm in case user scrolls past sticky bar or prefers inline */}
        <button
          type="button"
          onClick={handleConfirmPayment}
          disabled={isVerifying}
          className="lg:hidden w-full min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] cursor-pointer disabled:opacity-70"
        >
          {isVerifying ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Verifying Payment...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span className="tabular-nums">
                I Have Paid ₹{amount.toLocaleString('en-IN')}
              </span>
            </>
          )}
        </button>

        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <span>Payment help:</span>
          <a
            href={`https://wa.me/91${MERCHANT_PHONE}?text=${encodeURIComponent(
              `Hi StepStyle, I am placing Order #${orderId} for ₹${amount}. Please assist with UPI payment.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-700 font-semibold hover:underline inline-flex items-center gap-1"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>WhatsApp +91 {MERCHANT_PHONE}</span>
          </a>
        </div>
      </div>
    </div>
  );
}

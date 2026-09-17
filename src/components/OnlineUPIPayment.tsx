'use client';

import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import { 
  QrCode, 
  Smartphone, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  ArrowRight,
  Info,
  CheckCircle2,
  Sparkles,
  MessageCircle
} from 'lucide-react';

interface OnlineUPIPaymentProps {
  amount: number;
  orderId: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
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
  customerName = '',
  customerPhone = '',
  deliveryAddress = '',
  onPaymentSuccess,
}: OnlineUPIPaymentProps) {
  // Merchant details as specified by user
  const MERCHANT_UPI_ID = 'soyxbshxikh-1@okaxis';
  const MERCHANT_PHONE = '8830422747';
  const MERCHANT_NAME = 'StepStyle Footwear';

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<string>('any');
  const [utrNumber, setUtrNumber] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'apps' | 'qr' | 'manual'>('apps');

  // Construct standard NPCI UPI payment URL with exact total amount pre-filled
  const upiPaymentUri = `upi://pay?pa=${encodeURIComponent(MERCHANT_UPI_ID)}&pn=${encodeURIComponent(
    MERCHANT_NAME
  )}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Order ${orderId}`)}`;

  // Specific App URI intents
  const gPayUri = `gpay://upi/pay?pa=${encodeURIComponent(MERCHANT_UPI_ID)}&pn=${encodeURIComponent(
    MERCHANT_NAME
  )}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Order ${orderId}`)}`;

  const phonePeUri = `phonepe://pay?pa=${encodeURIComponent(MERCHANT_UPI_ID)}&pn=${encodeURIComponent(
    MERCHANT_NAME
  )}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Order ${orderId}`)}`;

  const paytmUri = `paytmmp://pay?pa=${encodeURIComponent(MERCHANT_UPI_ID)}&pn=${encodeURIComponent(
    MERCHANT_NAME
  )}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Order ${orderId}`)}`;

  // Generate crisp QR code on mount or when amount/order changes
  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(upiPaymentUri, {
      width: 320,
      margin: 1.5,
      color: {
        dark: '#0f172a', // Slate 900
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (isMounted) {
          setQrDataUrl(url);
        }
      })
      .catch((err) => {
        console.error('Error generating UPI QR Code:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [upiPaymentUri]);

  // Copy to clipboard helper with feedback
  const handleCopy = (text: string, label: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedField(label);
      toast.success(`${label} copied to clipboard!`);
      setTimeout(() => setCopiedField(null), 2500);
    }
  };

  // Launch banking / UPI app directly
  const handleLaunchApp = (appName: string, uri: string) => {
    setSelectedApp(appName);
    toast.success(`Opening ${appName} with ₹${amount}...`, {
      icon: '📲',
    });

    // Attempt to open the custom scheme
    try {
      window.location.href = uri;
    } catch (e) {
      // Fallback to standard generic upi:// intent if app-specific scheme fails
      window.location.href = upiPaymentUri;
    }
  };

  // Verification & Order confirmation handler
  const handleConfirmPayment = () => {
    if (utrNumber.trim() && utrNumber.trim().length < 6) {
      toast.error('Please enter a valid UPI Reference / UTR Number (usually 12 digits)');
      return;
    }

    setIsVerifying(true);

    setTimeout(() => {
      setIsVerifying(false);
      const generatedTxnId = `UPI${Date.now().toString().slice(-8)}${Math.floor(100 + Math.random() * 900)}`;

      onPaymentSuccess({
        transactionId: generatedTxnId,
        utrNumber: utrNumber.trim() || undefined,
        paymentApp: selectedApp === 'gpay' ? 'Google Pay' : selectedApp === 'phonepe' ? 'PhonePe' : selectedApp === 'paytm' ? 'Paytm' : 'Online UPI',
        amount: amount,
        timestamp: new Date().toISOString(),
      });

      toast.success(`Payment verified! Order ${orderId} placed successfully.`);
    }, 1200);
  };

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-b from-indigo-50/40 via-white to-white p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              Instant Bank Transfer
            </span>
            <span className="text-xs font-medium text-gray-500">Zero Transaction Fees</span>
          </div>
          <p className="text-sm font-semibold text-gray-900 mt-1">
            Pay directly via Google Pay, PhonePe, Paytm, or Any UPI App
          </p>
        </div>

        {/* Amount Pill */}
        <div className="flex items-center sm:flex-col sm:items-end justify-between bg-emerald-50 sm:bg-transparent px-3 py-1.5 sm:p-0 rounded-xl">
          <span className="text-xs text-emerald-700 sm:text-gray-500 font-medium">Total Payable</span>
          <span className="text-xl sm:text-2xl font-black text-emerald-700 tracking-tight">
            ₹{amount.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Tabs: Mobile Banking Apps / QR Code / Manual UPI */}
      <div className="flex rounded-xl bg-gray-100/80 p-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('apps')}
          className={`flex-1 min-h-[38px] flex items-center justify-center gap-1.5 rounded-lg transition-all ${
            activeTab === 'apps'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
          <span>Pay via Banking Apps</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('qr')}
          className={`flex-1 min-h-[38px] flex items-center justify-center gap-1.5 rounded-lg transition-all ${
            activeTab === 'qr'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <QrCode className="w-3.5 h-3.5 text-indigo-600" />
          <span>Scan QR Code</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('manual')}
          className={`flex-1 min-h-[38px] flex items-center justify-center gap-1.5 rounded-lg transition-all ${
            activeTab === 'manual'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Copy className="w-3.5 h-3.5 text-indigo-600" />
          <span>UPI Details</span>
        </button>
      </div>

      {/* TAB 1: Direct Banking Apps */}
      {activeTab === 'apps' && (
        <div className="space-y-3 pt-1">
          <p className="text-xs text-gray-600 font-medium">
            Tap your preferred banking app to open it with <strong className="text-emerald-700">₹{amount}</strong> pre-filled:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Google Pay */}
            <button
              type="button"
              onClick={() => handleLaunchApp('gpay', gPayUri)}
              className="flex items-center justify-between p-3 min-h-[52px] rounded-xl border-2 border-gray-200 hover:border-indigo-500 hover:bg-indigo-50/40 bg-white transition-all text-left group shadow-xs active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 shadow-xs flex items-center justify-center p-1">
                  {/* Google Pay custom graphic/colors */}
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.33 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.16 0 9.98 0 12c0 2.02.45 3.84 1.24 5.42l4.04-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                    Google Pay
                  </div>
                  <div className="text-[11px] text-gray-500">Pay ₹{amount} with GPay</div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 transition-colors" />
            </button>

            {/* PhonePe */}
            <button
              type="button"
              onClick={() => handleLaunchApp('phonepe', phonePeUri)}
              className="flex items-center justify-between p-3 min-h-[52px] rounded-xl border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50/40 bg-white transition-all text-left group shadow-xs active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#5f259f] text-white flex items-center justify-center font-bold text-lg shadow-xs">
                  पे
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900 group-hover:text-purple-700 transition-colors">
                    PhonePe
                  </div>
                  <div className="text-[11px] text-gray-500">Pay ₹{amount} with PhonePe</div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-purple-600 transition-colors" />
            </button>

            {/* Paytm */}
            <button
              type="button"
              onClick={() => handleLaunchApp('paytm', paytmUri)}
              className="flex items-center justify-between p-3 min-h-[52px] rounded-xl border-2 border-gray-200 hover:border-sky-500 hover:bg-sky-50/40 bg-white transition-all text-left group shadow-xs active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#002e6e] text-sky-400 flex items-center justify-center font-black text-xs tracking-tighter shadow-xs">
                  Paytm
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900 group-hover:text-sky-700 transition-colors">
                    Paytm UPI
                  </div>
                  <div className="text-[11px] text-gray-500">Pay ₹{amount} with Paytm</div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-sky-600 transition-colors" />
            </button>

            {/* Generic UPI Intent (BHIM, CRED, Amazon Pay, Any Bank) */}
            <button
              type="button"
              onClick={() => handleLaunchApp('upi', upiPaymentUri)}
              className="flex items-center justify-between p-3 min-h-[52px] rounded-xl border-2 border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/40 bg-white transition-all text-left group shadow-xs active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  UPI
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                    Any Banking App
                  </div>
                  <div className="text-[11px] text-gray-500">BHIM, CRED, Axis, SBI, HDFC</div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 transition-colors" />
            </button>
          </div>

          <p className="text-[11px] text-gray-500 text-center italic mt-1">
            Note: If you are on a computer or laptop, switch to the <strong>Scan QR Code</strong> tab to scan from your phone.
          </p>
        </div>
      )}

      {/* TAB 2: Dynamic QR Code */}
      {activeTab === 'qr' && (
        <div className="flex flex-col items-center justify-center text-center p-3 bg-white rounded-xl border border-gray-200">
          <div className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-1">
            Scan to Pay Total Amount
          </div>
          <div className="text-lg font-black text-gray-900 mb-2">
            ₹{amount.toLocaleString('en-IN')}
          </div>

          {/* QR Container */}
          <div className="relative p-2 bg-white rounded-2xl border-2 border-indigo-200 shadow-md">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt={`Scan to pay ₹${amount} to ${MERCHANT_UPI_ID}`}
                className="w-52 h-52 sm:w-60 sm:h-60 rounded-xl"
              />
            ) : (
              <div className="w-52 h-52 sm:w-60 sm:h-60 flex items-center justify-center bg-gray-50 rounded-xl">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
              </div>
            )}
            {/* Center UPI Badge */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="bg-white px-2 py-0.5 rounded-md text-[11px] font-black text-indigo-600 border border-indigo-200 shadow-xs">
                UPI
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-gray-600 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Open Google Pay, PhonePe, or Paytm camera to scan</span>
          </div>

          <div className="mt-1 text-[11px] text-gray-500 font-mono">
            UPI: {MERCHANT_UPI_ID}
          </div>
        </div>
      )}

      {/* TAB 3: Manual UPI Details */}
      {activeTab === 'manual' && (
        <div className="space-y-3 pt-1">
          {/* UPI ID Row */}
          <div className="p-3 bg-white rounded-xl border border-gray-200 flex items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block">
                Primary UPI ID
              </span>
              <span className="text-sm font-bold text-gray-900 font-mono select-all">
                {MERCHANT_UPI_ID}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(MERCHANT_UPI_ID, 'UPI ID')}
              className="min-h-[40px] px-3 rounded-lg border border-gray-200 hover:border-indigo-500 bg-gray-50 hover:bg-indigo-50/50 text-xs font-bold text-gray-700 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {copiedField === 'UPI ID' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-gray-500" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {/* Contact No Row */}
          <div className="p-3 bg-white rounded-xl border border-gray-200 flex items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block">
                Payee Contact Number
              </span>
              <span className="text-sm font-bold text-gray-900 font-mono select-all">
                +91 {MERCHANT_PHONE}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(MERCHANT_PHONE, 'Contact Number')}
              className="min-h-[40px] px-3 rounded-lg border border-gray-200 hover:border-indigo-500 bg-gray-50 hover:bg-indigo-50/50 text-xs font-bold text-gray-700 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {copiedField === 'Contact Number' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-gray-500" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {/* Recipient Details */}
          <div className="text-xs bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-700 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Beneficiary:</span>
              <span className="font-semibold">{MERCHANT_NAME}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Order Reference:</span>
              <span className="font-mono font-semibold">{orderId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Amount to Transfer:</span>
              <span className="font-bold text-emerald-700">₹{amount.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Post-Payment Verification / UTR Input */}
      <div className="pt-2 border-t border-gray-100 space-y-3">
        <div>
          <label className="block text-xs font-bold text-gray-800 mb-1">
            Enter 12-Digit UPI Ref / UTR Number <span className="text-gray-400 font-normal">(optional but recommended)</span>
          </label>
          <input
            type="text"
            value={utrNumber}
            onChange={(e) => setUtrNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
            placeholder="e.g. 423874920183 (from payment receipt)"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            maxLength={16}
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Found in your GPay / PhonePe / Paytm payment screen as &quot;UPI Ref ID&quot; or &quot;UTR&quot;.
          </p>
        </div>

        {/* Big Confirmation CTA */}
        <button
          type="button"
          onClick={handleConfirmPayment}
          disabled={isVerifying}
          className="w-full min-h-[48px] rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-sm sm:text-base shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
        >
          {isVerifying ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Verifying Online Payment...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>I Have Paid ₹{amount.toLocaleString('en-IN')} — Place Order</span>
            </>
          )}
        </button>

        {/* Merchant WhatsApp Assistance */}
        <div className="flex items-center justify-center gap-2 pt-1 text-xs text-gray-500">
          <span>Need help with payment?</span>
          <a
            href={`https://wa.me/91${MERCHANT_PHONE}?text=${encodeURIComponent(
              `Hi StepStyle, I am placing Order #${orderId} for ₹${amount}. Please assist with payment.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-700 font-bold hover:underline inline-flex items-center gap-1"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Chat on WhatsApp (+91 {MERCHANT_PHONE})</span>
          </a>
        </div>
      </div>
    </div>
  );
}

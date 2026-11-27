'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  X,
  ShoppingBag,
  Zap,
  Minus,
  Plus,
  Check,
  Lock,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Product } from '@/lib/data';
import { resolveProductImage } from '@/lib/productImages';
import { notifyStorefrontChanged } from '@/lib/storefrontSync';
import GoogleSignInButton from '@/components/GoogleSignInButton';

interface QuickOrderDrawerProps {
  product: Product | null;
  onClose: () => void;
}

interface CartStorageItem extends Product {
  selectedColor: string;
  selectedSize: number;
  quantity: number;
}


export default function QuickOrderDrawer({ product, onClose }: QuickOrderDrawerProps) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();

  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [imgError, setImgError] = useState(false);
  const [sizeError, setSizeError] = useState(false);

  // Inline quick sign-in prompt state when user taps Buy Now while signed out
  const [showAuthStep, setShowAuthStep] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (!product) return;
    setImgError(false);
    setSizeError(false);
    setShowAuthStep(false);
    setAuthError('');
    setQuantity(1);
    setSelectedColor(product.colors?.[0] || 'Standard');
    setSelectedSize(product.sizes?.length === 1 ? product.sizes[0] : null);

    if (localStorage.getItem('isAuthenticated') !== 'true') {
      fetch('/api/auth/google/session', { credentials: 'include', cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.authenticated && data.user) {
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('authUser', JSON.stringify(data.user));
            window.dispatchEvent(new Event('authUpdated'));
          }
        })
        .catch(() => undefined);
    }
  }, [product]);

  useEffect(() => {
    if (!product) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [product, onClose]);

  const maxStock = Math.max(1, product?.stockQuantity ?? 10);
  const isAvailable = Boolean(product && product.inStock && product.status !== 'inactive' && maxStock > 0);

  const persistItemToCart = (): boolean => {
    if (!product || !isAvailable) {
      toast.error('This shoe is currently out of stock.');
      return false;
    }

    if (product.sizes.length > 0 && !selectedSize) {
      setSizeError(true);
      toast.error('Please select your UK shoe size');
      return false;
    }

    const sizeValue = selectedSize || product.sizes[0] || 8;
    const colorValue = selectedColor || product.colors[0] || 'Standard';

    try {
      const existing = JSON.parse(localStorage.getItem('cartItems') || '[]') as CartStorageItem[];
      const idx = existing.findIndex(
        (item) =>
          item.id === product.id &&
          item.selectedSize === sizeValue &&
          (item.selectedColor || '') === colorValue
      );

      if (idx >= 0) {
        existing[idx].quantity = Math.min(maxStock, (existing[idx].quantity || 1) + quantity);
      } else {
        existing.push({
          ...product,
          selectedColor: colorValue,
          selectedSize: sizeValue,
          quantity,
        });
      }

      localStorage.setItem('cartItems', JSON.stringify(existing));
      window.dispatchEvent(new Event('cartUpdated'));
      return true;
    } catch {
      toast.error('Could not update cart');
      return false;
    }
  };

  const handleAddToBag = () => {
    if (!persistItemToCart() || !product) return;
    toast.success(`Added ${product.name} (UK ${selectedSize || product.sizes[0]}) to cart`);
    onClose();
  };

  const handleBuyNow = () => {
    if (!persistItemToCart()) return;
    const isAuth = localStorage.getItem('isAuthenticated') === 'true';
    if (!isAuth) {
      setShowAuthStep(true);
      return;
    }
    onClose();
    router.push('/cart?checkout=quick');
  };

  const handleInlineSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const cleanId = identifier.trim();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanId);
    const phoneValid = /^[0-9]{10}$/.test(cleanId);

    if (!emailValid && !phoneValid) {
      setAuthError('Enter a valid email or 10-digit mobile number.');
      return;
    }
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    setIsSigningIn(true);
    try {
      const res = await fetch('/api/auth/customer/sync', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          action: 'login',
          identifier: cleanId,
          password,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data?.user) {
        setAuthError(data?.error || 'Invalid credentials. Please check your email/mobile and password.');
        return;
      }

      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('authUser', JSON.stringify(data.user));
      localStorage.removeItem('users');
      window.dispatchEvent(new Event('authUpdated'));
      notifyStorefrontChanged('customers');
      toast.success('Signed in! Proceeding to checkout...');
      onClose();
      router.push('/cart?checkout=quick');
    } catch {
      setAuthError('Network error while signing in. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const imageSrc = product
    ? imgError
      ? '/images/Empty-cart.jpg'
      : resolveProductImage(product)
    : '/images/Empty-cart.jpg';

  const hasDiscount = Boolean(product?.mrp && product.mrp > product.price);
  const discountPct =
    product && hasDiscount
      ? Math.round(((product.mrp! - product.price) / product.mrp!) * 100)
      : 0;

  return (
    <AnimatePresence>
      {product && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-order-title"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
          />

          {/* Sheet Surface */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { y: '100%', opacity: 0.9 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { y: '100%', opacity: 0.9 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl max-h-[90dvh] flex flex-col overflow-hidden"
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden pt-3 pb-1 flex justify-center">
              <div className="w-10 h-1.5 rounded-full bg-slate-300" />
            </div>

            {/* Header Summary */}
            <div className="px-4 sm:px-6 pt-3 sm:pt-5 pb-4 border-b border-slate-100 flex items-start gap-3.5">
              <div className="relative w-20 h-20 rounded-xl bg-slate-50 border border-slate-200/80 shrink-0 overflow-hidden">
                <Image
                  src={imageSrc}
                  alt={product.name}
                  fill
                  referrerPolicy="no-referrer"
                  unoptimized={imageSrc.startsWith('data:')}
                  className="object-contain p-1.5"
                  onError={() => setImgError(true)}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <span>{product.brand || 'StepStyle'}</span>
                  <span aria-hidden="true">·</span>
                  <span>{product.category}</span>
                </div>
                <h2
                  id="quick-order-title"
                  className="text-base sm:text-lg font-bold text-slate-900 leading-snug line-clamp-2 mt-0.5"
                >
                  {product.name}
                </h2>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <span className="text-lg font-extrabold text-slate-900 tabular-nums">
                    ₹{product.price.toLocaleString('en-IN')}
                  </span>
                  {hasDiscount && (
                    <span className="text-xs text-slate-400 line-through tabular-nums">
                      ₹{product.mrp!.toLocaleString('en-IN')}
                    </span>
                  )}
                  {discountPct > 0 && (
                    <span className="text-xs font-bold text-emerald-700 tabular-nums">
                      Save {discountPct}%
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close quick order"
                className="min-w-[44px] min-h-[44px] -mr-2 -mt-1 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
              {!showAuthStep ? (
                <>
                  {/* UK Size Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span
                        className={`text-sm font-bold ${
                          sizeError ? 'text-rose-600' : 'text-slate-900'
                        }`}
                      >
                        {sizeError ? 'Select a UK Size to continue' : 'Select Size (UK)'}
                      </span>
                      <span className="text-xs text-slate-500 tabular-nums">
                        {isAvailable
                          ? maxStock <= 8
                            ? `Only ${maxStock} left`
                            : 'In Stock'
                          : 'Out of Stock'}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                      {product.sizes.map((size) => {
                        const active = selectedSize === size;
                        return (
                          <button
                            key={size}
                            type="button"
                            disabled={!isAvailable}
                            onClick={() => {
                              setSelectedSize(size);
                              setSizeError(false);
                            }}
                            className={`min-h-[44px] rounded-xl text-sm font-bold tabular-nums border transition-all cursor-pointer active:scale-95 ${
                              !isAvailable
                                ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                                : active
                                ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                                : sizeError
                                ? 'border-rose-300 bg-rose-50/40 text-slate-800 hover:border-slate-900'
                                : 'border-slate-200 bg-white text-slate-800 hover:border-slate-400'
                            }`}
                          >
                            UK {size}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Color Selection (when multiple options exist) */}
                  {product.colors && product.colors.length > 1 && (
                    <div>
                      <span className="block text-sm font-bold text-slate-900 mb-2">
                        Colorway: <span className="font-medium text-slate-600">{selectedColor}</span>
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {product.colors.map((color) => {
                          const active = selectedColor === color;
                          return (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setSelectedColor(color)}
                              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                                active
                                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              {active && <Check className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />}
                              {color}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Quantity Stepper & Details Link */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div>
                      <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Quantity
                      </span>
                      <div className="mt-1.5 inline-flex items-center border border-slate-200 rounded-xl bg-slate-50">
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          disabled={quantity <= 1}
                          aria-label="Decrease quantity"
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-700 disabled:text-slate-300 cursor-pointer"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-10 text-center text-sm font-bold text-slate-900 tabular-nums">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => Math.min(maxStock, q + 1))}
                          disabled={quantity >= maxStock}
                          aria-label="Increase quantity"
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-700 disabled:text-slate-300 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <Link
                      href={`/products/${product.id}`}
                      onClick={onClose}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 py-2 px-3 rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                      <span>View Full Specs</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </>
              ) : (
                /* Inline Sign-In Gate so unauthenticated shoppers never lose quick-order context */
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100">
                    <Lock className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        Sign in to place your order
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Your UK {selectedSize || product.sizes[0]} pair is saved in your cart. Sign in below to proceed straight to UPI / COD checkout.
                      </p>
                    </div>
                  </div>

                  <GoogleSignInButton
                    label="Continue with Google"
                    disabled={isSigningIn}
                    onSuccess={() => {
                      toast.success('Signed in! Proceeding to checkout...');
                      onClose();
                      router.push('/cart?checkout=quick');
                    }}
                    onError={(msg) => setAuthError(msg)}
                  />

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-[11px] uppercase">
                      <span className="bg-white px-2.5 text-slate-400 font-medium">
                        or sign in with email / mobile
                      </span>
                    </div>
                  </div>

                  <form onSubmit={handleInlineSignIn} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Email or 10-Digit Mobile
                      </label>
                      <input
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="you@example.com or 9876543210"
                        className="w-full min-h-[44px] px-3.5 py-2 text-base sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full min-h-[44px] px-3.5 py-2 text-base sm:text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {authError && (
                      <p className="text-xs font-medium text-rose-600">{authError}</p>
                    )}

                    <button
                      type="submit"
                      disabled={isSigningIn}
                      className="w-full min-h-[48px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      <span>{isSigningIn ? 'Signing in...' : 'Sign In & Continue to Checkout'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <button
                      type="button"
                      onClick={() => setShowAuthStep(false)}
                      className="font-semibold text-slate-600 hover:text-slate-900 py-2 cursor-pointer"
                    >
                      Back to Size Selection
                    </button>
                    <Link
                      href={`/auth/signup?redirect=${encodeURIComponent('/cart?checkout=quick')}`}
                      onClick={onClose}
                      className="font-bold text-indigo-600 hover:underline py-2"
                    >
                      New customer? Create account
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Pinned Action Bar */}
            {!showAuthStep && (
              <div className="p-4 sm:px-6 sm:py-4 border-t border-slate-200 bg-white pb-safe grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={!isAvailable}
                  onClick={handleAddToBag}
                  className="min-h-[48px] rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Add to Cart</span>
                </button>

                <button
                  type="button"
                  disabled={!isAvailable}
                  onClick={handleBuyNow}
                  className="min-h-[48px] rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                >
                  <Zap className="w-4 h-4" />
                  <span className="tabular-nums">
                    Buy Now · ₹{(product.price * quantity).toLocaleString('en-IN')}
                  </span>
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingBag, ShoppingCart, PackageSearch } from 'lucide-react';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState(0);
  const [checkoutOrderComplete, setCheckoutOrderComplete] = useState(false);

  useEffect(() => {
    const syncCartCount = () => {
      try {
        const raw = localStorage.getItem('cartItems');
        if (!raw) {
          setCartCount(0);
          return;
        }
        const items = JSON.parse(raw);
        if (Array.isArray(items)) {
          const total = items.reduce(
            (sum: number, item: { quantity?: number }) => sum + (Number(item.quantity) || 1),
            0
          );
          setCartCount(total);
        } else {
          setCartCount(0);
        }
      } catch {
        setCartCount(0);
      }
    };

    const handleCheckoutUi = (e: Event) => {
      const custom = e as CustomEvent<{ orderComplete?: boolean }>;
      setCheckoutOrderComplete(Boolean(custom.detail?.orderComplete));
    };

    syncCartCount();
    setCheckoutOrderComplete(false);
    window.addEventListener('storage', syncCartCount);
    window.addEventListener('cartUpdated', syncCartCount);
    window.addEventListener('checkoutUiState', handleCheckoutUi);
    return () => {
      window.removeEventListener('storage', syncCartCount);
      window.removeEventListener('cartUpdated', syncCartCount);
      window.removeEventListener('checkoutUiState', handleCheckoutUi);
    };
  }, [pathname]);

  // Suppress global bottom bar during active /cart checkout so only the sticky Payable Bar occupies the bottom edge (<=15% sticky cap)
  if (pathname?.startsWith('/cart') && cartCount > 0 && !checkoutOrderComplete) {
    return null;
  }

  const navItems = [
    {
      label: 'Home',
      href: '/',
      icon: Home,
      active: pathname === '/',
    },
    {
      label: 'Shop',
      href: '/products',
      icon: ShoppingBag,
      active: pathname?.startsWith('/products'),
    },
    {
      label: 'Cart',
      href: '/cart',
      icon: ShoppingCart,
      active: pathname?.startsWith('/cart'),
      badge: cartCount,
    },
    {
      label: 'Track',
      href: '/track-order',
      icon: PackageSearch,
      active: pathname?.startsWith('/track-order'),
    },
  ];

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe shadow-[0_-4px_20px_rgba(15,23,42,0.06)]"
    >
      <div className="grid grid-cols-4 h-16 max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center min-h-[44px] transition-colors active:scale-95 ${
                item.active ? 'text-indigo-600' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.active && (
                <span className="absolute top-0 inset-x-6 h-0.5 bg-indigo-600 rounded-b-full" />
              )}
              <div className="relative">
                <Icon className="w-5 h-5" strokeWidth={item.active ? 2.25 : 1.75} />
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold tabular-nums flex items-center justify-center leading-none">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] mt-1 tracking-tight whitespace-nowrap ${
                  item.active ? 'font-bold text-indigo-600' : 'font-medium'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

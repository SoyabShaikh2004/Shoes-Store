'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [cartItemsCount, setCartItemsCount] = useState(0);
  const [wishlistItemsCount, setWishlistItemsCount] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authUser, setAuthUser] = useState<any>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showUserMenu && !(event.target as Element).closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
      
      if (isMenuOpen && !(event.target as Element).closest('.mobile-menu-container')) {
        setIsMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu, isMenuOpen]);

  // Check authentication status on initial load and when it changes
  useEffect(() => {
    const checkAuth = async () => {
      const authStatus = localStorage.getItem('isAuthenticated') === 'true';
      setIsAuthenticated(authStatus);
      
      if (authStatus) {
        const userDataString = localStorage.getItem('authUser');
        if (userDataString) {
          try {
            const parsedData = JSON.parse(userDataString);
            setAuthUser(parsedData);
          } catch {
            // ignore invalid stored JSON
          }
        }
        return;
      }

      try {
        const res = await fetch('/api/auth/google/session', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('authUser', JSON.stringify(data.user));
            setIsAuthenticated(true);
            setAuthUser(data.user);
          }
        }
      } catch {
        // ignore network errors
      }
    };
    
    checkAuth();
    window.addEventListener('storage', checkAuth);
    
    // Custom event for auth status changes
    window.addEventListener('authUpdated', checkAuth);
    
    return () => {
      window.removeEventListener('storage', checkAuth);
      window.removeEventListener('authUpdated', checkAuth);
    };
  }, []);

  // Load cart and wishlist counts
  useEffect(() => {
    const updateCounts = () => {
      // Get cart items
      const cartItems = localStorage.getItem('cartItems');
      if (cartItems) {
        const parsedCartItems = JSON.parse(cartItems);
        setCartItemsCount(parsedCartItems.length);
      }

      // Get wishlist items
      const wishlistItems = localStorage.getItem('wishlistItems');
      if (wishlistItems) {
        const parsedWishlistItems = JSON.parse(wishlistItems);
        setWishlistItemsCount(parsedWishlistItems.length);
      }
    };

    // Update counts on initial load
    updateCounts();

    // Set up event listener for storage changes
    window.addEventListener('storage', updateCounts);
    
    // Custom event for cart/wishlist updates
    window.addEventListener('cartUpdated', updateCounts);
    window.addEventListener('wishlistUpdated', updateCounts);

    return () => {
      window.removeEventListener('storage', updateCounts);
      window.removeEventListener('cartUpdated', updateCounts);
      window.removeEventListener('wishlistUpdated', updateCounts);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('authUser');

    fetch('/api/auth/google/session', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ action: 'logout' }),
    }).catch(() => {});

    setIsAuthenticated(false);
    setAuthUser(null);
    setShowUserMenu(false);

    window.dispatchEvent(new Event('authUpdated'));
  };

  return (
    <header
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        isScrolled ? 'bg-white shadow-md' : 'bg-white'
      }`}
    >
      <div className="container mx-auto max-w-7xl px-3.5 sm:px-4">
        <div className="flex h-14 sm:h-16 md:h-20 items-center justify-between gap-2">
          <div className="flex items-center shrink-0">
            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="mr-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl p-2 text-gray-700 hover:bg-gray-100 md:hidden cursor-pointer transition-colors"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              )}
            </button>
            
            <Link href="/" className="flex items-center shrink-0">
              <Image
                src="/images/logo.svg"
                alt="StepStyle Logo"
                width={48}
                height={48}
                className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12"
              />
            </Link>
          </div>

          {/* Tablet & Desktop Navigation */}
          <nav className="hidden md:block">
            <ul className="flex items-center space-x-5 lg:space-x-8">
              <li>
                <Link
                  href="/"
                  className="flex items-center min-h-[44px] text-sm lg:text-base font-medium text-gray-900 transition-colors hover:text-black hover:underline whitespace-nowrap shrink-0"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="hidden lg:inline-block w-5 h-5 mr-1.5 shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                  </svg>
                  Home
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="flex items-center min-h-[44px] text-sm lg:text-base font-medium text-gray-900 transition-colors hover:text-black hover:underline whitespace-nowrap shrink-0"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="hidden lg:inline-block w-5 h-5 mr-1.5 shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/products"
                  className="flex items-center min-h-[44px] text-sm lg:text-base font-medium text-gray-900 transition-colors hover:text-black hover:underline whitespace-nowrap shrink-0"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="hidden lg:inline-block w-5 h-5 mr-1.5 shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                  </svg>
                  Categories
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="flex items-center min-h-[44px] text-sm lg:text-base font-medium text-gray-900 transition-colors hover:text-black hover:underline whitespace-nowrap shrink-0"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="hidden lg:inline-block w-5 h-5 mr-1.5 shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  Contact
                </Link>
              </li>
            </ul>
          </nav>

          <div className="flex items-center shrink-0">
            {/* User Account Icon/Menu */}
            <div className="relative user-menu-container">
              {isAuthenticated ? (
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="mr-0.5 sm:mr-1.5 md:mr-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full p-2 text-gray-900 transition-colors hover:bg-gray-100 relative cursor-pointer"
                  aria-label="User profile"
                >
                  {authUser?.picture ? (
                    <Image
                      src={authUser.picture}
                      alt={authUser?.name || 'Profile'}
                      width={32}
                      height={32}
                      referrerPolicy="no-referrer"
                      className="h-8 w-8 rounded-full object-cover shadow-xs border border-slate-200"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-semibold shadow-xs">
                      {authUser?.name?.charAt(0).toUpperCase() ||
                        authUser?.email?.charAt(0).toUpperCase() ||
                        'U'}
                    </div>
                  )}
                </button>
              ) : (
                <Link
                  href="/auth/login"
                  className="mr-0.5 sm:mr-1.5 md:mr-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full p-2 text-gray-900 transition-colors hover:bg-gray-100"
                  aria-label="Account sign in"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.75}
                    stroke="currentColor"
                    className="h-6 w-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                    />
                  </svg>
                </Link>
              )}
              
              {/* User dropdown menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-52 origin-top-right rounded-xl bg-white py-1 shadow-lg ring-1 ring-black/5 focus:outline-none z-20">
                  <div className="border-b border-gray-100 px-4 py-2.5">
                    <p className="text-sm font-bold text-gray-900">{authUser?.name || 'User'}</p>
                    <p className="truncate text-xs text-gray-500">{authUser?.email}</p>
                  </div>
                  <Link
                    href="/account"
                    className="flex items-center min-h-[44px] px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setShowUserMenu(false)}
                  >
                    Your Account
                  </Link>
                  <Link
                    href="/track-order"
                    className="flex items-center min-h-[44px] px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setShowUserMenu(false)}
                  >
                    Order Tracking
                  </Link>
                  <Link
                    href="/wishlist"
                    className="flex items-center min-h-[44px] px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setShowUserMenu(false)}
                  >
                    Wishlist
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full text-left min-h-[44px] px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>

            {/* Wishlist */}
            <Link
              href="/wishlist"
              className="relative mr-0.5 sm:mr-1.5 md:mr-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full p-2 text-gray-900 transition-colors hover:bg-gray-100"
              aria-label="Wishlist"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.75}
                stroke="currentColor"
                className="h-6 w-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                />
              </svg>
              {wishlistItemsCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs">
                  {wishlistItemsCount > 9 ? '9+' : wishlistItemsCount}
                </span>
              )}
            </Link>

            {/* Cart */}
            <Link
              href="/cart"
              className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full p-2 text-gray-900 transition-colors hover:bg-gray-100"
              aria-label="Cart"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.75}
                stroke="currentColor"
                className="h-6 w-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                />
              </svg>
              {cartItemsCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white shadow-xs">
                  {cartItemsCount > 9 ? '9+' : cartItemsCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="mobile-menu-container md:hidden bg-white fixed top-14 sm:top-16 left-0 w-full h-[calc(100dvh-3.5rem)] sm:h-[calc(100dvh-4rem)] z-50 overflow-y-auto pb-24">
          <div className="divide-y divide-gray-200">
            <div className="space-y-1 px-4 py-4">
              <Link
                href="/"
                className="min-h-[44px] rounded-xl px-3 py-2.5 text-base font-medium text-gray-900 hover:bg-gray-100 flex items-center"
                onClick={() => setIsMenuOpen(false)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
                Home
              </Link>
              <Link
                href="/about"
                className="min-h-[44px] rounded-xl px-3 py-2.5 text-base font-medium text-gray-900 hover:bg-gray-100 flex items-center"
                onClick={() => setIsMenuOpen(false)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                About
              </Link>
              <Link
                href="/products"
                className="min-h-[44px] rounded-xl px-3 py-2.5 text-base font-medium text-gray-900 hover:bg-gray-100 flex items-center"
                onClick={() => setIsMenuOpen(false)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                </svg>
                Categories
              </Link>
              <Link
                href="/contact"
                className="min-h-[44px] rounded-xl px-3 py-2.5 text-base font-medium text-gray-900 hover:bg-gray-100 flex items-center"
                onClick={() => setIsMenuOpen(false)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                Contact
              </Link>
            </div>
            
            {isAuthenticated ? (
              <div className="px-4 py-4">
                <div className="mb-3 flex items-center">
                  <div className="h-10 w-10 rounded-full bg-indigo-600 text-white flex items-center justify-center text-lg font-medium mr-3">
                    {authUser?.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{authUser?.name || 'User'}</p>
                    <p className="text-sm text-gray-500 truncate">{authUser?.email}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <Link
                    href="/account"
                    className="flex items-center min-h-[44px] rounded-xl px-3 py-2 text-base font-medium text-gray-900 hover:bg-gray-100"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Your Account
                  </Link>
                  <Link
                    href="/track-order"
                    className="flex items-center min-h-[44px] rounded-xl px-3 py-2 text-base font-medium text-gray-900 hover:bg-gray-100"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Order Tracking
                  </Link>
                  <Link
                    href="/wishlist"
                    className="flex items-center min-h-[44px] rounded-xl px-3 py-2 text-base font-medium text-gray-900 hover:bg-gray-100"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Wishlist
                    {wishlistItemsCount > 0 && (
                      <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                        {wishlistItemsCount}
                      </span>
                    )}
                  </Link>
                  <Link
                    href="/cart"
                    className="flex items-center min-h-[44px] rounded-xl px-3 py-2 text-base font-medium text-gray-900 hover:bg-gray-100"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Cart
                    {cartItemsCount > 0 && (
                      <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                        {cartItemsCount}
                      </span>
                    )}
                  </Link>
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left flex items-center min-h-[44px] rounded-xl px-3 py-2 text-base font-medium text-red-600 hover:bg-gray-100 cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-4 py-4 space-y-2.5">
                <Link
                  href="/auth/login"
                  className="flex items-center justify-center w-full min-h-[44px] rounded-xl bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-700"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="flex items-center justify-center w-full min-h-[44px] rounded-xl border border-gray-300 bg-white px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
} 
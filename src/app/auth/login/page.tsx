'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { notifyStorefrontChanged } from '@/lib/storefrontSync';

export default function LoginPage() {
  const router = useRouter();
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isValidIdentifier, setIsValidIdentifier] = useState(false);
  const [redirectPath, setRedirectPath] = useState<string>('/');

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('redirect');
    if (raw && raw.startsWith('/') && !raw.startsWith('//')) {
      setRedirectPath(raw);
    }
  }, []);

  // Validate email or phone number
  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[0-9]{10}$/;
    
    setIsValidIdentifier(emailRegex.test(identifier) || phoneRegex.test(identifier));
  }, [identifier]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendOtp = () => {
    if (!isValidIdentifier) {
      setError('Please enter a valid email or phone number');
      return;
    }

    setIsLoading(true);
    setError('');

    setTimeout(() => {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(code);
      setOtp('');
      setIsLoading(false);
      setOtpSent(true);
      setCountdown(30);
    }, 600);
  };

  const completeCustomerLogin = async (method: 'otp' | 'password') => {
    const cleanId = identifier.trim();
    const isPhone = /^[0-9]{10}$/.test(cleanId);

    try {
      const payload =
        method === 'password'
          ? {
              action: 'login',
              identifier: cleanId,
              password,
            }
          : {
              action: 'otp_login',
              identifier: cleanId,
              email: isPhone ? undefined : cleanId,
              phone: isPhone ? cleanId : undefined,
            };

      const res = await fetch('/api/auth/customer/sync', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data?.user) {
        setIsLoading(false);
        setError(data?.error || 'Sign in failed. Please check your credentials and try again.');
        return;
      }

      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('authUser', JSON.stringify(data.user));
      localStorage.removeItem('users');
      window.dispatchEvent(new Event('authUpdated'));
      notifyStorefrontChanged('customers');
      setIsLoading(false);
      router.push(redirectPath);
    } catch {
      setIsLoading(false);
      setError('Network error while signing in. Please try again.');
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }
    if (!generatedOtp || otp !== generatedOtp) {
      setError('Invalid verification code. Please check the code and try again.');
      return;
    }

    setIsLoading(true);
    setError('');
    await completeCustomerLogin('otp');
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidIdentifier) {
      setError('Please enter a valid email or phone number');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    setError('');
    await completeCustomerLogin('password');
  };

  return (
    <div className="min-h-[calc(100dvh-5rem)] flex flex-col items-center justify-center px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <Link href="/" className="inline-block">
            <Image
              src="/images/logo.svg"
              alt="StepStyle Logo"
              width={80}
              height={80}
              className="mx-auto"
            />
          </Link>
          <h1 className="mt-4 text-2xl sm:text-3xl font-bold text-gray-900">Welcome back</h1>
          <p className="mt-2 text-sm sm:text-base text-gray-600">Sign in to your StepStyle account</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-5 sm:p-6 mb-6">
          <GoogleSignInButton
            label="Continue with Google"
            disabled={isLoading}
            onSuccess={() => router.push(redirectPath)}
            onError={(msg) => setError(msg)}
          />

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-slate-400 font-medium">or sign in with</span>
            </div>
          </div>

          <div className="flex border-b border-gray-200 mb-6">
            <button
              type="button"
              className={`min-h-[44px] px-4 text-sm sm:text-base font-medium cursor-pointer ${
                loginMethod === 'password'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => {
                setLoginMethod('password');
                setOtpSent(false);
                setError('');
              }}
            >
              Password
            </button>
            <button
              type="button"
              className={`min-h-[44px] px-4 text-sm sm:text-base font-medium cursor-pointer ${
                loginMethod === 'otp'
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => {
                setLoginMethod('otp');
                setError('');
              }}
            >
              OTP
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs sm:text-sm rounded-md border border-red-200">
              {error}
            </div>
          )}

          {/* Password Login Form */}
          {loginMethod === 'password' && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 mb-1">
                  Email or Phone
                </label>
                <input
                  type="text"
                  id="identifier"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter your email or phone number"
                  disabled={isLoading}
                  required
                  inputMode="email"
                  autoComplete="email"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <Link href="/auth/forgot-password" className="text-xs text-indigo-600 hover:text-indigo-800 py-1">
                    Forgot password?
                  </Link>
                </div>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter your password"
                  disabled={isLoading}
                  required
                  autoComplete="current-password"
                />
              </div>
              <button
                type="submit"
                className={`w-full min-h-[48px] py-2.5 text-white text-sm font-semibold rounded-lg transition cursor-pointer ${
                  isLoading
                    ? 'bg-indigo-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
                    Signing in...
                  </span>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>
          )}

          {/* OTP Login Form */}
          {loginMethod === 'otp' && !otpSent && (
            <div className="space-y-4">
              <div>
                <label htmlFor="identifier-otp" className="block text-sm font-medium text-gray-700 mb-1">
                  Email or Phone
                </label>
              <input
                  type="text"
                  id="identifier-otp"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter your email or phone number"
                  disabled={isLoading}
                  required
                  inputMode="email"
                  autoComplete="email"
                />
              </div>
              <button
                type="button"
                onClick={handleSendOtp}
                className={`w-full min-h-[48px] py-2.5 text-white text-sm font-semibold rounded-lg transition cursor-pointer ${
                  isLoading || !isValidIdentifier
                    ? 'bg-indigo-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
                disabled={isLoading || !isValidIdentifier}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
                    Sending OTP...
                  </span>
                ) : (
                  'Send OTP'
                )}
              </button>
            </div>
          )}

          {/* OTP Verification Form */}
          {loginMethod === 'otp' && otpSent && (
            <div className="space-y-4">
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
                  Enter OTP
                </label>
                <div className="mb-2 space-y-1.5">
                  <p className="text-xs sm:text-sm text-gray-600 break-words">
                    We&apos;ve sent a 6-digit code to {identifier}
                  </p>
                  {generatedOtp && (
                    <p className="text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-md px-2.5 py-1.5">
                      Verification code: <span className="font-mono font-bold tracking-wider">{generatedOtp}</span>
                    </p>
                  )}
                </div>
                <input
                  type="text"
                  id="otp"
                  value={otp}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 6) {
                      setOtp(value);
                    }
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2 border border-gray-300 rounded-lg text-base sm:text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter 6-digit OTP"
                  maxLength={6}
                  disabled={isLoading}
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
                {countdown > 0 ? (
                  <p className="mt-2 text-xs text-gray-500 tabular-nums">
                    Resend OTP in {countdown}s
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="mt-1 min-h-[44px] inline-flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-800 focus:outline-none cursor-pointer"
                    disabled={isLoading}
                  >
                    Resend OTP
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={handleVerifyOtp}
                className={`w-full min-h-[48px] py-2.5 text-white text-sm font-semibold rounded-lg transition cursor-pointer ${
                  isLoading || otp.length !== 6
                    ? 'bg-indigo-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
                disabled={isLoading || otp.length !== 6}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
                    Verifying...
                  </span>
                ) : (
                  'Verify & Log in'
                )}
              </button>
            </div>
          )}
        </div>

        <div className="text-center">
          <p className="text-xs sm:text-sm text-gray-600">
            Don&apos;t have an account?{' '}
            <Link
              href={redirectPath !== '/' ? `/auth/signup?redirect=${encodeURIComponent(redirectPath)}` : '/auth/signup'}
              className="text-indigo-600 hover:text-indigo-800 font-medium py-1 inline-block"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
} 
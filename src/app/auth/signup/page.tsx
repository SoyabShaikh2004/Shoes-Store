'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { notifyStorefrontChanged } from '@/lib/storefrontSync';

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<'details' | 'verification'>('details');
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [identifierType, setIdentifierType] = useState<'email' | 'phone'>('email');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [countdown, setCountdown] = useState(0);
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
    
    if (emailRegex.test(identifier)) {
      setIdentifierType('email');
    } else if (phoneRegex.test(identifier)) {
      setIdentifierType('phone');
    }
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

  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (name.trim().length < 3) {
      setError('Name must be at least 3 characters');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[0-9]{10}$/;
    
    if (!emailRegex.test(identifier) && !phoneRegex.test(identifier)) {
      setError('Please enter a valid email or 10-digit phone number');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError('');

    setTimeout(() => {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(code);
      setOtp('');
      setIsLoading(false);
      setStep('verification');
      setCountdown(30);
    }, 600);
  };

  const handleResendOtp = () => {
    setIsLoading(true);
    setError('');

    setTimeout(() => {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(code);
      setIsLoading(false);
      setCountdown(30);
    }, 600);
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

    try {
      const cleanId = identifier.trim();
      const isPhone = /^[0-9]{10}$/.test(cleanId);
      const res = await fetch('/api/auth/customer/sync', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          action: 'signup',
          name: name.trim(),
          email: isPhone ? undefined : cleanId,
          phone: isPhone ? cleanId : undefined,
          identifier: cleanId,
          password,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !data?.user) {
        setIsLoading(false);
        setError(data?.error || 'Could not create your account. Please try again.');
        return;
      }

      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('authUser', JSON.stringify(data.user));
      localStorage.removeItem('users');
      window.dispatchEvent(new Event('authUpdated'));
      notifyStorefrontChanged('customers');
      router.push(redirectPath);
    } catch {
      setIsLoading(false);
      setError('Network error during signup. Please check your connection and try again.');
    }
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
          <h1 className="mt-4 text-2xl sm:text-3xl font-bold text-gray-900">
            {step === 'details' ? 'Create an account' : 'Verify your account'}
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-gray-600">
            {step === 'details' 
              ? 'Join StepStyle to start shopping' 
              : `We've sent a verification code to your ${identifierType}`}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-5 sm:p-6 mb-6">
          {step === 'details' && (
            <>
              <GoogleSignInButton
                label="Sign up with Google"
                disabled={isLoading}
                onSuccess={() => router.push(redirectPath)}
                onError={(msg) => setError(msg)}
              />

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-slate-400 font-medium">or sign up with email</span>
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs sm:text-sm rounded-md border border-red-200">
              {error}
            </div>
          )}

          {/* Signup Details Form */}
          {step === 'details' && (
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter your full name"
                  disabled={isLoading}
                  required
                  autoComplete="name"
                />
              </div>
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
                <p className="mt-1 text-xs text-gray-500">
                  We&apos;ll send a verification code to this {identifierType === 'email' ? 'email' : 'phone number'}
                </p>
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Create a password (minimum 6 characters)"
                  disabled={isLoading}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Confirm your password"
                  disabled={isLoading}
                  required
                  autoComplete="new-password"
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
                    Creating account...
                  </span>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>
          )}

          {/* OTP Verification Form */}
          {step === 'verification' && (
            <div className="space-y-4">
              <div>
                <div className="p-3 sm:p-4 bg-indigo-50 border border-indigo-100 rounded-md mb-4 space-y-1.5">
                  <p className="text-xs sm:text-sm text-indigo-800">
                    We&apos;ve sent a 6-digit verification code to your {identifierType}:
                    <span className="block mt-1 font-medium break-all">{
                      identifierType === 'email' 
                        ? identifier 
                        : `+91 ${identifier.slice(0, 5)}****${identifier.slice(-2)}`
                    }</span>
                  </p>
                  {generatedOtp && (
                    <p className="text-xs font-medium text-indigo-900">
                      Verification code: <span className="font-mono font-bold tracking-wider">{generatedOtp}</span>
                    </p>
                  )}
                </div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
                  Enter Verification Code
                </label>
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
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  disabled={isLoading}
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
                {countdown > 0 ? (
                  <p className="mt-2 text-xs text-gray-500 tabular-nums">
                    Resend code in {countdown}s
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="mt-1 min-h-[44px] inline-flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-800 focus:outline-none cursor-pointer"
                    disabled={isLoading}
                  >
                    Resend verification code
                  </button>
                )}
              </div>
              <div className="flex flex-col space-y-3">
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
                    'Verify & Create Account'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('details')}
                  className="w-full min-h-[44px] py-2 text-sm text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition cursor-pointer"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="text-center">
          <p className="text-xs sm:text-sm text-gray-600">
            Already have an account?{' '}
            <Link
              href={redirectPath !== '/' ? `/auth/login?redirect=${encodeURIComponent(redirectPath)}` : '/auth/login'}
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
} 
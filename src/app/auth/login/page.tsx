'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
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

    // Simulate API call to send OTP
    setTimeout(() => {
      // In a real app, call actual API to send OTP
      setIsLoading(false);
      setOtpSent(true);
      setCountdown(30); // 30 second countdown for resend
      // Generate a random 6-digit OTP for testing
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      // Remove console log for production
      // console.log('Generated OTP:', generatedOtp); // For testing
      setOtp(generatedOtp);
    }, 1500);
  };

  const handleVerifyOtp = () => {
    if (otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setIsLoading(true);
    setError('');

    // Simulate API call to verify OTP
    setTimeout(() => {
      // In a real app, call actual API to verify OTP
      setIsLoading(false);
      
      // Save user authentication status
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('authUser', JSON.stringify({
        email: identifier,
        loginMethod: 'otp',
        loginTime: new Date().toISOString()
      }));
      window.dispatchEvent(new Event('authUpdated'));
      
      // Navigate to requested redirect or home page after successful login
      router.push(redirectPath);
    }, 1500);
  };

  const handlePasswordLogin = (e: React.FormEvent) => {
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

    // Simulate API call for password login
    setTimeout(() => {
      // In a real app, call actual API for authentication
      setIsLoading(false);
      
      // Save user authentication status
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('authUser', JSON.stringify({
        email: identifier,
        loginMethod: 'password',
        loginTime: new Date().toISOString()
      }));
      window.dispatchEvent(new Event('authUpdated'));
      
      // Navigate to requested redirect or home page
      router.push(redirectPath);
    }, 1500);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
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

        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 mb-6">
          <div className="flex border-b border-gray-200 mb-6">
            <button
              className={`pb-3 px-3 sm:px-4 text-sm sm:text-base font-medium ${
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
              className={`pb-3 px-3 sm:px-4 text-sm sm:text-base font-medium ${
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter your email or phone number"
                  disabled={isLoading}
                  required
                  inputMode="email"
                  autoComplete="email"
                />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <Link href="/auth/forgot-password" className="text-xs text-indigo-600 hover:text-indigo-800">
                    Forgot password?
                  </Link>
                </div>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter your password"
                  disabled={isLoading}
                  required
                  autoComplete="current-password"
                />
              </div>
              <button
                type="submit"
                className={`w-full py-2.5 text-white font-medium rounded-md transition ${
                  isLoading
                    ? 'bg-indigo-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                className={`w-full py-2.5 text-white font-medium rounded-md transition ${
                  isLoading || !isValidIdentifier
                    ? 'bg-indigo-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
                disabled={isLoading || !isValidIdentifier}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
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
                <div className="mb-2">
                  <p className="text-xs sm:text-sm text-gray-600">
                    We've sent a 6-digit code to {identifier}
                  </p>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter 6-digit OTP"
                  maxLength={6}
                  disabled={isLoading}
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
                {countdown > 0 ? (
                  <p className="mt-2 text-xs text-gray-500">
                    Resend OTP in {countdown}s
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 focus:outline-none"
                    disabled={isLoading}
                  >
                    Resend OTP
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={handleVerifyOtp}
                className={`w-full py-2.5 text-white font-medium rounded-md transition ${
                  isLoading || otp.length !== 6
                    ? 'bg-indigo-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
                disabled={isLoading || otp.length !== 6}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
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
            Don't have an account?{' '}
            <Link
              href={redirectPath !== '/' ? `/auth/signup?redirect=${encodeURIComponent(redirectPath)}` : '/auth/signup'}
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Sign up
            </Link>
          </p>
        </div>

        {isLoading && (
          <div className="p-4 mt-6 text-sm rounded-md bg-red-50 text-red-800 border border-red-200">
            <p>
              Login failed. Please check your credentials and try again. If you don&apos;t have an account, please sign up.
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 
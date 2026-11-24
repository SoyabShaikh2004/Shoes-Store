'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<'request' | 'verification' | 'reset'>('request');
  const [identifier, setIdentifier] = useState('');
  const [identifierType, setIdentifierType] = useState<'email' | 'phone'>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
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

  const handleRequestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[0-9]{10}$/;
    
    if (!emailRegex.test(identifier) && !phoneRegex.test(identifier)) {
      setError('Please enter a valid email or 10-digit phone number');
      return;
    }

    setIsLoading(true);
    setError('');

    // Simulate API call to send OTP
    setTimeout(() => {
      // In a real app, call actual API to send OTP
      setIsLoading(false);
      setStep('verification');
      setCountdown(30); // 30 second countdown for resend
      // Generate a random 6-digit OTP
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    }, 1500);
  };

  const handleResendOtp = () => {
    setIsLoading(true);
    setError('');

    // Simulate API call to resend OTP
    setTimeout(() => {
      // In a real app, call actual API to send OTP
      setIsLoading(false);
      setCountdown(30); // Reset countdown
      // Generate a new random 6-digit OTP
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
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
      // Here, we're pretending any 6-digit OTP is valid for demo purposes
      setStep('reset');
    }, 1500);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError('');

    // Simulate API call to reset password
    setTimeout(() => {
      // In a real app, call actual API to reset password
      setIsLoading(false);
      // Redirect to login page
      router.push('/auth/login');
    }, 1500);
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
            {step === 'request' && 'Reset your password'}
            {step === 'verification' && 'Verify your identity'}
            {step === 'reset' && 'Create new password'}
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-gray-600">
            {step === 'request' && "Enter your email or phone number and we'll send you a code to reset your password"}
            {step === 'verification' && `We've sent a verification code to your ${identifierType}`}
            {step === 'reset' && "Choose a strong password that you haven't used before"}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-5 sm:p-6 mb-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs sm:text-sm rounded-md border border-red-200">
              {error}
            </div>
          )}

          {/* Request Reset Form */}
          {step === 'request' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
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
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending code...
                  </span>
                ) : (
                  'Send reset code'
                )}
              </button>
            </form>
          )}

          {/* OTP Verification Form */}
          {step === 'verification' && (
            <div className="space-y-4">
              <div>
                <div className="p-3 sm:p-4 bg-indigo-50 border border-indigo-100 rounded-md mb-4">
                  <p className="text-xs sm:text-sm text-indigo-800">
                    We&apos;ve sent a 6-digit verification code to your {identifierType}:
                    <span className="block mt-1 font-medium break-all">{
                      identifierType === 'email' 
                        ? identifier 
                        : `+91 ${identifier.slice(0, 5)}****${identifier.slice(-2)}`
                    }</span>
                  </p>
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
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Verifying...
                    </span>
                  ) : (
                    'Verify code'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('request')}
                  className="w-full min-h-[44px] py-2 text-sm text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition cursor-pointer"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Password Reset Form */}
          {step === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Create a new password (minimum 6 characters)"
                  disabled={isLoading}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Confirm your new password"
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
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Updating password...
                  </span>
                ) : (
                  'Reset password'
                )}
              </button>
            </form>
          )}
        </div>

        <div className="text-center">
          <p className="text-xs sm:text-sm text-gray-600">
            <Link href="/auth/login" className="text-indigo-600 hover:text-indigo-800 font-medium">
              Back to sign in
            </Link>
          </p>
        </div>

        <div className="p-4 mt-6 text-sm rounded-md bg-blue-50 text-blue-800 border border-blue-200">
          <p>
            Please check your email for a password reset link. If you don&apos;t receive it within a few minutes, check your spam folder.
          </p>
        </div>
      </div>
    </div>
  );
} 
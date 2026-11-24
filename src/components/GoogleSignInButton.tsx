'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

interface GoogleUserProfile {
  email: string;
  name: string;
  picture?: string;
  loginMethod: 'google';
  loginTime: string;
}

interface GoogleSignInButtonProps {
  label?: string;
  disabled?: boolean;
  onSuccess: (user: GoogleUserProfile) => void;
  onError: (message: string) => void;
}

export default function GoogleSignInButton({
  label = 'Continue with Google',
  disabled = false,
  onSuccess,
  onError,
}: GoogleSignInButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        stopPolling();
        setIsConnecting(false);
        onErrorRef.current(
          typeof event.data.error === 'string' && event.data.error
            ? event.data.error
            : 'Google sign-in could not be completed.'
        );
        return;
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.handoff) {
        stopPolling();
        try {
          const res = await fetch('/api/auth/google/session', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({ handoff: event.data.handoff }),
          });

          const data = await res.json();
          if (!res.ok || !data.success || !data.user) {
            throw new Error(data.error || 'Could not establish Google sign-in session.');
          }

          localStorage.setItem('isAuthenticated', 'true');
          localStorage.setItem('authUser', JSON.stringify(data.user));
          window.dispatchEvent(new Event('authUpdated'));

          setIsConnecting(false);
          onSuccessRef.current(data.user);
        } catch (err: unknown) {
          setIsConnecting(false);
          onErrorRef.current(
            err instanceof Error
              ? err.message
              : 'Failed to finalize Google sign-in.'
          );
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      stopPolling();
    };
  }, []);

  const handleGoogleLogin = async () => {
    if (isConnecting || disabled) return;
    onError('');
    setIsConnecting(true);

    try {
      const originParam = encodeURIComponent(window.location.origin);
      const res = await fetch(`/api/auth/google/url?origin=${originParam}`, {
        cache: 'no-store',
      });
      const data = await res.json();

      if (!res.ok || !data.configured || !data.url) {
        setIsConnecting(false);
        onError(
          data.error ||
            'Google Sign-In is not configured yet. Please use Email/OTP or configure Google OAuth credentials.'
        );
        return;
      }

      const authWindow = window.open(
        data.url,
        'stepstyle_google_oauth',
        'width=520,height=640,menubar=no,toolbar=no,status=no'
      );

      if (!authWindow) {
        setIsConnecting(false);
        onError('Popup was blocked by your browser. Please allow popups and try again.');
        return;
      }

      popupRef.current = authWindow;
      stopPolling();
      pollTimerRef.current = setInterval(() => {
        if (popupRef.current && popupRef.current.closed) {
          stopPolling();
          setIsConnecting(false);
        }
      }, 500);
    } catch {
      setIsConnecting(false);
      onError('Network error starting Google Sign-In. Please try again.');
    }
  };

  return (
    <button
      type="button"
      onClick={handleGoogleLogin}
      disabled={disabled || isConnecting}
      className="w-full min-h-[48px] px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 active:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed text-slate-800 text-sm font-semibold inline-flex items-center justify-center gap-3 transition-colors cursor-pointer shadow-xs"
    >
      {isConnecting ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
          <span>Connecting to Google...</span>
        </>
      ) : (
        <>
          <svg
            className="w-5 h-5 shrink-0"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
          </svg>
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

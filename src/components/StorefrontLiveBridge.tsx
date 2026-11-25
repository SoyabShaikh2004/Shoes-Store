'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { subscribeStorefrontChanges } from '@/lib/storefrontSync';

export default function StorefrontLiveBridge() {
  const router = useRouter();
  const lastRefreshRef = useRef<number>(0);

  useEffect(() => {
    const triggerRefresh = () => {
      const now = Date.now();
      if (now - lastRefreshRef.current < 1500) return;
      lastRefreshRef.current = now;
      router.refresh();
    };

    const unsubscribe = subscribeStorefrontChanges(() => {
      triggerRefresh();
    });

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        triggerRefresh();
      }
    };

    window.addEventListener('focus', triggerRefresh);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', triggerRefresh);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [router]);

  return null;
}

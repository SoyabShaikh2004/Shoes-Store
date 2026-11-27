'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { notifyStorefrontChanged, subscribeStorefrontChanges } from '@/lib/storefrontSync';

const SYNCED_ORDERS_SESSION_KEY = 'stepstyle_synced_orders_v1';

export default function StorefrontLiveBridge() {
  const router = useRouter();
  const lastRefreshRef = useRef<number>(0);
  const lastSignatureRef = useRef<string | null>(null);
  const isSyncingOrdersRef = useRef<boolean>(false);

  useEffect(() => {
    const syncLocalOrdersToServer = async () => {
      if (isSyncingOrdersRef.current) return;
      try {
        const rawOrders = localStorage.getItem('orders');
        if (!rawOrders) return;
        const parsed = JSON.parse(rawOrders);
        if (!Array.isArray(parsed) || parsed.length === 0) return;

        let syncedSet = new Set<string>();
        try {
          const seenRaw = sessionStorage.getItem(SYNCED_ORDERS_SESSION_KEY);
          if (seenRaw) {
            const seenArr = JSON.parse(seenRaw);
            if (Array.isArray(seenArr)) {
              syncedSet = new Set(seenArr.map((s) => String(s).toUpperCase()));
            }
          }
        } catch {
          // ignore sessionStorage errors
        }

        const unsynced = parsed.filter((o: { orderNumber?: string; orderId?: string }) => {
          const code = String(o?.orderNumber || o?.orderId || '').trim().toUpperCase();
          return /^STEP-[A-Z0-9-]{4,24}$/.test(code) && !syncedSet.has(code);
        });

        if (unsynced.length === 0) return;

        isSyncingOrdersRef.current = true;
        const res = await fetch('/api/orders/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ orders: unsynced.slice(0, 25) }),
        });

        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.success) {
            for (const o of unsynced.slice(0, 25)) {
              const code = String(o?.orderNumber || o?.orderId || '').trim().toUpperCase();
              if (code) syncedSet.add(code);
            }
            try {
              sessionStorage.setItem(
                SYNCED_ORDERS_SESSION_KEY,
                JSON.stringify(Array.from(syncedSet))
              );
            } catch {
              // ignore sessionStorage errors
            }
            if (Number(data.importedCount) > 0) {
              notifyStorefrontChanged('orders');
            }
          }
        }
      } catch {
        // ignore transient sync failure
      } finally {
        isSyncingOrdersRef.current = false;
      }
    };

    const triggerRefresh = () => {
      const now = Date.now();
      if (now - lastRefreshRef.current < 1500) return;
      lastRefreshRef.current = now;
      router.refresh();
    };

    const checkSignature = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch('/api/storefront?signature=1', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data?.success || typeof data.signature !== 'string') return;
        if (lastSignatureRef.current === null) {
          lastSignatureRef.current = data.signature;
          return;
        }
        if (data.signature !== lastSignatureRef.current) {
          lastSignatureRef.current = data.signature;
          triggerRefresh();
        }
      } catch {
        // ignore transient network errors
      }
    };

    void syncLocalOrdersToServer();
    void checkSignature();

    const unsubscribe = subscribeStorefrontChanges(() => {
      triggerRefresh();
    });

    const handleOrdersUpdated = () => {
      void syncLocalOrdersToServer();
    };

    const pollTimer = setInterval(() => {
      void checkSignature();
    }, 4500);

    const handleFocus = () => {
      triggerRefresh();
      void checkSignature();
      void syncLocalOrdersToServer();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        triggerRefresh();
        void checkSignature();
      }
    };

    window.addEventListener('ordersUpdated', handleOrdersUpdated);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(pollTimer);
      unsubscribe();
      window.removeEventListener('ordersUpdated', handleOrdersUpdated);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [router]);

  return null;
}

'use client';

export type StorefrontSyncReason = 'products' | 'banners' | 'orders' | 'all';

const CHANNEL_NAME = 'stepstyle_storefront_sync';
const STORAGE_KEY = 'stepstyle_storefront_version';
export const STOREFRONT_SYNC_EVENT = 'stepstyle:storefront-sync';
export const ADMIN_SESSION_EXPIRED_EVENT = 'stepstyle:admin-session-expired';

export function notifyStorefrontChanged(reason: StorefrontSyncReason = 'all'): void {
  if (typeof window === 'undefined') return;
  const payload = { reason, ts: Date.now() };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage quota / restricted iframe storage
  }

  try {
    if ('BroadcastChannel' in window) {
      const ch = new BroadcastChannel(CHANNEL_NAME);
      ch.postMessage(payload);
      ch.close();
    }
  } catch {
    // ignore BroadcastChannel failures
  }

  try {
    window.dispatchEvent(new CustomEvent(STOREFRONT_SYNC_EVENT, { detail: payload }));
  } catch {
    // ignore
  }
}

export function subscribeStorefrontChanges(
  onUpdate: (reason: StorefrontSyncReason) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleCustom = (e: Event) => {
    const custom = e as CustomEvent<{ reason?: StorefrontSyncReason }>;
    onUpdate(custom.detail?.reason || 'all');
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      const parsed = JSON.parse(e.newValue) as { reason?: StorefrontSyncReason };
      onUpdate(parsed.reason || 'all');
    } catch {
      onUpdate('all');
    }
  };

  let channel: BroadcastChannel | null = null;
  try {
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (ev: MessageEvent<{ reason?: StorefrontSyncReason }>) => {
        onUpdate(ev.data?.reason || 'all');
      };
    }
  } catch {
    channel = null;
  }

  window.addEventListener(STOREFRONT_SYNC_EVENT, handleCustom);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(STOREFRONT_SYNC_EVENT, handleCustom);
    window.removeEventListener('storage', handleStorage);
    if (channel) {
      try {
        channel.close();
      } catch {
        // ignore
      }
    }
  };
}

export function notifyAdminSessionExpired(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(ADMIN_SESSION_EXPIRED_EVENT));
}

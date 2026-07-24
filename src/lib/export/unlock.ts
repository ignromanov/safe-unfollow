/**
 * Pro Export unlock logic.
 *
 * Unlock state is a plain localStorage flag — intentionally spoofable.
 * We sell file convenience, not access to data that is already free to view
 * in the UI, so there is no server-side check.
 */

const UNLOCK_STORAGE_KEY = 'su-pro-export';
const UNLOCK_QUERY_PARAM = 'export';
const UNLOCK_QUERY_VALUE = 'unlocked';

const listeners = new Set<() => void>();
let unlockedCache: boolean | null = null;
let isStorageListenerAttached = false;

function notifyUnlockChanged(): void {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Drops the memoized flag so the next read hits localStorage again.
 * Called when another tab changes the flag, and by tests between cases.
 */
export function resetUnlockCache(): void {
  unlockedCache = null;
}

function handleStorageEvent(event: StorageEvent): void {
  // key === null means the whole storage was cleared
  if (event.key !== null && event.key !== UNLOCK_STORAGE_KEY) return;
  resetUnlockCache();
  notifyUnlockChanged();
}

/**
 * Subscribes to unlock-state changes, including purchases completed in another
 * tab. A single shared `storage` listener serves all subscribers.
 *
 * Returns an unsubscribe function.
 */
export function subscribeUnlock(listener: () => void): () => void {
  listeners.add(listener);

  if (!isStorageListenerAttached && typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageEvent);
    isStorageListenerAttached = true;
  }

  return () => {
    listeners.delete(listener);
  };
}

/**
 * Whether the Pro Export feature is enabled at all (checkout URL configured).
 * When false, no export UI should render.
 */
export function isExportFeatureEnabled(): boolean {
  return Boolean(import.meta.env.VITE_LEMONSQUEEZY_URL);
}

/**
 * The LemonSqueezy hosted checkout URL, or null if not configured.
 */
export function getCheckoutUrl(): string | null {
  const url = import.meta.env.VITE_LEMONSQUEEZY_URL;
  return url ? url : null;
}

/**
 * Whether the user has already unlocked Pro Export.
 *
 * Memoized: this is read on every render through useSyncExternalStore, and
 * localStorage access is synchronous.
 */
export function isExportUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  if (unlockedCache === null) {
    unlockedCache = localStorage.getItem(UNLOCK_STORAGE_KEY) === '1';
  }
  return unlockedCache;
}

/**
 * Marks Pro Export as unlocked in localStorage and notifies subscribers.
 */
export function setExportUnlocked(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(UNLOCK_STORAGE_KEY, '1');
  unlockedCache = true;
  notifyUnlockChanged();
}

/**
 * Checks the current URL for `?export=unlocked` (set by the LemonSqueezy
 * redirect-back). If present, persists the unlock flag and strips the param
 * from the URL via history.replaceState.
 *
 * Returns true if the param was found and consumed (i.e. a fresh purchase).
 */
export function consumeUnlockParam(): boolean {
  if (typeof window === 'undefined') return false;

  const url = new URL(window.location.href);
  if (url.searchParams.get(UNLOCK_QUERY_PARAM) !== UNLOCK_QUERY_VALUE) {
    return false;
  }

  setExportUnlocked();

  url.searchParams.delete(UNLOCK_QUERY_PARAM);
  window.history.replaceState({}, '', url.pathname + url.search + url.hash);

  return true;
}

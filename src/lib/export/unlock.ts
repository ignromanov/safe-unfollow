/**
 * Pro Export unlock state.
 *
 * The unlock is a LemonSqueezy license: the key plus the instance id returned
 * by activation. Both live in localStorage because there is no server to hold
 * them. A forged entry is still possible, but it can no longer be handed to
 * someone else as a URL, and a leaked key can be disabled in the dashboard —
 * which the per-session validate call then acts on.
 */

const UNLOCK_STORAGE_KEY = 'su-pro-export';
const LICENSE_QUERY_PARAM = 'license';

export interface StoredLicense {
  v: 1;
  key: string;
  instanceId: string;
}

const listeners = new Set<() => void>();
let licenseCache: StoredLicense | null | undefined;
let isStorageListenerAttached = false;
let hasValidatedThisSession = false;

function notifyUnlockChanged(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Drops the memoized license so the next read hits localStorage again. */
export function resetUnlockCache(): void {
  licenseCache = undefined;
}

/** Test seam: the per-session validation flag is module state by design. */
export function resetValidationFlag(): void {
  hasValidatedThisSession = false;
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

/** Whether Pro Export is configured at all. When false, no export UI renders. */
export function isExportFeatureEnabled(): boolean {
  return Boolean(import.meta.env.VITE_LEMONSQUEEZY_URL);
}

/** The LemonSqueezy hosted checkout URL, or null if not configured. */
export function getCheckoutUrl(): string | null {
  const url = import.meta.env.VITE_LEMONSQUEEZY_URL;
  return url ? url : null;
}

function readStoredLicense(): StoredLicense | null {
  if (typeof window === 'undefined') return null;

  const raw = localStorage.getItem(UNLOCK_STORAGE_KEY);
  if (raw === null) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    // The `object` check below is what actually rejects the pre-license '1'
    // flag (JSON.parse('1') succeeds and returns the number 1) — the flag
    // was never a valid license shape, so it falls through to null.
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'key' in parsed &&
      'instanceId' in parsed &&
      typeof (parsed as StoredLicense).key === 'string' &&
      typeof (parsed as StoredLicense).instanceId === 'string'
    ) {
      const { key, instanceId } = parsed as StoredLicense;
      return { v: 1, key, instanceId };
    }
  } catch {
    // Anything that isn't even valid JSON is not a license.
  }

  return null;
}

/** The stored license, memoized: this is read on every render via useSyncExternalStore. */
export function getStoredLicense(): StoredLicense | null {
  if (licenseCache === undefined) {
    licenseCache = readStoredLicense();
  }
  return licenseCache;
}

export function isExportUnlocked(): boolean {
  return getStoredLicense() !== null;
}

/** Persists an activated license and notifies subscribers. */
export function storeLicense(key: string, instanceId: string): void {
  if (typeof window === 'undefined') return;

  const license: StoredLicense = { v: 1, key, instanceId };
  localStorage.setItem(UNLOCK_STORAGE_KEY, JSON.stringify(license));
  licenseCache = license;
  notifyUnlockChanged();
}

/** Removes the license — used when validation returns an explicit negative. */
export function clearLicense(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(UNLOCK_STORAGE_KEY);
  licenseCache = null;
  notifyUnlockChanged();
}

/**
 * Reads `?license=` from the current URL and strips it, leaving other params
 * intact. Stripping immediately keeps the key out of history entries, the
 * referrer, and any analytics that read location.search.
 *
 * Returns the raw key; activation is the caller's job.
 */
export function consumeLicenseParam(): string | null {
  if (typeof window === 'undefined') return null;

  const url = new URL(window.location.href);
  const key = url.searchParams.get(LICENSE_QUERY_PARAM);
  if (key === null) return null;

  url.searchParams.delete(LICENSE_QUERY_PARAM);
  window.history.replaceState({}, '', url.pathname + url.search + url.hash);

  return key;
}

/** True until the first validation of this browser session. */
export function shouldValidateThisSession(): boolean {
  return !hasValidatedThisSession;
}

export function markValidatedThisSession(): void {
  hasValidatedThisSession = true;
}

/**
 * Pro Export unlock state.
 *
 * The unlock is a Dodo Payments license: the key plus the instance id returned
 * by activation. Both live in localStorage because there is no server to hold
 * them. A forged entry is still possible, but it can no longer be handed to
 * someone else as a URL, and a leaked key can be disabled in the dashboard —
 * which the per-session validate call then acts on.
 */

import { getApiBase } from './license';

const UNLOCK_STORAGE_KEY = 'su-pro-export';
const LICENSE_QUERY_PARAM = 'license_key';

/**
 * Everything else Dodo appends to the return URL. None of it is ours to keep:
 * `email` identifies the buyer, and `payment_id` links this browser to a
 * purchase record. Both are stripped in the same pass as the key so they never
 * reach history, the referrer, or the Umami pageview.
 */
const CHECKOUT_QUERY_PARAMS = ['payment_id', 'subscription_id', 'status', 'email'] as const;

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

/**
 * Whether Pro Export is configured *usably*. When false, no export UI renders.
 *
 * A checkout URL alone is not enough: the License API host is read off that
 * same URL, so a value we cannot map to a mode (a dodo.pe short link, a custom
 * domain) would let us take money and then reject the resulting key against the
 * wrong host. Not selling is the only safe answer to "which mode is this?".
 */
export function isExportFeatureEnabled(): boolean {
  return getApiBase() !== null;
}

/** The Dodo Payments hosted checkout URL, or null if not configured. */
export function getCheckoutUrl(): string | null {
  const url = import.meta.env.VITE_DODO_CHECKOUT_URL;
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
 * Reads `?license_key=` from the current URL and strips the whole checkout
 * return payload, leaving unrelated params (UTM tags and the like) intact.
 * Stripping immediately keeps both the key and the buyer's identity out of
 * history entries, the referrer, and any analytics that read location.search.
 *
 * Returns the raw key; activation is the caller's job.
 */
export function consumeLicenseParam(): string | null {
  if (typeof window === 'undefined') return null;

  const url = new URL(window.location.href);
  const rawKey = url.searchParams.get(LICENSE_QUERY_PARAM);

  const strippedAny = [LICENSE_QUERY_PARAM, ...CHECKOUT_QUERY_PARAMS].reduce((stripped, param) => {
    if (!url.searchParams.has(param)) return stripped;
    url.searchParams.delete(param);
    return true;
  }, false);

  // Rewriting an untouched URL would push a needless history entry on every
  // ordinary page load.
  if (strippedAny) {
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }

  if (rawKey === null) return null;

  // Dodo comma-joins keys when one purchase grants several. We grant one, so
  // anything past the first comma is a misconfiguration — better to activate
  // the first key than to send the whole string and get an unexplainable 404.
  return rawKey.split(',')[0] ?? rawKey;
}

/** True until the first validation of this browser session. */
export function shouldValidateThisSession(): boolean {
  return !hasValidatedThisSession;
}

export function markValidatedThisSession(): void {
  hasValidatedThisSession = true;
}

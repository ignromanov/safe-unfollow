/**
 * AdSense script loader.
 *
 * Injects the `adsbygoogle.js` script exactly once, lazily via
 * `requestIdleCallback` (falling back to `setTimeout`) so it never competes
 * with the initial render. The DOM is the single source of truth for
 * "already loaded", which keeps the behaviour idempotent and test-friendly.
 */

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

const SCRIPT_ID = 'adsbygoogle-js';
const IDLE_TIMEOUT_MS = 3000;
const FALLBACK_DELAY_MS = 1200;

/** True when the AdSense script tag is already present in the document. */
export function isAdsenseScriptLoaded(): boolean {
  if (typeof document === 'undefined') return false;
  return document.getElementById(SCRIPT_ID) !== null;
}

function injectScript(client: string): void {
  if (isAdsenseScriptLoaded()) return;

  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
    client
  )}`;
  document.head.appendChild(script);
}

/**
 * Load the AdSense script for the given client, once, during idle time.
 * No-op on the server or when the script is already present/scheduled.
 */
export function loadAdsenseScript(client: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (isAdsenseScriptLoaded()) return;

  const inject = (): void => injectScript(client);

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(inject, { timeout: IDLE_TIMEOUT_MS });
  } else {
    setTimeout(inject, FALLBACK_DELAY_MS);
  }
}

/**
 * Request AdSense to fill the most recently mounted `<ins>` slot.
 * Safe to call even before the script has finished loading.
 */
export function pushAdSlot(): void {
  if (typeof window === 'undefined') return;
  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch {
    // Swallow — ads must never break the app.
  }
}

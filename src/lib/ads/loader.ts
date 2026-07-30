/**
 * AdSense runtime helper.
 *
 * The `adsbygoogle.js` script is injected lazily — only when an eligible ad
 * slot approaches the viewport (see AdSlot). This keeps Google's ad script off
 * the page entirely for sample-route visitors. For EEA/UK/CH visitors the
 * script still loads, and Google's certified CMP gates ad serving on the
 * user's consent choice.
 * Ownership verification for Google's site review
 * uses the inert `<meta name="google-adsense-account">` tag in index.html,
 * which sets no cookies and makes no network calls.
 */

/** Id of the injected script tag; used to keep injection idempotent. */
const AD_SCRIPT_ID = 'adsbygoogle-js';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Inject `adsbygoogle.js` once. No-op if the tag is already present or when
 * running without a DOM.
 */
function ensureAdScript(client: string): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(AD_SCRIPT_ID)) return;

  const script = document.createElement('script');
  script.id = AD_SCRIPT_ID;
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
    client
  )}`;
  document.head.appendChild(script);
}

/**
 * Inject the AdSense script (once) and request a fill for the most recently
 * mounted `<ins>` slot. Only called for eligible slots, so the script never
 * loads for geo-blocked visitors.
 *
 * Safe to call before the script finishes loading — the push queue is drained
 * once adsbygoogle.js is ready.
 */
export function pushAdSlot(client: string): void {
  if (typeof window === 'undefined') return;
  try {
    ensureAdScript(client);
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch {
    // Swallow — ads must never break the app.
  }
}

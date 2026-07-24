/**
 * AdSense runtime helper.
 *
 * The `adsbygoogle.js` script is loaded unconditionally via a static tag in
 * `index.html` (present on every prerendered page for Google's site review),
 * so there is no runtime script injection here. AdSlot only needs to request
 * a fill for each mounted `<ins>` element.
 */

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Request AdSense to fill the most recently mounted `<ins>` slot.
 * Safe to call even before the script has finished loading (the push queue
 * is drained once adsbygoogle.js is ready).
 */
export function pushAdSlot(): void {
  if (typeof window === 'undefined') return;
  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch {
    // Swallow — ads must never break the app.
  }
}

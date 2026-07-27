/**
 * Ads eligibility (client side).
 *
 * Ads load for every visitor, everywhere. Consent for EEA/UK/CH users is
 * handled by Google's certified CMP (Privacy & messaging / Funding Choices),
 * served on top of `adsbygoogle.js` — so we no longer geo-gate at the edge.
 * The only client-side rule left is: never load ads on the `/sample` demo route.
 */

/** Matches `/sample` on any language-prefixed path (e.g. `/es/sample`). */
const SAMPLE_ROUTE_REGEX = /(?:^|\/)sample\/?$/;

/**
 * True when the current route is the `/sample` demo page (any language
 * prefix). Ads must never load on the sample route.
 */
export function isSampleRoute(): boolean {
  if (typeof window === 'undefined') return false;
  return SAMPLE_ROUTE_REGEX.test(window.location.pathname);
}

/**
 * Ads geo-gate (client side).
 *
 * The Vercel Edge Middleware sets a `su_ads` cookie based on the visitor's
 * country: `1` = ads allowed, `0` = ads blocked (EEA/UK/CH, where a
 * cookie-consent banner would otherwise be required).
 *
 * On non-Vercel environments (local dev, self-host) the cookie is absent.
 * We treat "absent" as blocked, EXCEPT in dev mode where a `VITE_ADSENSE_DEV`
 * override lets us render ads for testing.
 */

/** Cookie name set by the Edge Middleware. */
export const ADS_COOKIE_NAME = 'su_ads';

/**
 * Parse the raw `document.cookie` string and return true when ads are
 * explicitly allowed (`su_ads=1`).
 */
export function parseAdsCookie(cookieString: string): boolean {
  const entry = cookieString
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${ADS_COOKIE_NAME}=`));

  if (!entry) return false;
  return entry.slice(ADS_COOKIE_NAME.length + 1) === '1';
}

/**
 * Whether ads are allowed for the current visitor.
 * SSR-safe: returns false when `document` is unavailable.
 */
export function areAdsAllowed(): boolean {
  if (typeof document !== 'undefined' && parseAdsCookie(document.cookie)) {
    return true;
  }

  // Dev-only override so ads can be exercised locally without a geo cookie.
  if (import.meta.env.DEV && import.meta.env.VITE_ADSENSE_DEV === '1') {
    return true;
  }

  return false;
}

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

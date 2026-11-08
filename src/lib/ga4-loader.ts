/**
 * Google Analytics 4 (`gtag.js`) runtime helper & opt-out kill switch.
 *
 * Initial page-load bootstrap lives in `<head>` of `index.html` (and
 * `docs/_layouts/default.html`) so Google's tag scanner finds `G-JQFNBYQQXZ`
 * in static HTML and fast mobile visits fire before React hydration.
 *
 * Scope and privacy invariants:
 * 1. Runs ONLY on the production origin (`safeunfollow.app`), never on localhost or
 *    `*.workers.dev` preview deployments.
 * 2. Strips checkout return query parameters (`license_key`, buyer `email`,
 *    `payment_id`, `subscription_id`, `status` — GH#312) on a URL copy passed as
 *    `page_location` without mutating `window.location` before `stripCheckoutReturnParams()`.
 * 3. Honours the site-wide `"Don't Track Me"` opt-out (`umami-opt-out`), sets Google's
 *    official `window['ga-disable-<ID>'] = true` kill-switch, and expires `_ga` cookies
 *    on opt-out.
 * 4. Uses standard `window.dataLayer` so Google's certified Funding Choices CMP
 *    delivers Consent Mode v2 `analytics_storage` updates in EEA/UK/CH; standalone
 *    `gtag.js` (without GTM `gtm.js`) ignores plain `{ event }` objects pushed by Tally.
 * 5. Emits zero custom events: no export metadata, counts, or archive shapes are ever
 *    passed to Google Analytics.
 */

import { isTrackingOptedOut } from './stats/consent';

export const GA4_MEASUREMENT_ID = 'G-JQFNBYQQXZ';
export const GA4_SCRIPT_ID = 'ga4-gtag-js';
export const GA4_SCRIPT_SRC = `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`;
export const FUNDING_CHOICES_SCRIPT_ID = 'google-fc-cmp';
export const FUNDING_CHOICES_SCRIPT_SRC =
  'https://fundingchoicesmessages.google.com/i/pub-5976295812261948?ers=1';

const PRODUCTION_HOSTNAME = 'safeunfollow.app';
const CHECKOUT_RETURN_PARAMS = [
  'license_key',
  'payment_id',
  'subscription_id',
  'status',
  'email',
] as const;

/** EEA (27 EU + IS, LI, NO) + UK + CH — regions governed by ePrivacy / GDPR cookie consent. */
const EEA_UK_CH_REGIONS = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IS',
  'IE',
  'IT',
  'LV',
  'LI',
  'LT',
  'LU',
  'MT',
  'NL',
  'NO',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'GB',
  'CH',
] as const;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function isFramed(): boolean {
  return window.top !== window.self;
}

/**
 * Push a command onto `window.dataLayer` in the exact `Arguments` object shape `gtag.js`
 * requires (pushing a plain JS Array is silently ignored by `gtag.js`).
 */
function pushGtag(..._args: unknown[]): void {
  window.dataLayer = window.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}

/**
 * Return `href` with Dodo checkout return parameters removed so `page_location`
 * never leaks `license_key`, `payment_id`, or buyer `email` (GH#312).
 */
export function sanitizeGaPageLocation(href: string): string {
  try {
    const parsed = new URL(href);
    for (const key of CHECKOUT_RETURN_PARAMS) {
      parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return href;
  }
}

/**
 * Activate Google's `ga-disable-*` flag and expire `_ga` first-party cookies across both
 * the bare host and `.safeunfollow.app`.
 */
export function disableGa4(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  (window as unknown as Record<string, unknown>)[`ga-disable-${GA4_MEASUREMENT_ID}`] = true;

  const cookieSuffix = GA4_MEASUREMENT_ID.replace(/^G-/, '');
  const names = ['_ga', `_ga_${cookieSuffix}`];
  const domains = ['', `; domain=${PRODUCTION_HOSTNAME}`, `; domain=.${PRODUCTION_HOSTNAME}`];

  for (const name of names) {
    for (const domain of domains) {
      try {
        document.cookie = `${name}=; path=/; max-age=0${domain}; SameSite=Lax`;
      } catch {
        // Ignore cookie access errors in sandboxed/restricted contexts.
      }
    }
  }
}

/**
 * Programmatic fallback injector mirroring the `<head>` snippet in `index.html`.
 * Idempotent by `#ga4-gtag-js`.
 */
export function loadGa4(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.location.hostname !== PRODUCTION_HOSTNAME) return;
  if (isFramed()) return;

  if (isTrackingOptedOut()) {
    disableGa4();
    return;
  }

  if (document.getElementById(GA4_SCRIPT_ID)) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || pushGtag;

  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    region: [...EEA_UK_CH_REGIONS],
    wait_for_update: 500,
  });
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  window.gtag('set', 'ads_data_redaction', true);
  window.gtag('js', new Date());
  window.gtag('config', GA4_MEASUREMENT_ID, {
    page_location: sanitizeGaPageLocation(window.location.href),
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  const script = document.createElement('script');
  script.id = GA4_SCRIPT_ID;
  script.async = true;
  script.src = GA4_SCRIPT_SRC;
  document.head.appendChild(script);
}

/**
 * Google Analytics 4 (`gtag.js`) runtime loader.
 *
 * Added 2026-11-07 so third-party ad networks (Mediavine / Journey, Snigel, Setupad) can
 * verify 30-day session volume via read-only GA4 OAuth. Scope is deliberately minimal:
 *
 * 1. Runs ONLY on the production origin (`safeunfollow.app`), never on localhost or
 *    `*.workers.dev` preview deployments.
 * 2. Runs ONLY in `src/main.tsx` after `stripCheckoutReturnParams()`, so checkout return
 *    query parameters (`license_key`, buyer `email`, `payment_id` — GH#312) are removed
 *    from `window.location` before `gtag.js` reads the page URL.
 * 3. Honours the site-wide `"Don't Track Me"` opt-out (`umami-opt-out`), sets Google's
 *    official `window['ga-disable-<ID>'] = true` kill-switch, and expires `_ga` cookies
 *    on opt-out.
 * 4. Sets Google Consent Mode v2 defaults (`analytics_storage: 'denied'` in EEA/UK/CH
 *    until Google's Funding Choices CMP updates consent; `ad_storage`, `ad_user_data`,
 *    and `ad_personalization` denied globally for GA4) with Google Signals disabled.
 * 5. Emits zero custom events: no export metadata, counts, or archive shapes are ever
 *    passed to Google Analytics.
 * 6. Uses a dedicated command queue (`&l=suGaQueue` on `gtag/js` + `window.suGaQueue`)
 *    instead of Google's default global queue name so Tally's `embed.js` feedback popup
 *    bridge stays completely inert and never forwards form submissions into GA4
 *    (enforced by `src/__tests__/lib/feedback/tally-analytics-bridge.test.ts`).
 */

import { isTrackingOptedOut } from './stats/consent';

export const GA4_MEASUREMENT_ID = 'G-JQFNBYQQXZ';
export const GA4_QUEUE_NAME = 'suGaQueue';
export const GA4_SCRIPT_ID = 'ga4-gtag-js';
export const GA4_SCRIPT_SRC = `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}&l=${GA4_QUEUE_NAME}`;

const PRODUCTION_HOSTNAME = 'safeunfollow.app';

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
    suGaQueue?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function isFramed(): boolean {
  return window.top !== window.self;
}

/**
 * Push a command onto `window.suGaQueue` in the exact `Arguments` object shape `gtag.js`
 * requires (pushing a plain JS Array is silently ignored by `gtag.js`).
 */
function pushGtag(..._args: unknown[]): void {
  window.suGaQueue = window.suGaQueue || [];
  // eslint-disable-next-line prefer-rest-params
  window.suGaQueue.push(arguments);
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
 * Inject `gtag.js` once for eligible production visits.
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

  window.suGaQueue = window.suGaQueue || [];
  window.gtag = window.gtag || pushGtag;

  // Regional Consent Mode v2 default: EEA/UK/CH starts denied until Funding Choices CMP
  // updates consent; ad profiling signals stay denied globally on the GA4 stream.
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
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  const script = document.createElement('script');
  script.id = GA4_SCRIPT_ID;
  script.async = true;
  script.src = GA4_SCRIPT_SRC;
  document.head.appendChild(script);
}

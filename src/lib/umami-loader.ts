/**
 * Umami Analytics Loader
 *
 * Loads Umami analytics script dynamically with user opt-out support.
 * Respects user privacy preferences via localStorage.
 */

/**
 * Where the tracker is served from. Default is the same-origin proxy declared
 * in `vercel.json` (`/v/:match*` -> the analytics host), not a third-party
 * origin: the browser only ever sees `safeunfollow.app`, which is the only
 * form of ad-blocker avoidance that actually works — a bare subdomain still
 * ships a third-party origin and the widely-filtered `script.js` filename.
 *
 * A relative path also makes `connect-src`/`script-src 'self'` sufficient, so
 * no analytics host appears in the CSP at all.
 *
 * Overridable per GH#63 so the instance can move without editing this file.
 * Note the proxy's *destination* still lives in `vercel.json`, because Vercel
 * does not interpolate env vars into rewrites — so a host move is a one-line
 * config change there rather than a code change here.
 */
const UMAMI_SRC = import.meta.env.VITE_UMAMI_SRC || '/v/script.js';

/** Website record the events are attributed to. Changed once already, at the
 *  Neon -> Supabase migration, which is why it is configurable. */
const UMAMI_WEBSITE_ID =
  import.meta.env.VITE_UMAMI_WEBSITE_ID || 'f204b58f-a5bb-4231-b02b-4cc05f472d02';

export function loadUmami(): void {
  // Respect user opt-out
  if (typeof localStorage !== 'undefined' && localStorage.getItem('umami-opt-out') === 'true') {
    return;
  }

  // Only load in browser
  if (typeof document === 'undefined') return;

  const script = document.createElement('script');
  script.defer = true;
  script.src = UMAMI_SRC;
  script.dataset.websiteId = UMAMI_WEBSITE_ID;
  document.head.appendChild(script);
}

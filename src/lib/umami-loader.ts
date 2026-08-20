/**
 * Umami Analytics Loader
 *
 * Loads Umami analytics script dynamically with user opt-out support.
 * Respects user privacy preferences via localStorage.
 */
import { SUPPORTED_LANGUAGES } from '@/config/languages';

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

/**
 * The single definition of the analytics opt-out gate. Both the tracker and the
 * heatmap recorder read it, so a visitor who opted out cannot be picked up by
 * whichever of the two was added later.
 */
function isOptedOut(): boolean {
  return typeof localStorage !== 'undefined' && localStorage.getItem('umami-opt-out') === 'true';
}

export function loadUmami(): void {
  if (isOptedOut()) return;

  // Only load in browser
  if (typeof document === 'undefined') return;

  const script = document.createElement('script');
  script.defer = true;
  script.src = UMAMI_SRC;
  script.dataset.websiteId = UMAMI_WEBSITE_ID;
  document.head.appendChild(script);
}

/**
 * Where the heatmap recorder is served from — the same same-origin proxy as the
 * tracker, so `script-src 'self'` already covers it and no CSP entry is needed.
 */
const UMAMI_RECORDER_SRC = import.meta.env.VITE_UMAMI_RECORDER_SRC || '/v/recorder.js';

/**
 * Base the recorder resolves `/api/record` and its config endpoint against.
 * Passed explicitly instead of leaving the recorder to derive it from its own
 * `currentScript.src`, so a change in how the script is served cannot silently
 * retarget collection at another origin.
 */
const UMAMI_HOST_URL = import.meta.env.VITE_UMAMI_HOST_URL || '/v';

/** Locales that carry a URL prefix. English is served at `/`, so `/en` is a 404. */
const PREFIXED_LANGUAGES: readonly string[] = SUPPORTED_LANGUAGES.filter(lang => lang !== 'en');

/** Events that count as the first interaction. Passive: none of them is cancelled. */
const FIRST_INTERACTION_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;

/** Shape of `GET /api/websites/:id/recorder`. Every field is optional on purpose:
 *  the endpoint answers `{ enabled: false }` alone when the recorder is off. */
interface RecorderConfig {
  enabled?: boolean;
  replayEnabled?: boolean;
  heatmapEnabled?: boolean;
}

/**
 * The landing page and nothing below it: `/` or `/<lang>` for the nine prefixed
 * locales, with or without a trailing slash.
 */
export function isLandingPath(pathname: string): boolean {
  const [locale, ...rest] = pathname.split('/').filter(Boolean);

  if (locale === undefined) return true;
  if (rest.length > 0) return false;

  return PREFIXED_LANGUAGES.includes(locale);
}

async function injectRecorder(): Promise<void> {
  // The first interaction may itself have been the click that left the landing
  // page. The recorder hooks pushState/replaceState and exposes no teardown for
  // heatmap capture, so once it starts it follows every later SPA route in the
  // same document — re-check the path at the moment of injection, not only when
  // the listeners were attached.
  if (!isLandingPath(window.location.pathname)) return;

  let config: RecorderConfig;

  try {
    const response = await fetch(`${UMAMI_HOST_URL}/api/websites/${UMAMI_WEBSITE_ID}/recorder`, {
      credentials: 'omit',
    });

    if (!response.ok) return;

    config = (await response.json()) as RecorderConfig;
  } catch {
    return;
  }

  // `recorderEnabled` and `replayConfig` are database columns the Umami dashboard
  // writes, so session replay can be switched on with no commit, review or deploy.
  // Re-apply the same decision here and fail closed: a dashboard toggle may turn
  // our collection off, never escalate it to rrweb DOM capture. Absent or
  // unexpected fields are treated as "do not load".
  if (config.enabled !== true) return;
  if (config.heatmapEnabled !== true) return;
  if (config.replayEnabled !== false) return;

  const script = document.createElement('script');
  script.src = UMAMI_RECORDER_SRC;
  script.dataset.websiteId = UMAMI_WEBSITE_ID;
  script.dataset.hostUrl = UMAMI_HOST_URL;
  document.head.appendChild(script);
}

/**
 * Load the Umami heatmap recorder on the landing page only, lazily, after the
 * visitor's first interaction.
 *
 * Three gates, cheapest first: the shared analytics opt-out, the landing-page
 * path, and the recorder config's own `replayEnabled` flag. The script is 58.7 KB
 * gzipped against the tracker's 2.3 KB, which is why it waits for an interaction
 * rather than loading with the page — by then LCP has already been decided.
 *
 * Scope note: this gates where the recorder is *entered*, not where it collects.
 * A visitor who lands on `/` and navigates deeper keeps it, because the recorder
 * has no stop API. Its heatmap payload is coordinates and scroll percentages —
 * no DOM, text or attributes — so what follows them carries nothing personal.
 * A direct arrival at `/results` never loads it at all. See GH#95.
 */
export function loadHeatmapRecorder(): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (isOptedOut()) return;
  if (!isLandingPath(window.location.pathname)) return;

  const controller = new AbortController();

  const onFirstInteraction = (): void => {
    controller.abort();
    void injectRecorder();
  };

  for (const type of FIRST_INTERACTION_EVENTS) {
    window.addEventListener(type, onFirstInteraction, {
      once: true,
      passive: true,
      signal: controller.signal,
    });
  }
}

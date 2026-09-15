/**
 * Umami Analytics Loader
 *
 * Loads Umami analytics script dynamically with user opt-out support.
 * Respects user privacy preferences via localStorage.
 */
import { SUPPORTED_LANGUAGES } from '@/config/languages';

/**
 * Where the tracker is served from: the analytics instance directly.
 *
 * This was the same-origin proxy `/v/script.js` until 2026-09-14. The proxy was a
 * `vercel.json` rewrite, and Vercel bills each hop through an external rewrite as a
 * separate Edge Request — measured as three hops (`x-vercel-id: gru1:gru1:gru1::iad1::`)
 * against one for a direct call, on an account already 79% over the Hobby limit.
 *
 * ⛔ It cost something real to remove. A bare subdomain ships a third-party origin and
 * the widely-filtered `script.js` filename, so ad-blocker exposure rises. The mitigation
 * is `TRACKER_SCRIPT_NAME` and `COLLECT_API_ENDPOINT` on the analytics instance, which
 * are owner actions in the Vercel dashboard, paired with the three `VITE_UMAMI_*`
 * overrides below. Until both halves are set, expect a step down in measured volume that
 * is not a traffic result — see `analytics/measurement-boundaries.md`.
 *
 * The CSP now names this origin in `script-src` and `connect-src`; it previously needed
 * no analytics host at all. `src/__tests__/vercel-csp.test.ts` holds both facts together.
 *
 * Overridable per GH#63 so the instance can move without editing this file.
 */
const UMAMI_SRC = import.meta.env.VITE_UMAMI_SRC || 'https://m.safeunfollow.app/script.js';

/**
 * Website record the events are attributed to. Changed once already, at the
 * Neon -> Supabase migration, which is why it is configurable.
 *
 * No default: an unset value means "do not collect". The production id used to
 * stand here as a fallback, which made the variable impossible to switch off —
 * scoping it to Production on Vercel left preview builds falling through the
 * `||` to that same id, so every preview session wrote into the dataset the
 * live numbers are read from. Absence must be the safe state, not the old one.
 */
const UMAMI_WEBSITE_ID = import.meta.env.VITE_UMAMI_WEBSITE_ID;

/**
 * The single definition of the analytics opt-out gate. Both the tracker and the
 * heatmap recorder read it, so a visitor who opted out cannot be picked up by
 * whichever of the two was added later.
 */
function isOptedOut(): boolean {
  return typeof localStorage !== 'undefined' && localStorage.getItem('umami-opt-out') === 'true';
}

/**
 * True when this document is not the top-level one.
 *
 * Umami's heatmap report draws its background by framing the live production
 * page, and neither this loader nor Umami's own tracker carries a top-window
 * check. Without one, opening the heatmap files a pageview against the very
 * page being measured — and the recorder is landing-only, so the frame lands
 * on exactly the route whose numbers are being read. Comparing the two window
 * references is safe cross-origin; only reading *through* `window.top` is not.
 */
function isFramed(): boolean {
  return window.top !== window.self;
}

/**
 * Base both the tracker and the recorder resolve their collect endpoints against —
 * `/api/send` for the tracker, `/api/record` and the config endpoint for the recorder.
 *
 * Passed explicitly on both rather than left to be derived from `currentScript.src`, so
 * a change in how the script is served cannot silently retarget collection at another
 * origin. The recorder already worked this way; the tracker was relying on the
 * derivation until 2026-09-14, which is why moving the script moved the endpoint with it.
 */
const UMAMI_HOST_URL = import.meta.env.VITE_UMAMI_HOST_URL || 'https://m.safeunfollow.app';

export function loadUmami(): void {
  if (!UMAMI_WEBSITE_ID) return;
  if (isOptedOut()) return;

  // Only load in browser
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (isFramed()) return;

  const script = document.createElement('script');
  script.defer = true;
  script.src = UMAMI_SRC;
  script.dataset.websiteId = UMAMI_WEBSITE_ID;
  script.dataset.hostUrl = UMAMI_HOST_URL;
  document.head.appendChild(script);
}

/**
 * Where the heatmap recorder is served from — the same instance as the tracker, so the
 * `script-src` entry added for `UMAMI_SRC` covers it too. Was `/v/recorder.js`.
 */
const UMAMI_RECORDER_SRC =
  import.meta.env.VITE_UMAMI_RECORDER_SRC || 'https://m.safeunfollow.app/recorder.js';

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
  if (!UMAMI_WEBSITE_ID) return;
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (isOptedOut()) return;
  if (isFramed()) return;
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

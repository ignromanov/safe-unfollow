/**
 * Hero CTA clicks that happen before React exists.
 *
 * Every prerendered page ships an inert `<a href>` so the browser can navigate during the
 * hydration window (see `PrefixedLink`). React's `onClick` does not exist in that window, so
 * a CTA click there used to be lost twice over: the event never fired, and — because
 * `setEntryCTA` is first-wins — the session's `entry_cta` was left free for whatever the
 * reader clicked next. Missing would have been survivable; wrong was not.
 *
 * The recorder is therefore a capture-phase listener in `index.html`, which runs at parse
 * time rather than at hydration. It hands the click to `window.__ctaSink` when the app is
 * up, and otherwise parks it in `sessionStorage` — the click is a full document navigation
 * at that point, so an in-memory queue would die with the page that recorded it.
 *
 * There is exactly one recorder either way. Wiring `onClick` as well would double-count
 * every hydrated click.
 *
 * `recordCTA` is also the whole slug→event mapping (GH#99): every hero CTA, hydrated or
 * not, is batched through it rather than through four separate wrapper functions. Batched
 * because a hydrated click is a PrefixedLink, i.e. react-router Link — preventDefault +
 * pushState, so the document never unloads. The route change that follows drains the queue
 * on the next tick, so the event leaves as promptly as it did on the immediate path; it just
 * shares a request with the rest of the landing page's set.
 */

import { AnalyticsEvents } from './constants';
import { enqueueEvent, type EventData } from './queue';
import { setEntryCTA } from './utm';

declare global {
  interface Window {
    /** Installed by `installCTACapture`; read by the inline listener in index.html. */
    __ctaSink?: (cta: string) => void;
  }
}

/** Where the inline listener parks a click it could not hand to the app. */
export const PENDING_CTA_KEY = 'analytics_pending_cta';

/**
 * `data-cta` value → the event it records. The same key is the `entry_cta` slug, which is
 * why the four values match the strings `setEntryCTA` has always been given.
 */
const HERO_CTAS = {
  guide: AnalyticsEvents.HERO_CTA_GUIDE,
  sample: AnalyticsEvents.HERO_CTA_SAMPLE,
  upload_direct: AnalyticsEvents.HERO_CTA_UPLOAD_DIRECT,
  continue: AnalyticsEvents.HERO_CTA_CONTINUE,
} as const;

export type HeroCta = keyof typeof HERO_CTAS;

function isHeroCta(value: string): value is HeroCta {
  return Object.prototype.hasOwnProperty.call(HERO_CTAS, value);
}

function record(cta: HeroCta, data?: EventData): void {
  setEntryCTA(cta);
  enqueueEvent(HERO_CTAS[cta], data);
}

/** Record a CTA click that reached the app directly. */
export function recordCTA(cta: HeroCta): void {
  record(cta);
}

/**
 * Replay a click parked before hydration, at most once.
 *
 * The replay runs on the page the click navigated *to*, so `enqueueEvent` stamps it with
 * the destination URL. `from_path` carries where it actually happened and `deferred` marks
 * the row, which is also the only measurement of how wide the hydration window is in the
 * field — nothing else distinguishes these clicks from any other.
 */
export function drainPendingCTA(): void {
  if (typeof window === 'undefined') return;

  let raw: string | null;
  try {
    raw = sessionStorage.getItem(PENDING_CTA_KEY);
    if (raw !== null) sessionStorage.removeItem(PENDING_CTA_KEY);
  } catch {
    return;
  }
  if (raw === null) return;

  let parsed: { c?: unknown; p?: unknown };
  try {
    parsed = JSON.parse(raw) as { c?: unknown; p?: unknown };
  } catch {
    return;
  }

  // sessionStorage is writable by anything on the origin and outlives a rename, so an
  // unrecognised slug is discarded rather than passed on to become an unlisted event name.
  const { c, p } = parsed;
  if (typeof c !== 'string' || !isHeroCta(c)) return;

  record(c, { deferred: true, ...(typeof p === 'string' && p ? { from_path: p } : {}) });
}

/**
 * Drain what the previous page parked, then take over from the inline listener.
 *
 * Drain first: installing the sink first would let a click landing in between be recorded
 * by both paths.
 */
export function installCTACapture(): void {
  if (typeof window === 'undefined') return;
  drainPendingCTA();
  window.__ctaSink = (cta: string) => {
    if (isHeroCta(cta)) recordCTA(cta);
  };
}

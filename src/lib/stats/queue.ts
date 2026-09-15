import { isTrackingOptedOut } from './consent';
import { resolveUmamiTarget } from './endpoint';

import type { AnalyticsEventName } from './constants';

export type EventData = Record<string, string | number | boolean>;

interface QueuedEvent {
  kind: 'event';
  name: AnalyticsEventName;
  data?: EventData;
  /** Captured at enqueue: a flush routinely happens after the route changed. */
  url: string;
}

/**
 * The five Web Vitals Umami stores as columns on `website_event`.
 *
 * Every field is optional because the report tolerates it: the Performance
 * query filters on `event_type = 5` and nothing else, and each percentile is
 * computed over its own column, so a row carrying only `lcp` contributes to LCP
 * and to nothing else. Absent means absent — never send a `0` for a metric that
 * did not fire, which would be indistinguishable from a real zero.
 */
export interface PerformanceMetrics {
  lcp?: number;
  inp?: number;
  cls?: number;
  fcp?: number;
  ttfb?: number;
}

/**
 * Upper bound the collector itself enforces on each metric, restated here only
 * because the alternative is worse.
 *
 * Decided by the `type: 'performance'` branch of the collector's request schema
 * (`src/app/api/send/route.ts` in the umami fork): `lcp`/`inp`/`fcp`/`ttfb` are
 * `nonnegative().max(60000)`, `cls` is `nonnegative().max(100)`. Validation runs
 * over the WHOLE envelope, so one number past its ceiling rejects the other four
 * with it, and `/api/batch` answers with a per-index error that `deliver` counts
 * into `eventsRejected` and no one reads. Dropping the offending metric keeps the
 * row and loses one number instead of five.
 *
 * ⚠️ Dropping biases that metric's percentiles DOWNWARD, because only the slowest
 * observations can exceed a ceiling. It cannot move p75 unless more than a
 * quarter of loads are past it, which for a 60-second TTFB would be a different
 * emergency.
 */
const METRIC_CEILING: Record<keyof PerformanceMetrics, number> = {
  lcp: 60000,
  inp: 60000,
  fcp: 60000,
  ttfb: 60000,
  cls: 100,
};

interface QueuedPerformance {
  kind: 'performance';
  metrics: PerformanceMetrics;
  /** Captured at enqueue, for the same reason as an event's. */
  url: string;
}

type QueuedItem = QueuedEvent | QueuedPerformance;

/**
 * Flush once the queue reaches this many events.
 *
 * A safety margin rather than a byte limit — promo impressions arrive a handful
 * per page, so the cap exists to bound memory on a pathological session, not to
 * stay under sendBeacon's 64 KiB.
 */
export const MAX_BATCH_SIZE = 20;

let queue: QueuedItem[] = [];

/**
 * Whether anything at all may be queued right now.
 *
 * One definition for every kind of row, because the third condition is consent:
 * a gate written twice is a gate that will be extended once. Checked on every
 * enqueue and never at flush time — a visitor who declines mid-session must not
 * have their earlier impressions delivered by a later route change.
 */
function canCollect(): boolean {
  if (import.meta.env.DEV) return false;
  if (typeof window === 'undefined') return false;
  if (isTrackingOptedOut()) return false;
  // No analytics tag means analytics never loaded — nothing to deliver to.
  return resolveUmamiTarget() !== null;
}

/** Queue one event for delivery. */
export function enqueueEvent(name: AnalyticsEventName, data?: EventData): void {
  if (!canCollect()) return;

  queue.push({ kind: 'event', name, data, url: window.location.pathname });

  if (queue.length >= MAX_BATCH_SIZE) {
    flushEvents();
  }
}

/**
 * Queue one page load's Web Vitals for delivery.
 *
 * Umami's own collector posts this shape directly, one unbatched `fetch` per
 * *pageview* — every SPA route change flushes another. Ours is emitted once per
 * *hard page load*, which is 3.9x rarer, and it is enqueued rather than posted so
 * it can share a request when one is already pending. ⚠️ Usually it cannot:
 * `useEventQueueFlush` drains the queue on every route change, so by the time a
 * page hides there is typically nothing left to ride with. Budget it as its own
 * keepalive POST per hard page load — ~31 000/month against the collector's
 * ~123 000, which is the reason this exists and not `data-performance="true"`.
 *
 * `url` is passed in rather than read here, unlike `enqueueEvent`'s: an event
 * happens now, while these metrics describe a document that loaded some routes
 * ago, and `window.location` no longer names it. Measured at 3.91 pageviews per
 * page load, the average row would otherwise carry its fourth route.
 *
 * Same `canCollect` gate as `enqueueEvent`, plus one of its own: a row on which
 * no metric survived is dropped. It cannot
 * move a percentile — each is computed over its own column and skips nulls — but
 * it would still cost a request, a stored row, a step in the journey report
 * (which does not filter `event_type`) and one unit of the sample count the
 * Performance tab prints beside its numbers.
 */
export function enqueuePerformance(metrics: PerformanceMetrics, url: string): void {
  if (!canCollect()) return;

  const deliverable: PerformanceMetrics = {};
  for (const [key, value] of Object.entries(metrics) as [keyof PerformanceMetrics, number][]) {
    if (Number.isFinite(value) && value >= 0 && value <= METRIC_CEILING[key]) {
      deliverable[key] = value;
    }
  }

  if (Object.keys(deliverable).length === 0) return;

  queue.push({ kind: 'performance', metrics: deliverable, url });

  if (queue.length >= MAX_BATCH_SIZE) {
    flushEvents();
  }
}

/** Discard everything pending. Used when consent is withdrawn. */
export function clearEventQueue(): void {
  queue = [];
}

/** Pending event count. Diagnostics and tests only. */
export function getQueuedCount(): number {
  return queue.length;
}

/**
 * Initial attempt plus one retry.
 *
 * Bounded deliberately: a queue that keeps re-sending grows without limit, and
 * `keepalive` requests share a ~64 KiB in-flight budget per page that a retry
 * loop would exhaust.
 */
const MAX_DELIVERY_ATTEMPTS = 2;

export interface DeliveryStats {
  /** Requests the server accepted, whether or not every event inside landed. */
  batchesSent: number;
  /** Requests abandoned after the retry, or refused outright. */
  batchesFailed: number;
  /** Events the server reported it did not store, inside an accepted request. */
  eventsRejected: number;
}

let stats: DeliveryStats = { batchesSent: 0, batchesFailed: 0, eventsRejected: 0 };

/**
 * Delivery counters since load.
 *
 * The only way to tell "this event is rare" from "the pipe leaked": before
 * this existed, a batch that never arrived was indistinguishable from one that
 * was never sent, which is how ~25 000 events were lost unnoticed in August
 * 2026 without anything recording that anything was wrong.
 */
export function getDeliveryStats(): DeliveryStats {
  return { ...stats };
}

/** Diagnostics and tests only. */
export function resetDeliveryStats(): void {
  stats = { batchesSent: 0, batchesFailed: 0, eventsRejected: 0 };
}

/**
 * Send one batch, retrying only where a retry cannot duplicate anything.
 *
 * `/api/batch` processes the array element by element and reports per-index
 * failures rather than aborting, so the batch is NOT idempotent. That governs
 * every branch below:
 *
 * - network failure and 5xx: nothing is known to have landed, so a retry is
 *   safe and is taken once;
 * - 4xx: the server is stating the payload is wrong, and the retry would send
 *   the identical payload;
 * - 2xx carrying `errors > 0`: part of the batch DID land, and re-sending it
 *   would store those events twice. Counted, never retried.
 *
 * A retry only ever runs while the page is alive. `flushEvents` also fires from
 * `pagehide` and unmount, where `keepalive` still delivers the request but no
 * continuation survives to read the response — there, this degrades to exactly
 * the fire-and-forget it replaces.
 */
async function deliver(endpoint: string, body: string, attempt = 1): Promise<void> {
  let response: Response;

  try {
    // sendBeacon is not used here: the Beacon spec forces credentials mode
    // 'include' with no way to opt out, and the Umami endpoint answers
    // cross-origin requests with `Access-Control-Allow-Origin: *` — invalid for
    // a credentialed request, so the browser silently drops the delivery while
    // sendBeacon still reports success.
    //
    // `credentials: 'omit'` is stated rather than left to fetch's 'same-origin'
    // default, which only behaves as omitted while the instance stays on another
    // origin (GH#63 tracks making that host configurable). `keepalive` keeps the
    // request alive across unload. This is what Umami's own tracker sends.
    response = await fetch(endpoint, {
      method: 'POST',
      body,
      keepalive: true,
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    if (attempt < MAX_DELIVERY_ATTEMPTS) {
      return deliver(endpoint, body, attempt + 1);
    }
    stats.batchesFailed += 1;
    return;
  }

  if (response.status >= 500) {
    if (attempt < MAX_DELIVERY_ATTEMPTS) {
      return deliver(endpoint, body, attempt + 1);
    }
    stats.batchesFailed += 1;
    return;
  }

  if (!response.ok) {
    stats.batchesFailed += 1;
    return;
  }

  stats.batchesSent += 1;

  // The request was accepted either way; an unreadable body costs us the
  // per-event report, not the delivery.
  try {
    const report = (await response.json()) as { errors?: number } | null;
    const rejected = report?.errors;

    if (typeof rejected === 'number' && rejected > 0) {
      stats.eventsRejected += rejected;
    }
  } catch {
    // Body absent or not JSON.
  }
}

/**
 * Deliver everything pending as one request.
 *
 * Umami's `POST /api/batch` takes an array of the same envelopes `/api/send`
 * takes, so N events collapse into one serverless invocation.
 */
export function flushEvents(): void {
  if (queue.length === 0) return;

  const target = resolveUmamiTarget();
  if (target === null) {
    queue = [];
    return;
  }

  // Taken before any I/O: a pagehide arriving mid-flush must find an empty
  // queue rather than re-send what is already on the wire.
  const batch = queue;
  queue = [];

  const endpoint = `${target.baseUrl}/api/batch`;
  const body = JSON.stringify(
    batch.map(item =>
      item.kind === 'performance'
        ? {
            type: 'performance',
            payload: {
              website: target.websiteId,
              hostname: window.location.hostname,
              language: navigator.language,
              url: item.url,
              ...item.metrics,
            },
          }
        : {
            type: 'event',
            payload: {
              website: target.websiteId,
              name: item.name,
              ...(item.data && { data: item.data }),
              hostname: window.location.hostname,
              language: navigator.language,
              url: item.url,
            },
          }
    )
  );

  // Analytics must never break the app: nothing below is awaited by the caller,
  // and `deliver` resolves rather than rejects on every transport outcome.
  void deliver(endpoint, body);
}

/**
 * Deliver one event immediately, over a request the navigation cannot cancel.
 *
 * For the two events that precede a SAME-TAB navigation — `checkout_start`
 * before `location.href = checkoutUrl`, `language_change` before the full
 * reload that fetches the new locale's SSG HTML. Both announce the thing that
 * kills them.
 *
 * `trackEvent` is wrong here twice over: `window.umami.track()` sends without
 * `keepalive`, so a fast redirect cancels the request, and it is gated on the
 * script having executed rather than on the tag being present. `trackBeacon`
 * fixes the first but not the second (core.ts). This path is gated only on the
 * DOM (`resolveUmamiTarget()` above), so it divides the same population as the
 * batched impressions it will be compared against.
 *
 * Not for `target="_blank"` clicks: a new browsing context does not unload this
 * page, so those keep `trackEvent` and stay out of the queue.
 */
export function trackNavigating(name: AnalyticsEventName, data?: EventData): void {
  enqueueEvent(name, data);
  flushEvents();
}

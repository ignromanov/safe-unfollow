import { isTrackingOptedOut } from './consent';
import { resolveUmamiTarget } from './endpoint';

import type { AnalyticsEventName } from './constants';

export type EventData = Record<string, string | number | boolean>;

interface QueuedEvent {
  name: AnalyticsEventName;
  data?: EventData;
  /** Captured at enqueue: a flush routinely happens after the route changed. */
  url: string;
}

/**
 * Flush once the queue reaches this many events.
 *
 * A safety margin rather than a byte limit — promo impressions arrive a handful
 * per page, so the cap exists to bound memory on a pathological session, not to
 * stay under sendBeacon's 64 KiB.
 */
export const MAX_BATCH_SIZE = 20;

let queue: QueuedEvent[] = [];

/**
 * Queue one event for delivery.
 *
 * Consent is checked here, on every call, and never at flush time: a visitor
 * who declines mid-session must not have their earlier impressions delivered by
 * a later route change.
 */
export function enqueueEvent(name: AnalyticsEventName, data?: EventData): void {
  if (import.meta.env.DEV) return;
  if (typeof window === 'undefined') return;
  if (isTrackingOptedOut()) return;
  // No analytics tag means analytics never loaded — nothing to deliver to.
  if (resolveUmamiTarget() === null) return;

  queue.push({ name, data, url: window.location.pathname });

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

  const endpoint = `${target.origin}/api/batch`;
  const body = JSON.stringify(
    batch.map(event => ({
      type: 'event',
      payload: {
        website: target.websiteId,
        name: event.name,
        ...(event.data && { data: event.data }),
        hostname: window.location.hostname,
        language: navigator.language,
        url: event.url,
      },
    }))
  );

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
  void fetch(endpoint, {
    method: 'POST',
    body,
    keepalive: true,
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => {
    // Analytics must never break the app.
  });
}

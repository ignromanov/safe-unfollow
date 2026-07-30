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

  try {
    // Returns false synchronously when the user-agent queue is full. It neither
    // throws nor retries, so the boolean is the only failure signal there is.
    if (navigator.sendBeacon?.(endpoint, new Blob([body], { type: 'application/json' }))) {
      return;
    }
  } catch {
    // Fall through to fetch.
  }

  void fetch(endpoint, {
    method: 'POST',
    body,
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => {
    // Analytics must never break the app.
  });
}

/**
 * Core tracking functions: opt-in/out, trackEvent, trackBeacon.
 */

import { TRACKING_OPT_OUT_KEY } from './constants';
import type { AnalyticsEventName } from './constants';
import { isTrackingOptedOut } from './consent';
import { resolveUmamiTarget } from './endpoint';
import { clearEventQueue } from './queue';

export { isTrackingOptedOut };

/**
 * Opt out of tracking - Umami script will not load
 */
export function optOutOfTracking(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TRACKING_OPT_OUT_KEY, 'true');
  // Cleared, not flushed: consent withdrawn now also covers what is already
  // pending from before the visitor changed their mind.
  clearEventQueue();
  // Remove existing umami instance if present
  delete window.umami;
}

/**
 * Opt back into tracking
 */
export function optIntoTracking(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TRACKING_OPT_OUT_KEY);
  // Reload page to load Umami script
  window.location.reload();
}

/**
 * Track event with Umami
 * Safe to call even if Umami hasn't loaded
 * Disabled in development mode or if user opted out
 */
export function trackEvent(
  eventName: AnalyticsEventName,
  eventData?: Record<string, string | number | boolean>
): void {
  // Skip analytics in development or if opted out
  if (import.meta.env.DEV || isTrackingOptedOut()) {
    return;
  }

  try {
    if (typeof window !== 'undefined' && window.umami) {
      window.umami.track(eventName, eventData);
    }
  } catch {
    // Silently fail - analytics should never break the app
  }
}

/**
 * Track one event over a request that survives page unload.
 * Falls back to regular trackEvent when the Umami instance cannot be resolved.
 */
export function trackBeacon(
  eventName: AnalyticsEventName,
  eventData?: Record<string, string | number | boolean>
): void {
  if (import.meta.env.DEV || isTrackingOptedOut()) return;
  if (typeof window === 'undefined') return;

  const target = window.umami ? resolveUmamiTarget() : null;
  if (target === null) {
    trackEvent(eventName, eventData);
    return;
  }

  // Same transport as the batch queue, and for the same reason: sendBeacon is
  // spec'd with credentials mode 'include' and no way to opt out, while Umami
  // answers cross-origin with `Access-Control-Allow-Origin: *` — invalid for a
  // credentialed request, so the browser drops the delivery while sendBeacon
  // reports success. See flushEvents() in ./queue.ts.
  void fetch(`${target.origin}/api/send`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'event',
      payload: {
        website: target.websiteId,
        name: eventName,
        data: eventData,
        hostname: window.location.hostname,
        language: navigator.language,
        url: window.location.pathname,
      },
    }),
    keepalive: true,
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => {
    // Analytics must never break the app.
  });
}

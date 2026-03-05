/**
 * Core tracking functions: opt-in/out, trackEvent, trackBeacon.
 */

import { TRACKING_OPT_OUT_KEY } from './constants';
import type { AnalyticsEventName } from './constants';

/**
 * Check if user has opted out of tracking
 */
export function isTrackingOptedOut(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(TRACKING_OPT_OUT_KEY) === 'true';
}

/**
 * Opt out of tracking - Umami script will not load
 */
export function optOutOfTracking(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TRACKING_OPT_OUT_KEY, 'true');
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
 * Track event via sendBeacon for reliable delivery on page unload.
 * Falls back to regular trackEvent if sendBeacon is unavailable.
 */
export function trackBeacon(
  eventName: AnalyticsEventName,
  eventData?: Record<string, string | number | boolean>
): void {
  if (import.meta.env.DEV || isTrackingOptedOut()) return;
  if (typeof window === 'undefined') return;

  // Try sendBeacon first for reliability on mobile page unload
  if (navigator.sendBeacon && window.umami) {
    try {
      // Umami's collect endpoint
      const scriptEl = document.querySelector('script[data-website-id]');
      const websiteId = scriptEl?.getAttribute('data-website-id');
      const src = scriptEl?.getAttribute('src');
      if (src && websiteId) {
        const baseUrl = new URL(src).origin;
        navigator.sendBeacon(
          `${baseUrl}/api/send`,
          new Blob(
            [
              JSON.stringify({
                type: 'event',
                payload: {
                  website: websiteId,
                  name: eventName,
                  data: eventData,
                  hostname: window.location.hostname,
                  language: navigator.language,
                  url: window.location.pathname,
                },
              }),
            ],
            { type: 'application/json' }
          )
        );
        return;
      }
    } catch {
      // Fall through to regular tracking
    }
  }

  // Fallback: regular tracking
  trackEvent(eventName, eventData);
}

import { AnalyticsEvents, trackBeacon } from '@/lib/analytics';
import { useEffect } from 'react';

const SESSION_START_KEY = 'analytics_session_start';
const PAGES_VIEWED_KEY = 'analytics_pages_viewed';
const SESSION_FIRED_KEY = 'analytics_session_fired';

/**
 * Track session duration and pages viewed.
 * Uses sessionStorage to persist across page navigations within the same session.
 *
 * V9: Rewritten for mobile reliability (81% of traffic is mobile).
 * Uses layered event listeners + sendBeacon:
 * - visibilitychange (most reliable on mobile)
 * - pagehide (Safari-specific, fires when page is being unloaded)
 * - beforeunload (desktop fallback)
 *
 * Deduplication via sessionStorage flag prevents double-firing.
 */
export function useSessionDuration(): void {
  useEffect(() => {
    // Initialize session start time if not set
    const existingStart = sessionStorage.getItem(SESSION_START_KEY);
    if (!existingStart) {
      sessionStorage.setItem(SESSION_START_KEY, Date.now().toString());
      sessionStorage.removeItem(SESSION_FIRED_KEY);
    }

    // Increment pages viewed counter
    const currentPages = parseInt(sessionStorage.getItem(PAGES_VIEWED_KEY) ?? '0', 10);
    sessionStorage.setItem(PAGES_VIEWED_KEY, (currentPages + 1).toString());

    const fireSessionEvent = () => {
      // Deduplication: only fire once per session
      if (sessionStorage.getItem(SESSION_FIRED_KEY)) return;

      const startTime = parseInt(sessionStorage.getItem(SESSION_START_KEY) ?? '0', 10);
      const pagesViewed = parseInt(sessionStorage.getItem(PAGES_VIEWED_KEY) ?? '1', 10);

      if (startTime > 0) {
        const durationSeconds = (Date.now() - startTime) / 1000;

        // Only fire if session was meaningful (>10 seconds)
        if (durationSeconds >= 10) {
          sessionStorage.setItem(SESSION_FIRED_KEY, 'true');
          trackBeacon(AnalyticsEvents.SESSION_DURATION, {
            duration_seconds: Math.round(durationSeconds),
            pages_viewed: pagesViewed,
          });
        }
      }
    };

    // Layer 1: visibilitychange — most reliable on mobile
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        fireSessionEvent();
      }
    };

    // Layer 2: pagehide — Safari-specific, fires on actual navigation away
    const handlePageHide = () => {
      fireSessionEvent();
    };

    // Layer 3: beforeunload — desktop fallback
    const handleBeforeUnload = () => {
      fireSessionEvent();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
}

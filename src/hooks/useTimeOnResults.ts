import { analytics, AnalyticsEvents, trackBeacon } from '@/lib/analytics';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Track time spent on results page and user engagement.
 * Fires analytics events on unmount or when page becomes hidden.
 *
 * V7: Extended to track profile clicks with badge aggregation.
 * Sends both timeOnResults and resultsClicksSummary events.
 *
 * V9: Uses sendBeacon for reliable delivery on mobile page unload.
 * Also uses pagehide as additional listener for Safari.
 *
 * @param accountCount - Total number of accounts being viewed
 * @param isActive - Whether the results are currently being displayed
 */
export function useTimeOnResults(accountCount: number, isActive: boolean) {
  const startTimeRef = useRef<number | null>(null);
  const actionsCountRef = useRef(0);
  const clicksCountRef = useRef(0);
  const badgeClicksRef = useRef<Record<string, number>>({});
  const hasFiredRef = useRef(false);

  // Track user actions (filter, search, etc.)
  const trackAction = useCallback(() => {
    actionsCountRef.current += 1;
  }, []);

  // Track profile clicks with badge types (for aggregation)
  const trackClick = useCallback((badges: string[]) => {
    clicksCountRef.current += 1;
    actionsCountRef.current += 1;
    badges.forEach(badge => {
      badgeClicksRef.current[badge] = (badgeClicksRef.current[badge] || 0) + 1;
    });
  }, []);

  // Fire the analytics events via sendBeacon for reliability
  const fireEvent = useCallback(() => {
    if (hasFiredRef.current || startTimeRef.current === null) {
      return;
    }

    const timeSpent = (Date.now() - startTimeRef.current) / 1000;

    // Only fire if user spent meaningful time (>5 seconds), 25% sampling
    if (timeSpent >= 5 && Math.random() <= 0.25) {
      // Use sendBeacon for timeOnResults (fires on page leave)
      trackBeacon(AnalyticsEvents.TIME_ON_RESULTS, {
        time_seconds: Math.round(timeSpent),
        account_count: accountCount,
        actions_count: actionsCountRef.current,
      });

      // Send aggregated click summary (only if there were clicks)
      if (clicksCountRef.current > 0) {
        analytics.resultsClicksSummary({
          totalClicks: clicksCountRef.current,
          badgeClicks: badgeClicksRef.current,
          timeSpentSeconds: timeSpent,
        });
      }

      hasFiredRef.current = true;
    }
  }, [accountCount]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    // Start tracking
    startTimeRef.current = Date.now();
    actionsCountRef.current = 0;
    clicksCountRef.current = 0;
    badgeClicksRef.current = {};
    hasFiredRef.current = false;

    // Layer 1: visibilitychange (most reliable on mobile)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        fireEvent();
      }
    };

    // Layer 2: pagehide (Safari-specific)
    const handlePageHide = () => {
      fireEvent();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    // Fire on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      fireEvent();
    };
  }, [isActive, fireEvent]);

  return { trackAction, trackClick };
}

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
  const hasDecidedRef = useRef(false);

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
    if (hasDecidedRef.current || startTimeRef.current === null) {
      return;
    }

    const timeSpent = (Date.now() - startTimeRef.current) / 1000;

    // Below the engagement floor this visit has nothing to say yet, and a later
    // trigger may still clear the bar — so do not spend the guard on it.
    if (timeSpent < 5) {
      return;
    }

    // The guard goes up once the sampling decision is made — whether or not
    // the roll passes — before the dice are rolled. Setting it inside the
    // sampling branch let a failed roll re-roll on each of three triggers,
    // making a documented 25% behave like 1 - 0.75^n.
    hasDecidedRef.current = true;

    if (Math.random() > 0.25) {
      return;
    }

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
    hasDecidedRef.current = false;

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

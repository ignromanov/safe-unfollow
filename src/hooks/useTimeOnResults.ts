import { analytics, AnalyticsEvents, trackBeacon } from '@/lib/analytics';
import { buildFilterSummary, resetFilterSession } from '@/lib/stats/filter-session';
import { useCallback, useEffect, useRef } from 'react';

interface UseTimeOnResultsReturn {
  trackAction: () => void;
  trackClick: (badges: string[]) => void;
  /**
   * Emit the filtering session so far. Exposed because the empty result is
   * reached in `AccountListSection`, and that is the moment worth a row.
   */
  fireFilterSummary: () => void;
}

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
export function useTimeOnResults(accountCount: number, isActive: boolean): UseTimeOnResultsReturn {
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

  // The filter summary rides the same three triggers as the time beacon and
  // none of its gates. `fireEvent` above is a 25% sample of visits longer than
  // five seconds; this replaces a series `events.ts` (GH#123) made unsampled on
  // purpose, and the sessions the floor drops — two filters, an empty list,
  // gone in four seconds — are the ones the measurement exists for.
  const filterSeqRef = useRef(0);
  const lastFilterSigRef = useRef<string | null>(null);

  const fireFilterSummary = useCallback(() => {
    const summary = buildFilterSummary();
    if (!summary) {
      return;
    }

    // Emitted again only when something changed since the last emit. The
    // accumulator is cumulative, so the later row supersedes the earlier one
    // entirely: a reader who switches tabs at 3s and keeps filtering is not
    // recorded as having done nothing, and a reader who switches tabs twice
    // without filtering does not cost two rows.
    const signature = JSON.stringify(summary);
    if (signature === lastFilterSigRef.current) {
      return;
    }
    lastFilterSigRef.current = signature;

    analytics.filterSessionSummary(summary, filterSeqRef.current++);
  }, []);

  // The visit boundary, and nothing else. `fireFilterSummary` is
  // useCallback(..., []) and therefore identity-stable, so this cleanup runs on
  // exactly two occasions: `isActive` goes false, and the component unmounts.
  // Both are the end of the visit; an account-count change is not — and the
  // listener effect below, whose deps include `fireEvent`, re-runs on every one
  // of those. A reset there would wipe the accumulator mid-visit, arrival
  // included, and nothing would fail: the summary would quietly report a
  // fragment.
  //
  // Keep those useCallback deps empty for the same reason.
  useEffect(() => {
    if (!isActive) {
      return;
    }

    return () => {
      fireFilterSummary();
      resetFilterSession();
    };
  }, [isActive, fireFilterSummary]);

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
        fireFilterSummary();
      }
    };

    // Layer 2: pagehide (Safari-specific)
    const handlePageHide = () => {
      fireEvent();
      fireFilterSummary();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    // Fire on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      fireEvent();
      // Firing twice on the way out is free: the signature check above returns
      // without emitting when the reset effect's cleanup has already sent this
      // exact summary.
      fireFilterSummary();
    };
  }, [isActive, fireEvent, fireFilterSummary]);

  // The accumulator's last owner, and the only cleanup here registered whether
  // or not the visit ever became active.
  //
  // Both effects above return early on `!isActive`, so a mount that never became
  // active registers NO cleanup at all — and `isActive` is `hasLoadedData`,
  // which gates only the list body. The stat cards, the sheet trigger and the
  // options are rendered and clickable while it is false. Tap one during the
  // IndexedDB load, leave /results before it finishes, come back in the same
  // page life: without this, visit 2 inherits visit 1's toggles under visit 1's
  // `filter_session_id`, with `arrived_with`/`arrived_from` overwritten by visit
  // 2 — one row describing two visits — and if the reader never returns, those
  // toggles are never emitted at all.
  //
  // Deps are `[]` so this fires on unmount ONLY. It must not be folded into the
  // effect above, whose deps carry `isActive`: a reset there would run on the
  // false→true transition and wipe exactly the toggles this exists to save.
  // Registered last so it runs last, leaving the emit path above untouched — the
  // second reset on an active unmount replaces an already-empty accumulator, and
  // its only trace is one unused session id.
  useEffect(() => {
    return () => {
      resetFilterSession();
    };
  }, []);

  return { trackAction, trackClick, fireFilterSummary };
}

import { analytics, AnalyticsEvents, trackBeacon } from '@/lib/analytics';
import {
  buildFilterSummary,
  currentFilterSessionId,
  resetFilterSession,
} from '@/lib/stats/filter-session';
import { resultsTelemetry } from '@/lib/stats/results-click-events';
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
 * Sends both timeOnResults and results_clicks_summary events; the clicks row
 * is cumulative and re-sent on every trigger after the count moved.
 *
 * V9: Uses sendBeacon for reliable delivery on mobile page unload.
 * Also uses pagehide as additional listener for Safari.
 *
 * @param accountCount - Total number of accounts being viewed
 * @param isActive - Whether the results are currently being displayed
 */
/** Under this many seconds a visit is sent with `below_floor: true`. */
const FLOOR_SECONDS = 5;

export function useTimeOnResults(accountCount: number, isActive: boolean): UseTimeOnResultsReturn {
  const startTimeRef = useRef<number | null>(null);
  const actionsCountRef = useRef(0);
  const clicksCountRef = useRef(0);
  const badgeClicksRef = useRef<Record<string, number>>({});
  // At most one row per side of the floor per visit; see `fireEvent`.
  const sentRef = useRef({ below: false, above: false });
  const visitIdRef = useRef('');
  // Click count at the last clicks row, and that row's seq. See `fireClicks`.
  const clicksSentRef = useRef(0);
  const clicksSeqRef = useRef(0);

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

  // Every visit, unsampled. The old 25% roll existed only for storage.
  //
  // A trigger under the floor sends a `below_floor` row, but it does not end the
  // visit: a tab switch at 3s followed by ten minutes of reading must not be
  // recorded as a 3s visit. So each side of the floor sends at most once, both
  // rows carry the visit's `filter_session_id`, and the reader keeps the larger
  // `time_seconds` per id. Rows past the floor mean what they meant before:
  // the time at the first trigger after five seconds.
  const fireEvent = useCallback(() => {
    if (startTimeRef.current === null) {
      return;
    }

    const timeSpent = (Date.now() - startTimeRef.current) / 1000;
    const belowFloor = timeSpent < FLOOR_SECONDS;
    const side = belowFloor ? 'below' : 'above';
    if (sentRef.current[side]) {
      return;
    }
    sentRef.current[side] = true;

    trackBeacon(AnalyticsEvents.TIME_ON_RESULTS, {
      time_seconds: Math.round(timeSpent),
      account_count: accountCount,
      actions_count: actionsCountRef.current,
      below_floor: belowFloor,
      filter_session_id: visitIdRef.current,
    });
  }, [accountCount]);

  // The clicks row is cumulative and superseding, so unlike `fireEvent` it has
  // no per-side limit: it is re-sent on every trigger after the count moved.
  // It used to ride once with the first row past the floor, and a profile
  // opens in Instagram — the very click hides the tab — so the row nearly
  // always held exactly one click (97% of clicking visits). No floor gate
  // either: a later row supersedes, so a short first row costs nothing.
  const fireClicks = useCallback(() => {
    const clicks = clicksCountRef.current;
    if (startTimeRef.current === null || clicks === clicksSentRef.current) {
      return;
    }
    clicksSentRef.current = clicks;
    resultsTelemetry.clicksSummary(
      {
        totalClicks: clicks,
        badgeClicks: badgeClicksRef.current,
        timeSpentSeconds: (Date.now() - startTimeRef.current) / 1000,
      },
      visitIdRef.current,
      clicksSeqRef.current++
    );
  }, []);

  // The filter summary rides the same three triggers as the time beacon and
  // none of its per-side limits: it is cumulative and superseding, so it is
  // re-sent whenever it changed.
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
    sentRef.current = { below: false, above: false };
    clicksSentRef.current = 0;
    clicksSeqRef.current = 0;
    // Captured at the start: the reset effect's cleanup rotates the id before
    // this effect's cleanup sends the last row.
    visitIdRef.current = currentFilterSessionId();

    // Layer 1: visibilitychange (most reliable on mobile)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        fireEvent();
        fireClicks();
        fireFilterSummary();
      }
    };

    // Layer 2: pagehide (Safari-specific)
    const handlePageHide = () => {
      fireEvent();
      fireClicks();
      fireFilterSummary();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    // Fire on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      fireEvent();
      fireClicks();
      // Firing twice on the way out is free: the signature check above returns
      // without emitting when the reset effect's cleanup has already sent this
      // exact summary.
      fireFilterSummary();
    };
  }, [isActive, fireEvent, fireClicks, fireFilterSummary]);

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

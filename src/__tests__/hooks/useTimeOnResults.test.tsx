import { render } from '@testing-library/react';
import type { MutableRefObject } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/analytics', () => ({
  analytics: { resultsClicksSummary: vi.fn(), filterSessionSummary: vi.fn() },
  AnalyticsEvents: { TIME_ON_RESULTS: 'time_on_results' },
  trackBeacon: vi.fn(),
}));

import { analytics, AnalyticsEvents, trackBeacon } from '@/lib/analytics';
import { useTimeOnResults } from '@/hooks/useTimeOnResults';
import { recordToggle, resetFilterSession } from '@/lib/stats/filter-session';
import type { BadgeKey } from '@/core/types';

type TimeOnResultsApi = ReturnType<typeof useTimeOnResults>;

function Harness({
  accountCount,
  isActive,
  apiRef,
}: {
  accountCount: number;
  isActive: boolean;
  apiRef?: MutableRefObject<TimeOnResultsApi | null>;
}) {
  const api = useTimeOnResults(accountCount, isActive);
  if (apiRef) {
    // Plain ref write during render — no state, no re-render triggered — so the
    // test can reach `trackClick` without switching this suite to renderHook.
    apiRef.current = api;
  }
  return null;
}

describe('useTimeOnResults', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('time_on_results: every visit, at most one row per side of the floor', () => {
    // The mocks are cleared per attempt, not in afterEach: see the note in the
    // filter-summary block below on `retry: 2`.
    beforeEach(() => {
      resetFilterSession();
      vi.clearAllMocks();
    });

    function hide() {
      vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
      document.dispatchEvent(new Event('visibilitychange'));
    }

    function timeRows() {
      return vi
        .mocked(trackBeacon)
        .mock.calls.filter(([name]) => name === AnalyticsEvents.TIME_ON_RESULTS)
        .map(([, payload]) => payload as Record<string, unknown>);
    }

    it('sends a visit past the floor without consulting any dice', () => {
      // A roll that would have lost the old 25% sample. If anything still
      // samples, this visit disappears.
      vi.spyOn(Math, 'random').mockReturnValue(0.99);
      vi.spyOn(Date, 'now').mockReturnValue(0);

      const apiRef: MutableRefObject<TimeOnResultsApi | null> = { current: null };
      const { unmount } = render(<Harness accountCount={100} isActive apiRef={apiRef} />);
      apiRef.current?.trackClick(['mutuals']);

      // 7.4s: Math.round is exercised, not just a whole number.
      vi.spyOn(Date, 'now').mockReturnValue(7_400);
      unmount();

      expect(timeRows()).toEqual([
        {
          time_seconds: 7,
          account_count: 100,
          actions_count: 1,
          below_floor: false,
          filter_session_id: expect.stringMatching(/.+/),
        },
      ]);
      expect(analytics.resultsClicksSummary).toHaveBeenCalledTimes(1);
    });

    it('sends a visit under the five second floor, marked as such', () => {
      vi.spyOn(Date, 'now').mockReturnValue(0);
      const apiRef: MutableRefObject<TimeOnResultsApi | null> = { current: null };
      const { unmount } = render(<Harness accountCount={100} isActive apiRef={apiRef} />);
      apiRef.current?.trackClick(['mutuals']);

      vi.spyOn(Date, 'now').mockReturnValue(2_000);
      unmount();

      expect(timeRows()).toEqual([
        expect.objectContaining({ time_seconds: 2, below_floor: true, actions_count: 1 }),
      ]);
      // Clicks ride only with the row past the floor, as before.
      expect(analytics.resultsClicksSummary).not.toHaveBeenCalled();
    });

    it('sends one row per side of the floor, however many triggers fire', () => {
      // Hidden at 3s (a tab switch), back, then gone at 9s through all three
      // triggers. The short row must not stand for the whole visit, and the
      // later triggers must not repeat either row.
      vi.spyOn(Date, 'now').mockReturnValue(0);
      const { unmount } = render(<Harness accountCount={100} isActive />);

      vi.spyOn(Date, 'now').mockReturnValue(3_000);
      hide();
      window.dispatchEvent(new Event('pagehide'));

      vi.spyOn(Date, 'now').mockReturnValue(9_000);
      hide();
      window.dispatchEvent(new Event('pagehide'));
      unmount();

      const rows = timeRows();
      expect(rows.map(r => [r.time_seconds, r.below_floor])).toEqual([
        [3, true],
        [9, false],
      ]);
      // One visit, one key: the reader keeps the larger time per key.
      expect(rows[0]?.filter_session_id).toBe(rows[1]?.filter_session_id);
    });

    it('gives two visits two different keys', () => {
      vi.spyOn(Date, 'now').mockReturnValue(0);
      const first = render(<Harness accountCount={100} isActive />);
      vi.spyOn(Date, 'now').mockReturnValue(6_000);
      first.unmount();

      vi.spyOn(Date, 'now').mockReturnValue(10_000);
      const second = render(<Harness accountCount={100} isActive />);
      vi.spyOn(Date, 'now').mockReturnValue(16_000);
      second.unmount();

      const [a, b] = timeRows();
      expect(a?.filter_session_id).toEqual(expect.any(String));
      expect(a?.filter_session_id).not.toBe(b?.filter_session_id);
    });

    it("carries the id the visit's filter steps carry", () => {
      // The join that makes time-on-page readable against filtering.
      vi.spyOn(Date, 'now').mockReturnValue(0);
      recordToggle('unfollowed', 'enable', new Set<BadgeKey>(['unfollowed']), 'chip');
      const { unmount } = render(<Harness accountCount={100} isActive />);
      vi.spyOn(Date, 'now').mockReturnValue(6_000);
      unmount();

      const summary = vi.mocked(analytics.filterSessionSummary).mock.calls[0]?.[0];
      expect(summary?.id).toEqual(expect.any(String));
      expect(timeRows()[0]?.filter_session_id).toBe(summary?.id);
    });
  });

  describe('the filter session summary', () => {
    beforeEach(() => {
      // The accumulator is module state, so it survives between tests.
      resetFilterSession();
      // And the mocks are cleared HERE rather than left to the file's
      // `afterEach`, because `vitest.config.ts:299` sets `retry: 2`. Vitest runs
      // afterEach hooks in reverse registration order, so `vi.restoreAllMocks()`
      // fires before testing-library's auto-cleanup unmounts the tree — and the
      // unmount emits a summary. A failed attempt therefore hands the retry a
      // mock that has already been called, and the retry goes green on the
      // previous attempt's emit. Measured: the assertion below saw 0 calls on
      // attempt 1 and 1 on attempt 2. Clearing per-attempt removes the channel.
      vi.clearAllMocks();
    });

    function leave() {
      vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
      document.dispatchEvent(new Event('visibilitychange'));
    }

    it('sends the filter summary on leave when the reader filtered', () => {
      recordToggle('unfollowed', 'enable', new Set<BadgeKey>(['unfollowed']), 'chip');

      render(<Harness accountCount={100} isActive />);
      leave();

      expect(analytics.filterSessionSummary).toHaveBeenCalledWith(
        expect.objectContaining({ toggleCount: 1 }),
        0
      );
    });

    it('sends nothing when the reader never filtered', () => {
      render(<Harness accountCount={100} isActive />);
      leave();

      // The control on cost: without it, an implementation emitting an empty
      // summary for every visit to /results passes everything above and costs
      // more rows than the per-toggle stream it replaces.
      expect(analytics.filterSessionSummary).not.toHaveBeenCalled();
    });

    it('sends a summary from a session shorter than the time beacon floor', () => {
      vi.spyOn(Date, 'now').mockReturnValue(0);
      recordToggle('unfollowed', 'enable', new Set<BadgeKey>(['unfollowed']), 'chip');

      render(<Harness accountCount={100} isActive />);
      vi.spyOn(Date, 'now').mockReturnValue(4_000); // under the 5s floor
      leave();

      expect(analytics.filterSessionSummary).toHaveBeenCalled(); // not gated
    });

    it('supersedes rather than repeats when the session continues', () => {
      recordToggle('unfollowed', 'enable', new Set<BadgeKey>(['unfollowed']), 'chip');

      render(<Harness accountCount={100} isActive />);
      leave();
      leave(); // nothing changed -> no second row
      expect(analytics.filterSessionSummary).toHaveBeenCalledTimes(1);

      recordToggle('pending', 'enable', new Set<BadgeKey>(['pending', 'unfollowed']), 'chip'); // the session continued
      leave();

      expect(analytics.filterSessionSummary).toHaveBeenCalledTimes(2);
      expect(analytics.filterSessionSummary).toHaveBeenLastCalledWith(
        expect.objectContaining({ toggleCount: 2 }),
        1
      );
    });

    it('keeps the accumulator when the account count changes mid-visit', () => {
      recordToggle('unfollowed', 'enable', new Set<BadgeKey>(['unfollowed']), 'chip');

      const { rerender } = render(<Harness accountCount={100} isActive />);
      rerender(<Harness accountCount={250} isActive />); // a filter resolved
      leave();

      // The gate on the reset living outside the listener effect: that effect's
      // cleanup re-runs on every accountCount change, and a reset there wipes
      // the accumulator — arrival included — mid-visit. Every other test in this
      // file holds accountCount constant, so nothing else would notice.
      expect(analytics.filterSessionSummary).toHaveBeenCalledWith(
        expect.objectContaining({ toggleCount: 1 }),
        0
      );
    });

    it('keeps two filtering sessions in one page life distinguishable', () => {
      // /results -> elsewhere -> /results, inside one Umami session. Each cycle
      // is a complete, independent filtering session: the reset effect's cleanup
      // ends the accumulator and the seq sequence together, so both emit seq 0.
      recordToggle('unfollowed', 'enable', new Set<BadgeKey>(['unfollowed']), 'chip');
      render(<Harness accountCount={100} isActive />).unmount();

      recordToggle('pending', 'enable', new Set<BadgeKey>(['pending']), 'chip');
      render(<Harness accountCount={100} isActive />).unmount();

      const calls = vi.mocked(analytics.filterSessionSummary).mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0]?.[0].toggleCount).toBe(1);
      expect(calls[1]?.[0].toggleCount).toBe(1);

      // Both really do carry seq 0 — that is not the bug, it is the input to it.
      expect(calls[0]?.[1]).toBe(0);
      expect(calls[1]?.[1]).toBe(0);

      // The bug is that the dedup rule this task ships would then keep one row
      // and silently discard the other, undercounting filtering sessions and
      // reached_empty in the flattering direction. The id is what makes the two
      // groupable separately, so nothing has to be discarded.
      expect(calls[0]?.[0].id).not.toBe(calls[1]?.[0].id);
      expect(calls[0]?.[0].id).toBeTruthy();
    });

    it('does not carry an inactive visit into the next mount', () => {
      // Finding 6. Both emitting effects return early on `!isActive`, so a mount
      // that never became active used to register no cleanup at all — and
      // `isActive` is `hasLoadedData`, which gates only the list body: the stat
      // cards and the options are clickable while it is false.
      //
      // Visit 1: the reader taps a stat card during the IndexedDB load and
      // leaves before it finishes. Nothing may be emitted for it — there is no
      // active visit — but it must not be inherited either.
      recordToggle('unfollowed', 'enable', new Set<BadgeKey>(['unfollowed']), 'chip');
      const first = render(<Harness accountCount={100} isActive={false} />);
      first.unmount();

      expect(analytics.filterSessionSummary).not.toHaveBeenCalled();

      // Visit 2, same page life, this time with data.
      recordToggle('pending', 'enable', new Set<BadgeKey>(['pending']), 'chip');
      render(<Harness accountCount={100} isActive />);
      leave();

      const calls = vi.mocked(analytics.filterSessionSummary).mock.calls;
      // The instrument: without this, the two assertions below are also
      // satisfied by an emit that never happened.
      expect(calls).toHaveLength(1);
      // Visit 1's toggle is absent. Under the defect this row reported
      // toggleCount 2 and both badges — one row describing two visits, under
      // visit 1's id, with visit 2's arrival written over visit 1's.
      expect(calls[0]?.[0].toggleCount).toBe(1);
      expect(calls[0]?.[0].filtersUsed).toEqual({ pending: 1 });
    });

    it('keeps a toggle made before the data arrived', () => {
      // The other side of the same guard clause, and the reason the unmount
      // reset above is its own `[]`-keyed effect rather than a reset folded into
      // the `isActive`-keyed one. Folding it there looks equivalent and passes
      // the test above — but its cleanup also runs on the false -> true
      // TRANSITION, wiping exactly the toggles that test exists to save.
      //
      // One mount, one visit: the reader taps a stat card while the list is
      // still loading, the data lands, and they leave. The row must carry the
      // tap.
      const { rerender } = render(<Harness accountCount={100} isActive={false} />);
      recordToggle('unfollowed', 'enable', new Set<BadgeKey>(['unfollowed']), 'chip');

      rerender(<Harness accountCount={100} isActive />);
      leave();

      const calls = vi.mocked(analytics.filterSessionSummary).mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0]?.[0].filtersUsed).toEqual({ unfollowed: 1 });
      expect(calls[0]?.[0].toggleCount).toBe(1);
    });

    it('keeps one session under one id across its own repeated emits', () => {
      // The other half, and the trap in the obvious fix: a per-emit counter
      // would make these two rows look like two sessions, and the supersede rule
      // exists precisely to collapse them.
      recordToggle('unfollowed', 'enable', new Set<BadgeKey>(['unfollowed']), 'chip');

      render(<Harness accountCount={100} isActive />);
      leave();
      recordToggle('pending', 'enable', new Set<BadgeKey>(['pending', 'unfollowed']), 'chip');
      leave();

      const calls = vi.mocked(analytics.filterSessionSummary).mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0]?.[0].id).toBe(calls[1]?.[0].id);
      expect(calls[1]?.[1]).toBeGreaterThan(Number(calls[0]?.[1]));
    });
  });
});

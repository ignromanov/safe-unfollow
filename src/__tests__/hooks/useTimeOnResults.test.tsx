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

  it('rolls the sampling dice once per session, not once per trigger', () => {
    // The bug: hasFiredRef was set inside the sampling branch, so a failed roll
    // left the guard down and the next of three triggers rolled again. That
    // turns a documented 25% into 1 - 0.75^3 ~= 58%.
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99); // always fails the roll
    vi.spyOn(Date, 'now').mockReturnValue(0);

    const { unmount } = render(<Harness accountCount={100} isActive />);

    vi.spyOn(Date, 'now').mockReturnValue(10_000); // 10s spent, past the 5s floor

    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pagehide'));
    unmount();

    // Three triggers, and the dice must have been consulted exactly once.
    expect(random).toHaveBeenCalledTimes(1);
    expect(trackBeacon).not.toHaveBeenCalled();
  });

  it('still sends nothing for a visit under the five second floor', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01); // would pass the roll
    vi.spyOn(Date, 'now').mockReturnValue(0);

    const { unmount } = render(<Harness accountCount={100} isActive />);

    vi.spyOn(Date, 'now').mockReturnValue(2_000);
    unmount();

    expect(trackBeacon).not.toHaveBeenCalled();
  });

  it('sends the event with the right payload when the visit clears the floor and wins the roll', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // passes the 0.25 roll
    vi.spyOn(Date, 'now').mockReturnValue(0);

    const apiRef: MutableRefObject<TimeOnResultsApi | null> = { current: null };
    const { unmount } = render(<Harness accountCount={100} isActive apiRef={apiRef} />);

    apiRef.current?.trackClick(['mutual']);

    // 7.4s elapsed: picked so Math.round is actually exercised, not just a
    // whole number that would pass even if the rounding were dropped.
    vi.spyOn(Date, 'now').mockReturnValue(7_400);
    unmount();

    expect(trackBeacon).toHaveBeenCalledTimes(1);
    expect(trackBeacon).toHaveBeenCalledWith(AnalyticsEvents.TIME_ON_RESULTS, {
      time_seconds: 7,
      account_count: 100,
      actions_count: 1,
    });
    expect(analytics.resultsClicksSummary).toHaveBeenCalledTimes(1);
  });

  it('skips the click summary when the visit had no clicks', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // passes the 0.25 roll
    vi.spyOn(Date, 'now').mockReturnValue(0);

    const { unmount } = render(<Harness accountCount={100} isActive />);

    vi.spyOn(Date, 'now').mockReturnValue(7_400);
    unmount();

    expect(trackBeacon).toHaveBeenCalledTimes(1);
    expect(analytics.resultsClicksSummary).not.toHaveBeenCalled();
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
      recordToggle('unfollowed', 'enable', 1, 'chip');

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
      // The sampler is forced OPEN so that the only thing which can still hold
      // time_on_results back at 4s is the floor. Left to a real Math.random the
      // control below would pass ~75% of the time for the sampler's reason and
      // prove nothing about the floor; see the sibling test for the sampler.
      vi.spyOn(Math, 'random').mockReturnValue(0.01);
      vi.spyOn(Date, 'now').mockReturnValue(0);
      recordToggle('unfollowed', 'enable', 1, 'chip');

      render(<Harness accountCount={100} isActive />);
      vi.spyOn(Date, 'now').mockReturnValue(4_000); // under fireEvent's 5s floor
      leave();

      expect(analytics.filterSessionSummary).toHaveBeenCalled(); // not gated
      // The control: the floor still holds for time_on_results.
      expect(trackBeacon).not.toHaveBeenCalledWith(
        AnalyticsEvents.TIME_ON_RESULTS,
        expect.anything()
      );
    });

    it('sends a summary from a session that lost the time beacon sampling roll', () => {
      // The other half of the ruling, and the reason it is a second test: at 10s
      // the floor is cleared, so the only thing that can hold time_on_results
      // back is the losing roll. Deterministic — a failing roll is forced, not
      // waited for.
      vi.spyOn(Math, 'random').mockReturnValue(0.99); // loses the 0.25 roll
      vi.spyOn(Date, 'now').mockReturnValue(0);
      recordToggle('unfollowed', 'enable', 1, 'chip');

      render(<Harness accountCount={100} isActive />);
      vi.spyOn(Date, 'now').mockReturnValue(10_000); // well past the floor
      leave();

      expect(analytics.filterSessionSummary).toHaveBeenCalled(); // not sampled
      // The control: the sampler still holds for time_on_results.
      expect(trackBeacon).not.toHaveBeenCalledWith(
        AnalyticsEvents.TIME_ON_RESULTS,
        expect.anything()
      );
    });

    it('supersedes rather than repeats when the session continues', () => {
      recordToggle('unfollowed', 'enable', 1, 'chip');

      render(<Harness accountCount={100} isActive />);
      leave();
      leave(); // nothing changed -> no second row
      expect(analytics.filterSessionSummary).toHaveBeenCalledTimes(1);

      recordToggle('pending', 'enable', 2, 'chip'); // the session continued
      leave();

      expect(analytics.filterSessionSummary).toHaveBeenCalledTimes(2);
      expect(analytics.filterSessionSummary).toHaveBeenLastCalledWith(
        expect.objectContaining({ toggleCount: 2 }),
        1
      );
    });

    it('keeps the accumulator when the account count changes mid-visit', () => {
      recordToggle('unfollowed', 'enable', 1, 'chip');

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
      recordToggle('unfollowed', 'enable', 1, 'chip');
      render(<Harness accountCount={100} isActive />).unmount();

      recordToggle('pending', 'enable', 1, 'chip');
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
      recordToggle('unfollowed', 'enable', 1, 'chip');
      const first = render(<Harness accountCount={100} isActive={false} />);
      first.unmount();

      expect(analytics.filterSessionSummary).not.toHaveBeenCalled();

      // Visit 2, same page life, this time with data.
      recordToggle('pending', 'enable', 1, 'chip');
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
      recordToggle('unfollowed', 'enable', 1, 'chip');

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
      recordToggle('unfollowed', 'enable', 1, 'chip');

      render(<Harness accountCount={100} isActive />);
      leave();
      recordToggle('pending', 'enable', 2, 'chip');
      leave();

      const calls = vi.mocked(analytics.filterSessionSummary).mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0]?.[0].id).toBe(calls[1]?.[0].id);
      expect(calls[1]?.[1]).toBeGreaterThan(Number(calls[0]?.[1]));
    });
  });
});

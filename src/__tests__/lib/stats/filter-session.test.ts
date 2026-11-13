import { beforeEach, describe, expect, it } from 'vitest';
import {
  abandonPendingStep,
  buildFilterSummary,
  claimAnomaly,
  combinationOf,
  drainFilterSteps,
  notePredictions,
  recordArrival,
  recordClearAll,
  recordEmptyResult,
  recordToggle,
  resetFilterSession,
  resolvePendingStep,
  resultKeyOf,
} from '@/lib/stats/filter-session';
import type { BadgeKey } from '@/core/types';

describe('filter session accumulator', () => {
  beforeEach(() => resetFilterSession());

  it('should return null when the reader never filtered', () => {
    expect(buildFilterSummary()).toBeNull();
  });

  it('should return null for an arrival that carried nothing', () => {
    // The other half of the control above, and the one that decides cost: a
    // reader who lands on /results with no filter and no source must produce no
    // row at all. An accumulator that treated any arrival as "touched" would
    // emit one summary per visit to the page — more rows than the per-toggle
    // stream this replaces, which is the opposite of the point.
    recordArrival([], null, 'none');

    expect(buildFilterSummary()).toBeNull();
  });

  it('should count enables per badge and ignore disables in the ranking', () => {
    recordToggle('unfollowed', 'enable', new Set<BadgeKey>(['unfollowed']), 'chip');
    recordToggle('unfollowed', 'disable', new Set<BadgeKey>([]), 'chip');
    recordToggle('pending', 'enable', new Set<BadgeKey>(['pending']), 'chip');

    expect(buildFilterSummary()?.filtersUsed).toEqual({ unfollowed: 1, pending: 1 });
  });

  it('should hold the deepest selection reached, not the last one', () => {
    recordToggle('unfollowed', 'enable', new Set<BadgeKey>(['unfollowed']), 'chip');
    recordToggle('pending', 'enable', new Set<BadgeKey>(['pending', 'unfollowed']), 'chip');
    recordToggle('pending', 'disable', new Set<BadgeKey>(['unfollowed']), 'chip');

    expect(buildFilterSummary()?.maxActive).toBe(2);
  });

  it('should record what the reader arrived with, separately from what they did', () => {
    recordArrival(['pending', 'unfollowed'], null, 'persisted');
    recordToggle(
      'pending',
      'enable',
      new Set<BadgeKey>(['pending', 'unfollowed', 'mutuals']),
      'chip'
    );

    const summary = buildFilterSummary();
    expect(summary?.arrivedWith).toBe(2);
    expect(summary?.toggleCount).toBe(1);
  });

  it('should mix the sources', () => {
    recordToggle('unfollowed', 'enable', new Set<BadgeKey>(['unfollowed']), 'stat_card');
    recordToggle('pending', 'enable', new Set<BadgeKey>(['pending', 'unfollowed']), 'chip');
    recordToggle(
      'mutuals',
      'enable',
      new Set<BadgeKey>(['mutuals', 'unfollowed', 'pending']),
      'chip'
    );

    expect(buildFilterSummary()?.sourceMix).toEqual({ chip: 2, stat_card: 1 });
  });

  it('should report an empty result only when one was reached', () => {
    recordToggle('unfollowed', 'enable', new Set<BadgeKey>(['unfollowed']), 'chip');
    expect(buildFilterSummary()?.reachedEmpty).toBe(false);

    recordEmptyResult();
    expect(buildFilterSummary()?.reachedEmpty).toBe(true);
  });

  it('should survive an arrival with no toggle at all', () => {
    recordArrival(['pending'], 'pending-requests', 'url');

    expect(buildFilterSummary()?.toggleCount).toBe(0);
    expect(buildFilterSummary()?.arrivedWith).toBe(1);
    expect(buildFilterSummary()?.arrivedFrom).toBe('pending-requests');
  });

  it('should hand out a snapshot, not a view of live module state', () => {
    recordToggle('unfollowed', 'enable', new Set<BadgeKey>(['unfollowed']), 'chip');
    const summary = buildFilterSummary();

    recordToggle('pending', 'enable', new Set<BadgeKey>(['pending', 'unfollowed']), 'stat_card');

    // The emitter JSON.stringifies synchronously today, so a live reference is
    // harmless today. The hazard is a consumer that RETAINS the object — a spy
    // assertion reading mock.calls[0][0].sourceMix after further toggles is a
    // test that passes for the wrong reason, which is the one failure class
    // this branch keeps finding.
    expect(summary?.sourceMix).toEqual({ chip: 1 });
    expect(summary?.filtersUsed).toEqual({ unfollowed: 1 });
  });

  it('should treat a reached dead end as worth a row on its own', () => {
    recordEmptyResult();

    // Stated invariant, not an implicit one. Nothing in this module guarantees
    // that the arrival is always recorded first: that held only because two
    // effects in AccountListSection happen to be registered in that order, and
    // this branch rewrites that component.
    expect(buildFilterSummary()?.reachedEmpty).toBe(true);
  });
});

/**
 * `filter_step`: one row per action, plus step 0 at arrival. These drive the
 * real module state; the component suite proves the wiring.
 */
describe('filter steps', () => {
  beforeEach(() => {
    resetFilterSession();
    // Steps survive a reset on purpose (see below), so a previous test's leftovers
    // must be drained, not merely reset.
    drainFilterSteps();
    notePredictions(null, null);
  });

  const enable = (badge: BadgeKey, next: BadgeKey[]) =>
    recordToggle(badge, 'enable', new Set<BadgeKey>(next), 'chip');

  it('sorts the combination, so one set has one spelling', () => {
    expect(combinationOf(new Set<BadgeKey>(['unfollowed', 'notFollowingBack']))).toBe(
      'notFollowingBack+unfollowed'
    );
    expect(combinationOf([])).toBe('');
  });

  it('keys a result by combination AND query, ignoring surrounding whitespace', () => {
    expect(resultKeyOf(['pending'], ' ann ')).toBe(resultKeyOf(['pending'], 'ann'));
    expect(resultKeyOf(['pending'], 'ann')).not.toBe(resultKeyOf(['pending'], ''));
    expect(resultKeyOf(['pending'], '')).not.toBe(resultKeyOf([], ''));
  });

  it('numbers steps from 1 after the arrival and emits them once resolved', () => {
    enable('unfollowed', ['unfollowed']);
    resolvePendingStep(4, false);
    enable('notFollowingBack', ['unfollowed', 'notFollowingBack']);
    resolvePendingStep(0, false);

    const steps = drainFilterSteps();
    expect(steps.map(s => [s.step, s.combination, s.result?.count])).toEqual([
      [1, 'unfollowed', 4],
      [2, 'notFollowingBack+unfollowed', 0],
    ]);
    // Drained means gone: a second drain must not send them twice.
    expect(drainFilterSteps()).toEqual([]);
  });

  it('carries the summary id, so the two series join', () => {
    enable('unfollowed', ['unfollowed']);
    resolvePendingStep(4, false);

    expect(drainFilterSteps()[0]?.sessionId).toBe(buildFilterSummary()?.id);
  });

  it('holds nothing back for a step that has not resolved yet', () => {
    enable('unfollowed', ['unfollowed']);

    expect(drainFilterSteps()).toEqual([]);
  });

  it('sends an overtaken step as unresolved, never as zero', () => {
    enable('unfollowed', ['unfollowed']);
    enable('pending', ['unfollowed', 'pending']);
    resolvePendingStep(2, false);

    const [first, second] = drainFilterSteps();
    expect(first?.step).toBe(1);
    expect(first?.result).toBeUndefined();
    expect(second?.result).toEqual({ count: 2, searchActive: false });
  });

  it('sends the pending step as unresolved when the page goes away', () => {
    enable('unfollowed', ['unfollowed']);
    abandonPendingStep();

    const [step] = drainFilterSteps();
    expect(step?.step).toBe(1);
    expect(step?.result).toBeUndefined();
  });

  describe('step 0', () => {
    it('emits nothing at all for a visit that never filtered', () => {
      recordArrival([], null, 'none');
      resolvePendingStep(21, false);
      abandonPendingStep();

      expect(drainFilterSteps()).toEqual([]);
    });

    it('holds an untouched arrival and releases it with the first action, in order', () => {
      recordArrival([], null, 'none');
      resolvePendingStep(21, false);
      expect(drainFilterSteps()).toEqual([]);

      enable('unfollowed', ['unfollowed']);
      resolvePendingStep(4, false);

      const steps = drainFilterSteps();
      expect(steps.map(s => [s.step, s.action, s.source, s.result?.count])).toEqual([
        [0, 'arrival', 'none', 21],
        [1, 'enable', 'chip', 4],
      ]);
    });

    it('emits an arrival that is already touched as soon as it resolves', () => {
      recordArrival(['unfollowed', 'pending'], null, 'persisted');
      resolvePendingStep(1, false);

      const [step] = drainFilterSteps();
      expect(step).toMatchObject({
        step: 0,
        action: 'arrival',
        source: 'persisted',
        badge: '',
        combination: 'pending+unfollowed',
      });
    });

    it('drops an untouched arrival that never resolved, on reset', () => {
      // The page left before the first list resolved, and the reader did nothing.
      recordArrival([], null, 'none');
      resetFilterSession();

      expect(drainFilterSteps()).toEqual([]);
    });

    it('drops a held arrival when the session ends untouched', () => {
      recordArrival([], null, 'none');
      resolvePendingStep(21, false);
      resetFilterSession();
      enable('unfollowed', ['unfollowed']);
      resolvePendingStep(4, false);

      // The new session starts its own numbering and owns no step 0 from the
      // old one.
      expect(drainFilterSteps().map(s => s.step)).toEqual([1]);
    });
  });

  it("keeps a touched session's pending step across a reset", () => {
    // `useTimeOnResults` resets the session in an unmount cleanup that runs
    // before the step hook's own cleanup. The step must leave with its own id.
    enable('unfollowed', ['unfollowed']);
    const oldId = buildFilterSummary()?.id;
    resetFilterSession();

    const [step] = drainFilterSteps();
    expect(step?.sessionId).toBe(oldId);
    expect(step?.result).toBeUndefined();
  });

  it('records clear-all with no badge and no source, and leaves the summary alone', () => {
    recordArrival(['pending'], null, 'persisted');
    const before = buildFilterSummary();
    recordClearAll();
    resolvePendingStep(21, false);

    const steps = drainFilterSteps();
    expect(steps.at(-1)).toMatchObject({
      action: 'clear_all',
      badge: '',
      source: 'none',
      combination: '',
    });
    expect(buildFilterSummary()?.toggleCount).toBe(before?.toggleCount);
  });

  describe('predicted_count', () => {
    it('is the pre-click candidate count on enable', () => {
      notePredictions(combinationOf(['unfollowed']), { notFollowingBack: 3 } as Record<
        BadgeKey,
        number
      >);
      enable('notFollowingBack', ['unfollowed', 'notFollowingBack']);
      abandonPendingStep();

      expect(drainFilterSteps()[0]?.predictedCount).toBe(3);
    });

    it('is absent on disable', () => {
      notePredictions(combinationOf(['unfollowed', 'pending']), { pending: 2 } as Record<
        BadgeKey,
        number
      >);
      recordToggle('pending', 'disable', new Set<BadgeKey>(['unfollowed']), 'chip');
      abandonPendingStep();

      expect(drainFilterSteps()[0]?.predictedCount).toBeUndefined();
    });

    it('is absent when the counts belong to another selection', () => {
      // Candidate counts arrive asynchronously. Two quick enables would
      // otherwise predict the second one against the selection before the first.
      notePredictions(combinationOf([]), { notFollowingBack: 3 } as Record<BadgeKey, number>);
      enable('notFollowingBack', ['unfollowed', 'notFollowingBack']);
      abandonPendingStep();

      expect(drainFilterSteps()[0]?.predictedCount).toBeUndefined();
    });
  });

  describe('anomaly claims', () => {
    it('lets each kind fire once per filtering session', () => {
      expect(claimAnomaly('card_vs_list')).toBe(true);
      expect(claimAnomaly('card_vs_list')).toBe(false);
      expect(claimAnomaly('predicted_mismatch')).toBe(true);
    });

    it('re-arms on a new filtering session', () => {
      claimAnomaly('filter_failed');
      resetFilterSession();

      expect(claimAnomaly('filter_failed')).toBe(true);
    });
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildFilterSummary,
  recordArrival,
  recordEmptyResult,
  recordToggle,
  resetFilterSession,
} from '@/lib/stats/filter-session';

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
    recordArrival(0, null);

    expect(buildFilterSummary()).toBeNull();
  });

  it('should count enables per badge and ignore disables in the ranking', () => {
    recordToggle('unfollowed', 'enable', 1, 'chip');
    recordToggle('unfollowed', 'disable', 0, 'chip');
    recordToggle('pending', 'enable', 1, 'chip');

    expect(buildFilterSummary()?.filtersUsed).toEqual({ unfollowed: 1, pending: 1 });
  });

  it('should hold the deepest selection reached, not the last one', () => {
    recordToggle('unfollowed', 'enable', 1, 'chip');
    recordToggle('pending', 'enable', 2, 'chip');
    recordToggle('pending', 'disable', 1, 'chip');

    expect(buildFilterSummary()?.maxActive).toBe(2);
  });

  it('should record what the reader arrived with, separately from what they did', () => {
    recordArrival(2, null);
    recordToggle('pending', 'enable', 3, 'chip');

    const summary = buildFilterSummary();
    expect(summary?.arrivedWith).toBe(2);
    expect(summary?.toggleCount).toBe(1);
  });

  it('should mix the sources', () => {
    recordToggle('unfollowed', 'enable', 1, 'stat_card');
    recordToggle('pending', 'enable', 2, 'chip');
    recordToggle('mutuals', 'enable', 3, 'chip');

    expect(buildFilterSummary()?.sourceMix).toEqual({ chip: 2, stat_card: 1 });
  });

  it('should report an empty result only when one was reached', () => {
    recordToggle('unfollowed', 'enable', 1, 'chip');
    expect(buildFilterSummary()?.reachedEmpty).toBe(false);

    recordEmptyResult();
    expect(buildFilterSummary()?.reachedEmpty).toBe(true);
  });

  it('should survive an arrival with no toggle at all', () => {
    recordArrival(1, 'pending-requests');

    expect(buildFilterSummary()?.toggleCount).toBe(0);
    expect(buildFilterSummary()?.arrivedWith).toBe(1);
    expect(buildFilterSummary()?.arrivedFrom).toBe('pending-requests');
  });

  it('should hand out a snapshot, not a view of live module state', () => {
    recordToggle('unfollowed', 'enable', 1, 'chip');
    const summary = buildFilterSummary();

    recordToggle('pending', 'enable', 2, 'stat_card');

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

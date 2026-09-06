import type { BadgeKey } from '@/core/types';
import type { FilterAction, FilterSource } from './constants';

export interface FilterSessionSummary {
  filtersUsed: Partial<Record<BadgeKey, number>>;
  maxActive: number;
  arrivedWith: number;
  arrivedFrom: string | null;
  reachedEmpty: boolean;
  toggleCount: number;
  sourceMix: Partial<Record<FilterSource, number>>;
}

interface FilterSessionState extends FilterSessionSummary {
  /**
   * Whether anything worth a row happened. An arrival with no filter and no
   * source leaves it false, so a visit that never filtered costs nothing —
   * without it this emits one row per visit to /results and is more expensive
   * than the per-toggle stream it replaces.
   */
  touched: boolean;
}

function fresh(): FilterSessionState {
  return {
    filtersUsed: {},
    maxActive: 0,
    arrivedWith: 0,
    arrivedFrom: null,
    reachedEmpty: false,
    toggleCount: 0,
    sourceMix: {},
    touched: false,
  };
}

/**
 * One row per filtering session instead of 9.48 per-toggle rows.
 *
 * Module state rather than a hook, because the two call sites that mutate
 * filters live in different components and the beacon that reads it lives in a
 * third. `analytics` is already a module singleton for the same reason.
 *
 * `reachedEmpty` is recorded from the rendered result, not reconstructed from
 * the toggle stream: the stream is lossy and the render is the fact.
 */
let state: FilterSessionState = fresh();

export function resetFilterSession(): void {
  state = fresh();
}

export function recordArrival(activeCount: number, source: string | null): void {
  state.arrivedWith = activeCount;
  state.arrivedFrom = source;
  state.maxActive = Math.max(state.maxActive, activeCount);
  if (activeCount > 0 || source !== null) state.touched = true;
}

export function recordToggle(
  badge: BadgeKey,
  action: FilterAction,
  activeCount: number,
  source: FilterSource
): void {
  state.touched = true;
  state.toggleCount += 1;
  state.maxActive = Math.max(state.maxActive, activeCount);
  state.sourceMix[source] = (state.sourceMix[source] ?? 0) + 1;
  if (action === 'enable') {
    state.filtersUsed[badge] = (state.filtersUsed[badge] ?? 0) + 1;
  }
}

export function recordEmptyResult(): void {
  state.reachedEmpty = true;
}

/** The session so far, or null when nothing worth a row has happened. */
export function buildFilterSummary(): FilterSessionSummary | null {
  if (!state.touched) return null;

  return {
    filtersUsed: state.filtersUsed,
    maxActive: state.maxActive,
    arrivedWith: state.arrivedWith,
    arrivedFrom: state.arrivedFrom,
    reachedEmpty: state.reachedEmpty,
    toggleCount: state.toggleCount,
    sourceMix: state.sourceMix,
  };
}

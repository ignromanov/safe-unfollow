import type { BadgeKey } from '@/core/types';
import type { FilterAction, FilterSource } from './constants';

export interface FilterSessionSummary {
  /**
   * Which filtering session this is. See `newSessionId`; rows are grouped by it,
   * never by the Umami session alone.
   */
  id: string;
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

/**
 * One page life, six base-36 characters, computed once on import.
 *
 * `Math.random` is read here and nowhere else in this module, deliberately: the
 * hook that emits the summary samples `time_on_results` with `Math.random` too,
 * and a suite that asserts the dice were consulted exactly once
 * (`useTimeOnResults.test.tsx`) would count a per-session roll as a second
 * throw. Reading it at import time puts it before any spy.
 */
const PAGE_ID = Math.random().toString(36).slice(2, 8);

let sessionIndex = 0;

/**
 * Distinguishes one filtering session from the next inside one Umami session.
 *
 * `/results -> elsewhere -> /results` is two complete, independent filtering
 * sessions in one page life, and `seq` cannot tell them apart: it lives with the
 * hook instance and the accumulator resets on the same unmount, so both sessions
 * emit `seq: 0`. Reading "the highest seq per Umami session" would then keep one
 * row and silently discard the other — an undercount of filtering sessions and
 * of `reached_empty`, in the flattering direction, on exactly the navigation
 * that produces dead ends.
 *
 * A grouping key, never an identity: page-scoped entropy plus a counter,
 * regenerated per session, persisted nowhere, and derived from nothing the
 * reader supplied. It is strictly less identifying than the Umami session id
 * already attached to every event.
 */
function newSessionId(): string {
  return `${PAGE_ID}${(sessionIndex++).toString(36)}`;
}

function fresh(): FilterSessionState {
  return {
    id: newSessionId(),
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
  // `touched` too, and that is the invariant rather than a precaution: a reader
  // who reaches a provably empty combination is the finding this event exists
  // for, and it must be worth a row on its own evidence. It happened to be safe
  // without this only because the effect that calls it sits after the arrival
  // effect in one component — an ordering, not a guarantee.
  state.touched = true;
  state.reachedEmpty = true;
}

/** The session so far, or null when nothing worth a row has happened. */
export function buildFilterSummary(): FilterSessionSummary | null {
  if (!state.touched) return null;

  // The two maps are copied, not handed over. A caller that retains the summary
  // would otherwise keep reading module state as the session continues — and
  // the first thing to do that would be a test asserting on a spy's recorded
  // argument, which would then pass for the wrong reason.
  return {
    id: state.id,
    filtersUsed: { ...state.filtersUsed },
    maxActive: state.maxActive,
    arrivedWith: state.arrivedWith,
    arrivedFrom: state.arrivedFrom,
    reachedEmpty: state.reachedEmpty,
    toggleCount: state.toggleCount,
    sourceMix: { ...state.sourceMix },
  };
}

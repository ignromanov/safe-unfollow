import type { BadgeKey } from '@/core/types';
import type {
  FilterAction,
  FilterAnomalyKind,
  FilterSource,
  FilterStepAction,
  FilterStepSource,
} from './constants';

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

/**
 * One `filter_step` row before it is sent. `result` is absent when the step was
 * overtaken or the page went away before its list resolved: a measurement not
 * taken, which must never be read as an empty list.
 */
export interface FilterStep {
  sessionId: string;
  step: number;
  badge: BadgeKey | '';
  action: FilterStepAction;
  source: FilterStepSource;
  combination: string;
  /** On `enable` only, and only when the pre-click counts were for the pre-click selection. */
  predictedCount?: number;
  result?: { count: number; searchActive: boolean };
}

interface FilterSessionState extends FilterSessionSummary {
  /**
   * Whether anything worth a row happened. An arrival with no filter and no
   * source leaves it false, so a visit that never filtered costs nothing —
   * without it this emits one row per visit to /results and is more expensive
   * than the per-toggle stream it replaces.
   */
  touched: boolean;
  nextStep: number;
  /**
   * Steps finalised while the session was untouched — in practice step 0 only.
   * Released by the first touch, dropped by a reset, so a visit that never
   * filtered costs no `filter_step` row either.
   */
  held: FilterStep[];
  anomalies: Set<FilterAnomalyKind>;
}

/**
 * One page life, six base-36 characters, computed once on import.
 *
 * Read at import time, so it sits before any `Math.random` spy a suite installs.
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
    // 0 is the arrival's, whether or not one was recorded.
    nextStep: 1,
    held: [],
    anomalies: new Set(),
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

/**
 * The step waiting for its list to resolve, and the steps ready to send.
 *
 * Both live OUTSIDE `state`, and that is the point: `useTimeOnResults` resets
 * the session in an unmount cleanup that runs before the step hook's own, so
 * anything kept in `state` would leave under the next session's id, or not at
 * all. A step carries its own session id from the moment it begins.
 */
let pending: FilterStep | null = null;
let outbox: FilterStep[] = [];

/** Candidate counts last seen for a selection. See `notePredictions`. */
let predictions: { selection: string; counts: Record<BadgeKey, number> } | null = null;

/** The active set as one sorted string, so one set has exactly one spelling. */
export function combinationOf(filters: Iterable<BadgeKey>): string {
  return Array.from(filters).sort().join('+');
}

/**
 * Which list a result is: the combination and the trimmed query. A result is
 * the current one only when its key equals the key of what is selected now —
 * `isFiltering` alone lags `setFilters` by one render, and the indices land in
 * a transition after it clears.
 */
export function resultKeyOf(filters: Iterable<BadgeKey>, query: string): string {
  return `${combinationOf(filters)}|${query.trim()}`;
}

function finalize(step: FilterStep): void {
  if (state.touched) outbox.push(step);
  else state.held.push(step);
}

function touch(): void {
  state.touched = true;
  outbox.push(...state.held);
  state.held = [];
}

function beginStep(step: Omit<FilterStep, 'sessionId' | 'step'>): void {
  if (pending) finalize(pending);
  const number = step.action === 'arrival' ? 0 : state.nextStep++;
  pending = { sessionId: state.id, step: number, ...step };
}

/**
 * The current filtering session's id. `useTimeOnResults` sends it on
 * `time_on_results`, which makes time on the page joinable to the visit's
 * `filter_step` rows and its summary. A random id, never an identity.
 */
export function currentFilterSessionId(): string {
  return state.id;
}

export function resetFilterSession(): void {
  // A touched session's unresolved step still goes out, unresolved; an
  // untouched one's held arrival and pending step go nowhere.
  if (pending && state.touched) outbox.push(pending);
  pending = null;
  state = fresh();
}

export function recordArrival(
  arrived: readonly BadgeKey[],
  source: string | null,
  via: Extract<FilterStepSource, 'url' | 'persisted' | 'none'>
): void {
  state.arrivedWith = arrived.length;
  state.arrivedFrom = source;
  state.maxActive = Math.max(state.maxActive, arrived.length);
  beginStep({
    badge: '',
    action: 'arrival',
    source: via,
    combination: combinationOf(arrived),
  });
  if (arrived.length > 0 || source !== null) touch();
}

/**
 * `next` is the selection AFTER the toggle; the predicted count is looked up
 * against the selection before it, which is the only one the reader saw counts
 * for when they clicked.
 */
export function recordToggle(
  badge: BadgeKey,
  action: FilterAction,
  next: ReadonlySet<BadgeKey>,
  source: FilterSource
): void {
  touch();
  state.toggleCount += 1;
  state.maxActive = Math.max(state.maxActive, next.size);
  state.sourceMix[source] = (state.sourceMix[source] ?? 0) + 1;
  if (action === 'enable') {
    state.filtersUsed[badge] = (state.filtersUsed[badge] ?? 0) + 1;
  }

  const before = combinationOf([...next].filter(b => b !== badge));
  const predictedCount =
    action === 'enable' && predictions?.selection === before
      ? predictions.counts[badge]
      : undefined;

  beginStep({
    badge,
    action,
    source,
    combination: combinationOf(next),
    ...(predictedCount === undefined ? {} : { predictedCount }),
  });
}

/**
 * A step only. The summary predates this event and is read across the deploy,
 * so what it counts does not change: clear-all was never a toggle there.
 */
export function recordClearAll(): void {
  beginStep({ badge: '', action: 'clear_all', source: 'none', combination: '' });
}

/**
 * The candidate counts for `selection`, or nulls when there are none that can
 * be trusted. Written by the step hook whenever the counts are known to belong
 * to the live selection, read by `recordToggle` at click time.
 */
export function notePredictions(
  selection: string | null,
  counts: Record<BadgeKey, number> | null
): void {
  predictions = selection !== null && counts !== null ? { selection, counts } : null;
}

/** Attaches the resolved list to the pending step. Returns it, or null when none was pending. */
export function resolvePendingStep(count: number, searchActive: boolean): FilterStep | null {
  if (!pending) return null;
  const step: FilterStep = { ...pending, result: { count, searchActive } };
  pending = null;
  finalize(step);
  return step;
}

/** The page is going away: the pending step leaves unresolved. */
export function abandonPendingStep(): void {
  if (!pending) return;
  finalize(pending);
  pending = null;
}

/** Steps ready to send, in order. Each step is handed out once. */
export function drainFilterSteps(): FilterStep[] {
  const ready = outbox;
  outbox = [];
  return ready;
}

/** True the first time `kind` is claimed in this filtering session. */
export function claimAnomaly(kind: FilterAnomalyKind): boolean {
  if (state.anomalies.has(kind)) return false;
  state.anomalies.add(kind);
  return true;
}

export function recordEmptyResult(): void {
  touch();
  // `touched` too, and that is the invariant rather than a precaution: a reader
  // who reaches a provably empty combination is the finding this event exists
  // for, and it must be worth a row on its own evidence. It happened to be safe
  // without this only because the effect that calls it sits after the arrival
  // effect in one component — an ordering, not a guarantee.
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

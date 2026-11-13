import type { BadgeKey } from '@/core/types';
import type { FilterAnomalyKind } from '@/lib/stats/constants';
import {
  abandonPendingStep,
  claimAnomaly,
  drainFilterSteps,
  type FilterStep,
  notePredictions,
  recordArrival,
  resolvePendingStep,
  resultKeyOf,
} from '@/lib/stats/filter-session';
import { filterTelemetry } from '@/lib/stats/filter-step-events';
import { flushEvents } from '@/lib/stats/queue';
import { readArrivalSource } from './useFilterFromUrl';
import { useEffect, useRef } from 'react';

export interface UseFilterStepsOptions {
  filters: Set<BadgeKey>;
  query: string;
  hasLoadedData: boolean;
  isFiltering: boolean;
  /** `useAccountFiltering`: which selection and query the rendered list is for. */
  resultKey: string | null;
  /** `useAccountFiltering`: the rendered list came from a failed filter. */
  resultFailed: boolean;
  displayCount: number;
  totalCount: number;
  /** All-time per-badge counts: the stat cards. `{}` until loaded. */
  filterCounts: Partial<Record<BadgeKey, number>>;
  candidateCounts: Record<BadgeKey, number> | null;
  candidateCountsFor: string | null;
  appliedUrlFilter?: BadgeKey | null;
  /** The ROUTER's search string. See `AccountListSection` for why not `window.location`. */
  search: string;
}

interface Anomaly {
  kind: FilterAnomalyKind;
  expected?: number;
  actual: number;
}

/**
 * What disagrees about a step that has just resolved.
 *
 * Every check is a measurement that can also be NOT TAKEN, and a measurement
 * not taken sends nothing: no search may be narrowing the list (the counts
 * ignore the query), the card counts must have loaded (`{}` until then), and a
 * prediction must exist (enable only, against the selection it was made for).
 * Equality is strict by design (`plans/2026-11-13-filter-analytics` §5.2–5.3).
 */
function anomaliesOf(
  step: FilterStep,
  result: NonNullable<FilterStep['result']>,
  failed: boolean,
  filters: Set<BadgeKey>,
  filterCounts: Partial<Record<BadgeKey, number>>
): Anomaly[] {
  const actual = result.count;
  // The catch rendered the whole list under the filter's label. That is its own
  // kind, and it is the only thing to say about this step: comparing a failure's
  // list against the card would report the failure twice, as a set mismatch.
  if (failed) return [{ kind: 'filter_failed', actual }];
  if (result.searchActive) return [];

  const found: Anomaly[] = [];
  if (step.predictedCount !== undefined && step.predictedCount !== actual) {
    found.push({ kind: 'predicted_mismatch', expected: step.predictedCount, actual });
  }
  const [only] = filters;
  const card = filters.size === 1 && only ? filterCounts[only] : undefined;
  if (card !== undefined && card !== actual) {
    found.push({ kind: 'card_vs_list', expected: card, actual });
  }
  return found;
}

function sendSteps(totalCount: number): number {
  const steps = drainFilterSteps();
  for (const step of steps) filterTelemetry.step(step, totalCount);
  return steps.length;
}

/**
 * `filter_step` and `filter_anomaly` for the results page.
 *
 * A hook of its own rather than more of `AccountListSection`, which sits at
 * ESLint's `complexity` ceiling. The step STATE is module state in
 * `filter-session.ts`, because the toggles happen in two components; this hook
 * owns only the moments: arrival, resolution, and leaving.
 */
export function useFilterSteps({
  filters,
  query,
  hasLoadedData,
  isFiltering,
  resultKey,
  resultFailed,
  displayCount,
  totalCount,
  filterCounts,
  candidateCounts,
  candidateCountsFor,
  appliedUrlFilter,
  search,
}: UseFilterStepsOptions): void {
  const totalRef = useRef(totalCount);
  totalRef.current = totalCount;

  // What the reader arrived with, before they did anything. Recorded once:
  // 52.3% of sessions arrive with a filter already on, and some arrive with one
  // we chose for them.
  //
  // The count comes from the APPLIER, not from the store and not from the URL.
  // Not the store, because `useFilterFromUrl` runs in the page and this effect
  // runs in a child: React flushes child effects first, so `filters` here would
  // still be yesterday's persisted selection on exactly the arrivals this
  // measures. Not the URL, because a URL states what was ASKED FOR: `/sample`
  // applies no `?filter=`, and reading it there reported a filter nobody applied
  // and bought a summary row for a visit in which nothing happened.
  //
  // A valid `?filter=` REPLACES the persisted set, so it is exactly one filter.
  //
  // Declared before the resolution effect on purpose: in the commit that loads
  // the data, step 0 must exist by the time resolution looks for it.
  const arrivalRecorded = useRef(false);
  useEffect(() => {
    if (arrivalRecorded.current || !hasLoadedData) return;
    arrivalRecorded.current = true;

    const arrived = appliedUrlFilter ? [appliedUrlFilter] : [...filters];
    const via = appliedUrlFilter ? 'url' : arrived.length > 0 ? 'persisted' : 'none';
    recordArrival(arrived, readArrivalSource(search), via);
  }, [hasLoadedData, filters, search, appliedUrlFilter]);

  // Read by `recordToggle` at click time, which checks that these counts were
  // computed for the selection the reader was looking at when they clicked.
  useEffect(() => {
    notePredictions(candidateCountsFor, candidateCounts);
  }, [candidateCountsFor, candidateCounts]);
  useEffect(() => () => notePredictions(null, null), []);

  // A step resolves when the list on screen is the list for what is selected
  // now. `!isFiltering` alone is not that: it lags `setFilters` by a render, and
  // in that render the previous selection's list is still on screen.
  useEffect(() => {
    const current = hasLoadedData && !isFiltering && resultKey === resultKeyOf(filters, query);
    const step = current ? resolvePendingStep(displayCount, query.trim() !== '') : null;

    if (step?.result) {
      for (const anomaly of anomaliesOf(step, step.result, resultFailed, filters, filterCounts)) {
        if (claimAnomaly(anomaly.kind)) filterTelemetry.anomaly({ ...anomaly, step }, totalCount);
      }
    }
    sendSteps(totalCount);
  }, [
    hasLoadedData,
    isFiltering,
    resultKey,
    resultFailed,
    filters,
    query,
    displayCount,
    totalCount,
    filterCounts,
  ]);

  // Leaving. `Layout` flushes the queue on the same two events, but it
  // subscribed when the app mounted, long before this page did, so its listener
  // runs FIRST and would flush before this step is queued. Flushing here as well
  // makes the order irrelevant.
  useEffect(() => {
    const leave = () => {
      abandonPendingStep();
      if (sendSteps(totalRef.current) > 0) flushEvents();
    };
    const onVisibility = () => {
      if (document.hidden) leave();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', leave);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', leave);
      // Navigation within the app: `Layout` flushes on the route change.
      abandonPendingStep();
      sendSteps(totalRef.current);
    };
  }, []);
}

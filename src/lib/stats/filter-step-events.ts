import { AnalyticsEvents } from './constants';
import type { FilterAnomalyKind } from './constants';
import type { FilterStep } from './filter-session';
import { enqueueEvent } from './queue';

/**
 * `filter_step` and `filter_anomaly` emitters.
 *
 * Deliberately NOT on the `analytics` object in `events.ts`: that object is in
 * the entry chunk, which is held to a byte budget (`perf:budget`), and these two
 * are only ever called from the results route. On `analytics` they cost the
 * entry 100 bytes over budget for code no other route runs.
 *
 * An object rather than two bare exports so a test can spy on it.
 */
export const filterTelemetry = {
  /**
   * One row per action on the filter surface, plus step 0 at arrival.
   * Unsampled and batched; `useFilterSteps` flushes on the way out itself.
   *
   * An unresolved step carries `resolved: false` and NO `result_count` or
   * `search_active`: it was overtaken, or the page left, before its list
   * resolved. Absent, never zero (`plans/2026-11-13-filter-analytics` §5.1).
   */
  step: (step: FilterStep, totalCount: number) => {
    enqueueEvent(AnalyticsEvents.FILTER_STEP, {
      filter_session_id: step.sessionId,
      step: step.step,
      badge: step.badge,
      action: step.action,
      source: step.source,
      combination: step.combination,
      total_count: totalCount,
      resolved: step.result !== undefined,
      ...(step.result && {
        result_count: step.result.count,
        search_active: step.result.searchActive,
      }),
      ...(step.predictedCount !== undefined && { predicted_count: step.predictedCount }),
    });
  },

  /**
   * Two computations of one set disagreed, or the filter threw. Strict
   * equality is the invariant; see the plan's §5.2 before widening anything.
   */
  anomaly: (
    anomaly: { kind: FilterAnomalyKind; step: FilterStep; expected?: number; actual: number },
    totalCount: number
  ) => {
    enqueueEvent(AnalyticsEvents.FILTER_ANOMALY, {
      kind: anomaly.kind,
      filter_session_id: anomaly.step.sessionId,
      step: anomaly.step.step,
      combination: anomaly.step.combination,
      ...(anomaly.expected !== undefined && { expected: anomaly.expected }),
      actual: anomaly.actual,
      total_count: totalCount,
    });
  },
};

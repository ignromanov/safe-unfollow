import { AnalyticsEvents } from './constants';
import { trackBeacon } from './core';

/**
 * `results_clicks_summary`, the profile-visit count of one /results visit.
 *
 * Not on the `analytics` object in `events.ts`, for the reason
 * `filter-step-events.ts` gives: that object is in the byte-budgeted entry
 * chunk, and only the results route calls this.
 *
 * Cumulative and superseding, like `filter_session_summary`: the caller
 * re-sends it whenever the click count moved, so a row with a higher `seq`
 * contains everything the lower ones did. Read the highest `seq` per
 * `filter_session_id`. Rows before 2026-11 carry neither field and are one
 * row per visit holding only the clicks made before the first trigger past
 * the five-second floor (`analytics/measurement-boundaries.md`).
 *
 * On `trackBeacon` because it is sent while the page is going away.
 */
export const resultsTelemetry = {
  clicksSummary: (
    stats: { totalClicks: number; badgeClicks: Record<string, number>; timeSpentSeconds: number },
    visitId: string,
    seq: number
  ) => {
    // Every badge clicked, most-clicked first. Eleven badge keys bound it.
    const all = Object.fromEntries(Object.entries(stats.badgeClicks).sort(([, a], [, b]) => b - a));

    trackBeacon(AnalyticsEvents.RESULTS_CLICKS_SUMMARY, {
      filter_session_id: visitId,
      seq,
      total_clicks: stats.totalClicks,
      badge_clicks: JSON.stringify(all),
      time_spent: Math.round(stats.timeSpentSeconds),
    });
  },
};

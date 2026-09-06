/**
 * Umami Analytics Utility (V10)
 *
 * Privacy-first analytics with file content hash for session correlation.
 * Uses the same hash as IndexedDB cache for consistency.
 * No personal data (usernames, file names) is ever tracked.
 *
 * V10 changes (storage optimization — Neon DB load reduction ~70%):
 * - Removed page_view for non-UTM sessions (Umami built-in handles pageviews)
 * - Removed session_duration (Umami tracks natively)
 * - Removed rescue_plan_impression (kept only tool_click) — reinstated since;
 *   see events.ts for its current delivery path
 * - Removed results_scroll_depth (engagement inferred from time_on_results)
 * - Removed wizard_back_click, wizard_cancel (low actionability)
 * - `filterToggle` ended entirely: `filter_session_summary` replaces 9.48 rows
 *   per session with one. The two entries below name it as history, not as a
 *   live emitter.
 * - Tightened sampling: wizardStepView 5%, filterToggle 3%, searchPerform 5%, webVital 3%
 *   (wizardStepView — now guideSectionView — filterToggle, searchPerform and
 *   guideEntryView (deleted; GuideEntry dissolved in PR-1 of the wizard-popup
 *   series) were unsampled again on 2026-08-21 — GH#123; webVital keeps its
 *   3%. Every one of those four series steps by 20x or 33x on that deploy
 *   date)
 * - Added 25% sampling to resultsClicksSummary
 * - Simplified payloads: removed file_hash from upload events, removed processing_time_ms
 */

export { isTrackingOptedOut, optOutOfTracking, optIntoTracking, trackBeacon } from './core';
export { AnalyticsEvents } from './constants';
export type { AnalyticsEventName, DiagnosticErrorCode, ParseOutcome } from './constants';
export { captureUTMParams, setEntryCTA } from './utm';
export { analytics } from './events';

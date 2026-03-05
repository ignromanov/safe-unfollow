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
 * - Removed rescue_plan_impression (kept only tool_click)
 * - Removed results_scroll_depth (engagement inferred from time_on_results)
 * - Removed wizard_back_click, wizard_cancel (low actionability)
 * - Tightened sampling: wizardStepView 5%, filterToggle 3%, searchPerform 5%, webVital 3%
 * - Added 25% sampling to resultsClicksSummary
 * - Simplified payloads: removed file_hash from upload events, removed processing_time_ms
 */

export { isTrackingOptedOut, optOutOfTracking, optIntoTracking, trackBeacon } from './core';
export { AnalyticsEvents } from './constants';
export type { AnalyticsEventName, DiagnosticErrorCode } from './constants';
export { captureUTMParams, setEntryCTA } from './utm';
export { analytics } from './events';

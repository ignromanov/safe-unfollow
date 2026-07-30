/**
 * Analytics constants, types, and Umami global interface.
 */

// Umami global interface
declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: Record<string, string | number | boolean>) => void;
    };
  }
}

// localStorage key for tracking opt-out preference
export const TRACKING_OPT_OUT_KEY = 'umami-opt-out';

// Event name constants
// V10: Removed SESSION_DURATION (Umami native),
//      RESULTS_SCROLL_DEPTH (inferred from time_on_results),
//      WIZARD_BACK_CLICK/CANCEL (low actionability)
export const AnalyticsEvents = {
  // File Upload
  FILE_UPLOAD_START: 'file_upload_start',
  FILE_UPLOAD_SUCCESS: 'file_upload_success',
  UPLOAD_PARSE_DURATION: 'upload_parse_duration',

  // Filters
  FILTER_TOGGLE: 'filter_toggle',
  FILTER_CLEAR_ALL: 'filter_clear_all',

  // Search
  SEARCH_PERFORM: 'search_perform',

  // Account interactions (aggregated summary only)
  RESULTS_CLICKS_SUMMARY: 'results_clicks_summary',

  // Links
  LINK_CLICK: 'link_click',

  // Hero CTAs
  HERO_CTA_GUIDE: 'hero_cta_guide',
  HERO_CTA_SAMPLE: 'hero_cta_sample',
  HERO_CTA_UPLOAD_DIRECT: 'hero_cta_upload_direct',
  HERO_CTA_CONTINUE: 'hero_cta_continue',

  // Navigation
  THEME_TOGGLE: 'theme_toggle',
  CLEAR_DATA: 'clear_data',
  SAMPLE_DATA_LOAD: 'sample_data_load',
  LANGUAGE_CHANGE: 'language_change',

  // Wizard (V10: 5% sampling, removed back_click and cancel)
  WIZARD_STEP_VIEW: 'wizard_step_view',

  // Funnel / Page Views (V10: first-in-session UTM attribution only)
  PAGE_VIEW: 'page_view',

  // Upload Zone
  UPLOAD_CLICK: 'upload_click',

  // Loading Tips (shown during ZIP parsing)
  LOADING_TIP_IMPRESSION: 'loading_tip_impression',
  LOADING_TIP_CLICK: 'loading_tip_click',

  // Diagnostic Errors
  DIAGNOSTIC_ERROR_VIEW: 'diagnostic_error_view',
  DIAGNOSTIC_ERROR_RETRY: 'diagnostic_error_retry',
  DIAGNOSTIC_ERROR_HELP: 'diagnostic_error_help',
  DIAGNOSTIC_ERROR_REPORT_ISSUE: 'diagnostic_error_report_issue',
  DIAGNOSTIC_ERROR_COPY_DETAILS: 'diagnostic_error_copy_details',

  // Granular Upload Errors
  UPLOAD_ERROR_NOT_ZIP: 'upload_error_not_zip',
  UPLOAD_ERROR_HTML_FORMAT: 'upload_error_html_format',
  UPLOAD_ERROR_NOT_INSTAGRAM: 'upload_error_not_instagram',
  UPLOAD_ERROR_INCOMPLETE: 'upload_error_incomplete',
  UPLOAD_ERROR_NO_DATA: 'upload_error_no_data',
  UPLOAD_ERROR_MISSING_FOLLOWING: 'upload_error_missing_following',
  UPLOAD_ERROR_MISSING_FOLLOWERS: 'upload_error_missing_followers',
  UPLOAD_ERROR_UNKNOWN: 'upload_error_unknown',

  // Extended Upload Errors
  UPLOAD_ERROR_CORRUPTED_ZIP: 'upload_error_corrupted_zip',
  UPLOAD_ERROR_ZIP_ENCRYPTED: 'upload_error_zip_encrypted',
  UPLOAD_ERROR_EMPTY_FILE: 'upload_error_empty_file',
  UPLOAD_ERROR_FILE_TOO_LARGE: 'upload_error_file_too_large',
  UPLOAD_ERROR_JSON_PARSE: 'upload_error_json_parse',
  UPLOAD_ERROR_INVALID_STRUCTURE: 'upload_error_invalid_structure',
  UPLOAD_ERROR_TIMEOUT: 'upload_error_timeout',
  UPLOAD_ERROR_WORKER_INIT: 'upload_error_worker_init',
  UPLOAD_ERROR_WORKER_CRASHED: 'upload_error_worker_crashed',
  UPLOAD_ERROR_INDEXEDDB: 'upload_error_indexeddb',
  UPLOAD_ERROR_QUOTA: 'upload_error_quota',
  UPLOAD_ERROR_IDB_NOT_SUPPORTED: 'upload_error_idb_not_supported',
  UPLOAD_ERROR_IDB_PERMISSION: 'upload_error_idb_permission',
  UPLOAD_ERROR_CANCELLED: 'upload_error_cancelled',
  UPLOAD_ERROR_CRYPTO: 'upload_error_crypto',
  UPLOAD_ERROR_NETWORK: 'upload_error_network',

  // Session & Engagement (V10: removed SESSION_DURATION)
  TIME_ON_RESULTS: 'time_on_results',
  RETURN_UPLOAD: 'return_upload',

  // FAQ
  FAQ_EXPAND: 'faq_expand',

  // Donation Card
  DONATION_CARD_IMPRESSION: 'donation_card_impression',
  DONATION_CARD_CLICK: 'donation_card_click',
  DONATION_CARD_DISMISS: 'donation_card_dismiss',

  // Rescue Plan
  RESCUE_PLAN_IMPRESSION: 'rescue_plan_impression',
  RESCUE_PLAN_TOOL_CLICK: 'rescue_plan_tool_click',
  RESCUE_PLAN_DISMISS: 'rescue_plan_dismiss',

  // Format Quiz
  FORMAT_QUIZ_ANSWER: 'format_quiz_answer',
  FORMAT_QUIZ_FIXED_IT: 'format_quiz_fixed_it',

  // Error tracking
  ERROR_BOUNDARY: 'error_boundary',
  ROUTE_ERROR: 'route_error',

  // Web Vitals (V10: 3% sampling)
  WEB_VITAL: 'web_vital',

  // PWA
  PWA_INSTALL_PROMPT: 'pwa_install_prompt',
  PWA_INSTALLED: 'pwa_installed',

  // Ads
  AD_SLOT_RENDERED: 'ad_slot_rendered',
  // A viewable impression opportunity by the MRC display standard (50% of
  // pixels for 1 continuous second). Deliberately NOT a redefinition of
  // `ad_slot_rendered`: that one fires on mount and counts slots nobody
  // scrolled to, so merging the two under one name would corrupt every trend
  // line drawn across the change.
  AD_SLOT_VIEWABLE: 'ad_slot_viewable',
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

export type LinkType =
  | 'github'
  | 'docs'
  | 'docs-troubleshooting'
  | 'docs-accessibility'
  | 'license'
  | 'meta_accounts'
  | 'privacy-policy'
  | 'terms-of-service'
  | 'buy-me-coffee';

export type FilterAction = 'enable' | 'disable';

/** How the processing state ended. Fast errors must not look like fast parses. */
export type ParseOutcome = 'success' | 'cached' | 'error' | 'cancelled';

/** Upper bound (exclusive, ms) → label. Ascending; last entry is the overflow. */
const PARSE_DURATION_BUCKETS: readonly (readonly [number, string])[] = [
  [1_000, '<1s'],
  [3_000, '1-3s'],
  [5_000, '3-5s'],
  [10_000, '5-10s'],
  [Infinity, '10s+'],
];

/**
 * Bucket a processing duration for `upload_parse_duration`.
 *
 * Bucketed on purpose: V10 dropped the raw `processing_time_ms` because
 * per-event millisecond values were not actionable in the dashboard. The
 * question this answers is a distribution one — how many users are still
 * watching the loading state at N seconds — which is what sizes the audience
 * for anything rendered there (see `config/loading-tips.ts`).
 */
export function parseDurationBucket(durationMs: number): string {
  const match = PARSE_DURATION_BUCKETS.find(([upperBound]) => durationMs < upperBound);
  // The Infinity entry makes this exhaustive for any finite input.
  return match ? match[1] : '10s+';
}

// Re-export DiagnosticErrorCode from core/types to ensure consistency
export type { DiagnosticErrorCode } from '@/core/types';

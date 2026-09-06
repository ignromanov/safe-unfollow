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
  // The one control at the end of the guide. Instrumented before GH#102 moves
  // it: its reach was measured (83.4% of step-2 sessions), its usefulness never
  // was, so a move with no "before" would be unarguable either way.
  CALENDAR_REMINDER_CLICK: 'calendar_reminder_click',

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

  // The gesture that opened the guide dialog. See analytics.guideOpen for the
  // payload contract and why it is not a success metric.
  GUIDE_OPEN: 'guide_open',

  // A section of the guide entering the viewport inside one scroll. Renamed
  // from WIZARD_STEP_VIEW (GH#102 PR-3 collapsed the eight wizard routes into
  // one dialog) — see analytics.guideSectionView for why a new name rather
  // than a `variant` field.
  GUIDE_SECTION_VIEW: 'guide_section_view',

  // Funnel / Page Views (V10: first-in-session UTM attribution only)
  PAGE_VIEW: 'page_view',

  // Upload Zone
  UPLOAD_CLICK: 'upload_click',

  // An intent-page CTA click (task 6). Its own name rather than a payload on
  // UPLOAD_CLICK: that event has run unpayloaded since it shipped, and giving it
  // one now would split its own history into a before and an after for one new
  // question.
  INTENT_CTA_CLICK: 'intent_cta_click',

  // Loading Tips (shown during ZIP parsing)
  LOADING_TIP_IMPRESSION: 'loading_tip_impression',

  // Affiliate block on /upload. Click only: the block renders unconditionally,
  // so /upload pageviews already are the impression count.
  AFFILIATE_BLOCK_CLICK: 'affiliate_block_click',

  // Pro Export
  //
  // The trigger sits below the fold, so /results pageviews are not its
  // denominator — this event is. Emitted from the same MRC dwell gate the ad
  // slots use, never on mount.
  EXPORT_TRIGGER_VIEWABLE: 'export_trigger_viewable',
  EXPORT_CLICK: 'export_click',
  // The capped file the locked click hands over. Separate from DOWNLOAD, which
  // stays the paid artefact: mixing them would destroy the purchase count.
  FREE_EXPORT_DOWNLOAD: 'free_export_download',
  PAYWALL_VIEW: 'paywall_view',
  // Closed via the X button, Escape, or an overlay click — the reader saw the
  // offer and chose to keep using the tool instead of buying. Distinguishes
  // "offer is wrong" (this) from "moment is wrong" (leaving the page with the
  // paywall still open, which this does not capture).
  PAYWALL_DISMISS: 'paywall_dismiss',
  CHECKOUT_START: 'checkout_start',
  PURCHASE_SUCCESS: 'purchase_success',
  DOWNLOAD: 'download',
  EXPORT_ERROR: 'export_error',
  LICENSE_RESTORED: 'license_restored',
  LICENSE_ERROR: 'license_error',
  LICENSE_REVOKED: 'license_revoked',

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
  // GH#21: following.json/followers_*.json found, but shape unrecognized —
  // distinct from MISSING_* (file absent) and from a silent empty result.
  UPLOAD_ERROR_INVALID_FOLLOWING_FORMAT: 'upload_error_invalid_following_format',
  UPLOAD_ERROR_INVALID_FOLLOWERS_FORMAT: 'upload_error_invalid_followers_format',
  UPLOAD_ERROR_UNKNOWN: 'upload_error_unknown',

  // Extended Upload Errors
  UPLOAD_ERROR_CORRUPTED_ZIP: 'upload_error_corrupted_zip',
  UPLOAD_ERROR_TOO_MANY_ENTRIES: 'upload_error_too_many_entries',
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

  // Feedback prompt on /results (100% sampled — see events.ts for why).
  // No `feedback_submit`: submission happens inside Tally's iframe with no
  // callback, so completion is read from Tally's own dashboard instead.
  FEEDBACK_PROMPT_VIEWABLE: 'feedback_prompt_viewable',
  FEEDBACK_PROMPT_CLICK: 'feedback_prompt_click',

  // Error tracking
  ERROR_BOUNDARY: 'error_boundary',
  ROUTE_ERROR: 'route_error',

  // Web Vitals (V10: 3% sampling)
  WEB_VITAL: 'web_vital',

  // PWA
  PWA_INSTALL_PROMPT: 'pwa_install_prompt',
  PWA_INSTALLED: 'pwa_installed',

  // Ads — a viewable impression opportunity by the MRC display standard (50%
  // of pixels for 1 continuous second).
  AD_SLOT_VIEWABLE: 'ad_slot_viewable',

  // GH#21: an OPTIONAL relationship file (pending, restricted, close_friends,
  // recently_unfollowed, dismissed_suggestions, permanent requests) was found
  // but its shape didn't match anything known. Severity 'warning' on the
  // parser side isn't rendered anywhere in the UI, so this is the only signal
  // that reaches the dashboard when Instagram drifts one of these formats.
  // Rare/diagnostic, not high-volume — delivered immediately (trackEvent),
  // not batched like impressions.
  OPTIONAL_FILE_FORMAT_DRIFT: 'optional_file_format_drift',

  // GH#21 Task 5: how the localised username label was resolved for this
  // parse (LabelResolutionMode in core/types/upload.ts). One field, fires
  // once per parse, always — including a clean parse, unlike the drift event
  // above. ALARM: a rise in `unresolved` across many uploads at once, in the
  // same window as a rise in the entry-level drift codes above, is Instagram
  // having changed the record shape again. One archive reporting
  // `not-applicable` (it carries none of the six optional files) is not.
  USERNAME_LABEL_RESOLUTION: 'username_label_resolution',

  // Which required relationship file arrived short because a date range was
  // chosen in Meta's export dialog (TruncatedRelationshipFile in
  // core/types/upload.ts). Fires only when one did, so it has no denominator of
  // its own: divide by `username_label_resolution`, which fires once per parse
  // whatever the outcome. Dividing by `file_upload_success` would understate it,
  // because a truncated export still succeeds — that is the entire defect.
  // ALARM: any sustained rate at all. Every event here is a reader who was told
  // that people unfollowed them when the export simply never mentioned those
  // people.
  RELATIONSHIP_FILE_TRUNCATED: 'relationship_file_truncated',

  // The skew detector's verdict for this parse, whatever it concluded
  // (RelationshipSkew in core/types/upload.ts). Fires once per parse, always —
  // the shape of `username_label_resolution` above, not of the event beside it.
  //
  // Added 2026-08-25 for a failure the event above structurally cannot report.
  // The detector abstains when fewer than MIN_TIMESTAMPS_FOR_SKEW records carry
  // a usable timestamp, and that abstention shared a `null` with a clean
  // verdict all the way down to `useFileUpload`'s truthiness gate — so an
  // export nobody could judge emitted nothing at all and left no row to count
  // later. The rate was not unmeasured; it was unmeasurable after the fact.
  //
  // It also gives `relationship_file_truncated` the denominator its own comment
  // says it lacks. Both events are kept rather than one widened: the truncation
  // series has run since 2026-08-19 and reads 425 of 1 139 sessions, and
  // folding it into this one would put a deploy boundary through the middle of
  // the only number we have about the defect.
  //
  // ALARM: any sustained `insufficient-data` rate. Unlike a truncation, it does
  // not mean the answer is wrong — it means nothing checked whether it was.
  RELATIONSHIP_SKEW_VERDICT: 'relationship_skew_verdict',
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

/**
 * Which surface performed the toggle. Required at every call site: the stat
 * cards mutated the same filter set as the chips and emitted nothing, so a
 * default value here is how that blind spot returns.
 */
export type FilterSource = 'chip' | 'stat_card';

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

/**
 * Umami Analytics Utility
 *
 * Privacy-first analytics with file content hash for session correlation.
 * Uses the same hash as IndexedDB cache for consistency.
 * No personal data (usernames, file names) is ever tracked.
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
const TRACKING_OPT_OUT_KEY = 'umami-opt-out';

/**
 * Check if user has opted out of tracking
 */
export function isTrackingOptedOut(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(TRACKING_OPT_OUT_KEY) === 'true';
}

/**
 * Opt out of tracking - Umami script will not load
 */
export function optOutOfTracking(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TRACKING_OPT_OUT_KEY, 'true');
  // Remove existing umami instance if present
  delete window.umami;
}

/**
 * Opt back into tracking
 */
export function optIntoTracking(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TRACKING_OPT_OUT_KEY);
  // Reload page to load Umami script
  window.location.reload();
}

// Event name constants
export const AnalyticsEvents = {
  // File Upload
  FILE_UPLOAD_START: 'file_upload_start',
  FILE_UPLOAD_SUCCESS: 'file_upload_success',
  FILE_UPLOAD_ERROR: 'file_upload_error',

  // Filters
  FILTER_TOGGLE: 'filter_toggle',
  FILTER_CLEAR_ALL: 'filter_clear_all',

  // Search
  SEARCH_PERFORM: 'search_perform',

  // Account interactions (V7: optimized with sampling)
  PROFILE_CLICK: 'profile_click',
  RESULTS_CLICKS_SUMMARY: 'results_clicks_summary',

  // Help
  HELP_OPEN: 'help_open',

  // Links
  LINK_CLICK: 'link_click',

  // V2: Hero CTAs
  HERO_CTA_GUIDE: 'hero_cta_guide',
  HERO_CTA_SAMPLE: 'hero_cta_sample',
  HERO_CTA_UPLOAD_DIRECT: 'hero_cta_upload_direct',
  HERO_CTA_CONTINUE: 'hero_cta_continue',

  // V2: Navigation
  THEME_TOGGLE: 'theme_toggle',
  CLEAR_DATA: 'clear_data',
  SAMPLE_DATA_CLICK: 'sample_data_click',
  SAMPLE_DATA_LOAD: 'sample_data_load',
  LANGUAGE_CHANGE: 'language_change',

  // V2: Wizard (V8: removed WIZARD_NEXT_CLICK, WIZARD_EXTERNAL_LINK_CLICK as duplicates)
  WIZARD_STEP_VIEW: 'wizard_step_view',
  WIZARD_BACK_CLICK: 'wizard_back_click',
  WIZARD_CANCEL: 'wizard_cancel',

  // V3: Funnel / Page Views
  PAGE_VIEW: 'page_view',

  // V3: Upload Zone (V8: removed UPLOAD_DRAG_ENTER, UPLOAD_DRAG_LEAVE as low-value)
  UPLOAD_DROP: 'upload_drop',
  UPLOAD_CLICK: 'upload_click',

  // V3: Diagnostic Errors
  DIAGNOSTIC_ERROR_VIEW: 'diagnostic_error_view',
  DIAGNOSTIC_ERROR_RETRY: 'diagnostic_error_retry',
  DIAGNOSTIC_ERROR_HELP: 'diagnostic_error_help',
  DIAGNOSTIC_ERROR_REPORT_ISSUE: 'diagnostic_error_report_issue',
  DIAGNOSTIC_ERROR_COPY_DETAILS: 'diagnostic_error_copy_details',

  // V5: Granular Upload Errors
  UPLOAD_ERROR_NOT_ZIP: 'upload_error_not_zip',
  UPLOAD_ERROR_HTML_FORMAT: 'upload_error_html_format',
  UPLOAD_ERROR_NOT_INSTAGRAM: 'upload_error_not_instagram',
  UPLOAD_ERROR_INCOMPLETE: 'upload_error_incomplete',
  UPLOAD_ERROR_NO_DATA: 'upload_error_no_data',
  UPLOAD_ERROR_MISSING_FOLLOWING: 'upload_error_missing_following',
  UPLOAD_ERROR_MISSING_FOLLOWERS: 'upload_error_missing_followers',
  UPLOAD_ERROR_UNKNOWN: 'upload_error_unknown',

  // V6: Extended Upload Errors
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

  // V5: Session & Engagement
  TIME_ON_RESULTS: 'time_on_results',
  SESSION_DURATION: 'session_duration',
  RETURN_UPLOAD: 'return_upload',

  // V5: Mobile-specific (V8: removed FILE_PICKER_OPEN as duplicate of UPLOAD_CLICK)
  FILE_PICKER_CANCEL: 'file_picker_cancel',

  // V3: FAQ
  FAQ_EXPAND: 'faq_expand',

  // V3: Results Engagement
  RESULTS_SCROLL_DEPTH: 'results_scroll_depth',

  // V4: Rescue Plan Monetization (V8: removed RESCUE_PLAN_HOVER as micro-interaction)
  RESCUE_PLAN_IMPRESSION: 'rescue_plan_impression',
  RESCUE_PLAN_TOOL_CLICK: 'rescue_plan_tool_click',
  RESCUE_PLAN_DISMISS: 'rescue_plan_dismiss',
  RESCUE_PLAN_VIEW_TIME: 'rescue_plan_view_time',
  RESCUE_PLAN_RE_ENGAGEMENT: 'rescue_plan_re_engagement',
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

type LinkType =
  | 'github'
  | 'docs'
  | 'docs-troubleshooting'
  | 'docs-accessibility'
  | 'license'
  | 'meta_accounts'
  | 'privacy-policy'
  | 'terms-of-service'
  | 'buy-me-coffee';
type HelpSource = 'header' | 'upload_section';
type FilterAction = 'enable' | 'disable';
type PageName = 'hero' | 'wizard' | 'upload' | 'results' | 'sample' | 'privacy' | 'terms' | '404';
type ScrollDepth = 25 | 50 | 75 | 100;

// Re-export DiagnosticErrorCode from core/types to ensure consistency
export type { DiagnosticErrorCode } from '@/core/types';

/**
 * Track event with Umami
 * Safe to call even if Umami hasn't loaded
 * Disabled in development mode or if user opted out
 */
function trackEvent(
  eventName: AnalyticsEventName,
  eventData?: Record<string, string | number | boolean>
): void {
  // Skip analytics in development or if opted out
  if (import.meta.env.DEV || isTrackingOptedOut()) {
    return;
  }

  try {
    if (typeof window !== 'undefined' && window.umami) {
      window.umami.track(eventName, eventData);
    }
  } catch {
    // Silently fail - analytics should never break the app
  }
}

/**
 * Analytics helper object with typed methods
 */
export const analytics = {
  // File Upload events
  fileUploadStart: (fileHash: string, fileSizeMb: number) => {
    trackEvent(AnalyticsEvents.FILE_UPLOAD_START, {
      file_hash: fileHash,
      file_size_mb: Math.round(fileSizeMb * 100) / 100,
    });
  },

  fileUploadSuccess: (
    fileHash: string,
    accountCount: number,
    processingTimeMs: number,
    fromCache: boolean
  ) => {
    trackEvent(AnalyticsEvents.FILE_UPLOAD_SUCCESS, {
      file_hash: fileHash,
      account_count: accountCount,
      processing_time_ms: Math.round(processingTimeMs),
      from_cache: fromCache,
    });
  },

  fileUploadError: (fileHash: string, errorMessage: string) => {
    trackEvent(AnalyticsEvents.FILE_UPLOAD_ERROR, {
      file_hash: fileHash,
      error_message: errorMessage.slice(0, 200), // Limit length
    });
  },

  // Filter events (V8: 25% sampling to reduce quota usage)
  filterToggle: (filterName: string, action: FilterAction, activeCount: number) => {
    if (Math.random() > 0.25) return;
    trackEvent(AnalyticsEvents.FILTER_TOGGLE, {
      filter_name: filterName,
      filter_action: action,
      active_filter_count: activeCount,
    });
  },

  filterClearAll: (previousCount: number) => {
    trackEvent(AnalyticsEvents.FILTER_CLEAR_ALL, {
      previous_count: previousCount,
    });
  },

  // Search events
  searchPerform: (
    queryLength: number,
    resultCount: number,
    totalCount: number,
    hasFiltersActive: boolean
  ) => {
    trackEvent(AnalyticsEvents.SEARCH_PERFORM, {
      query_length: queryLength,
      result_count: resultCount,
      total_count: totalCount,
      has_filters_active: hasFiltersActive,
    });
  },

  // V7: Profile click with sampling (replaces accountClick + externalProfileClick)
  // Only 10% of clicks are tracked to reduce Umami quota usage
  profileClick: (badges: string[]) => {
    // Sampling: track only 10% of clicks
    if (Math.random() > 0.1) return;

    trackEvent(AnalyticsEvents.PROFILE_CLICK, {
      badge_types: badges.join(','),
      badge_count: badges.length,
    });
  },

  // V7: Aggregated click summary sent on page leave
  resultsClicksSummary: (stats: {
    totalClicks: number;
    badgeClicks: Record<string, number>;
    timeSpentSeconds: number;
  }) => {
    trackEvent(AnalyticsEvents.RESULTS_CLICKS_SUMMARY, {
      total_clicks: stats.totalClicks,
      badge_clicks: JSON.stringify(stats.badgeClicks),
      time_spent: Math.round(stats.timeSpentSeconds),
    });
  },

  // Help modal
  helpOpen: (source: HelpSource) => {
    trackEvent(AnalyticsEvents.HELP_OPEN, {
      source,
    });
  },

  // External links
  linkClick: (linkType: LinkType) => {
    trackEvent(AnalyticsEvents.LINK_CLICK, {
      link_type: linkType,
    });
  },

  // V2: Hero CTAs
  heroCTAGuide: () => {
    trackEvent(AnalyticsEvents.HERO_CTA_GUIDE);
  },

  heroCTASample: () => {
    trackEvent(AnalyticsEvents.HERO_CTA_SAMPLE);
  },

  heroCTAUploadDirect: () => {
    trackEvent(AnalyticsEvents.HERO_CTA_UPLOAD_DIRECT);
  },

  heroCTAContinue: () => {
    trackEvent(AnalyticsEvents.HERO_CTA_CONTINUE);
  },

  // V2: Navigation
  themeToggle: (mode: 'dark' | 'light' | 'system') => {
    trackEvent(AnalyticsEvents.THEME_TOGGLE, { mode });
  },

  clearData: () => {
    trackEvent(AnalyticsEvents.CLEAR_DATA);
  },

  sampleDataClick: () => {
    trackEvent(AnalyticsEvents.SAMPLE_DATA_CLICK);
  },

  languageChange: (language: string) => {
    trackEvent(AnalyticsEvents.LANGUAGE_CHANGE, { language });
  },

  // V2: Wizard events (V8: 50% sampling, removed wizardNextClick/wizardExternalLinkClick as duplicates)
  wizardStepView: (stepId: number, stepTitle: string) => {
    if (Math.random() > 0.5) return;
    trackEvent(AnalyticsEvents.WIZARD_STEP_VIEW, {
      step_id: stepId,
      step_title: stepTitle,
    });
  },

  wizardBackClick: (fromStep: number) => {
    trackEvent(AnalyticsEvents.WIZARD_BACK_CLICK, { from_step: fromStep });
  },

  wizardCancel: () => {
    trackEvent(AnalyticsEvents.WIZARD_CANCEL);
  },

  // V3: Funnel / Page Views
  pageView: (page: PageName, language?: string) => {
    trackEvent(AnalyticsEvents.PAGE_VIEW, {
      page,
      ...(language && { language }),
    });
  },

  // V3: Upload Zone (V8: removed uploadDragEnter/uploadDragLeave as low-value)
  uploadDrop: () => {
    trackEvent(AnalyticsEvents.UPLOAD_DROP);
  },

  uploadClick: () => {
    trackEvent(AnalyticsEvents.UPLOAD_CLICK);
  },

  // V3: Diagnostic Errors
  diagnosticErrorView: (code: string, source?: string) => {
    trackEvent(AnalyticsEvents.DIAGNOSTIC_ERROR_VIEW, {
      error_code: code,
      ...(source && { source }),
    });
  },

  diagnosticErrorRetry: (code: string) => {
    trackEvent(AnalyticsEvents.DIAGNOSTIC_ERROR_RETRY, {
      error_code: code,
    });
  },

  diagnosticErrorHelp: (code: string) => {
    trackEvent(AnalyticsEvents.DIAGNOSTIC_ERROR_HELP, {
      error_code: code,
    });
  },

  diagnosticErrorReportIssue: (code: string) => {
    trackEvent(AnalyticsEvents.DIAGNOSTIC_ERROR_REPORT_ISSUE, {
      error_code: code,
    });
  },

  diagnosticErrorCopyDetails: (code: string) => {
    trackEvent(AnalyticsEvents.DIAGNOSTIC_ERROR_COPY_DETAILS, {
      error_code: code,
    });
  },

  // V3: FAQ
  faqExpand: (questionId: number, questionText: string) => {
    trackEvent(AnalyticsEvents.FAQ_EXPAND, {
      question_id: questionId,
      question_text: questionText.slice(0, 100), // Limit length
    });
  },

  // V3: Results Engagement (V8: 25% sampling to reduce quota usage)
  resultsScrollDepth: (depth: ScrollDepth, totalAccounts: number) => {
    if (Math.random() > 0.25) return;
    trackEvent(AnalyticsEvents.RESULTS_SCROLL_DEPTH, {
      depth,
      total_accounts: totalAccounts,
    });
  },

  // V3: Sample Data Load
  sampleDataLoad: (accountCount: number, loadTimeMs: number) => {
    trackEvent(AnalyticsEvents.SAMPLE_DATA_LOAD, {
      account_count: accountCount,
      load_time_ms: Math.round(loadTimeMs),
    });
  },

  // V4: Rescue Plan Monetization
  rescuePlanImpression: (severity: string, size: string, unfollowedPercent: number) => {
    trackEvent(AnalyticsEvents.RESCUE_PLAN_IMPRESSION, {
      severity,
      size,
      unfollowed_percent: Math.round(unfollowedPercent),
    });
  },

  rescuePlanToolClick: (toolId: string, severity: string, size: string) => {
    trackEvent(AnalyticsEvents.RESCUE_PLAN_TOOL_CLICK, {
      tool_id: toolId,
      severity,
      size,
    });
  },

  rescuePlanDismiss: (severity: string, size: string, unfollowedPercent: number) => {
    trackEvent(AnalyticsEvents.RESCUE_PLAN_DISMISS, {
      severity,
      size,
      unfollowed_percent: Math.round(unfollowedPercent),
    });
  },

  // V8: removed rescuePlanHover as micro-interaction with low value

  rescuePlanViewTime: (seconds: number, severity: string, size: string) => {
    trackEvent(AnalyticsEvents.RESCUE_PLAN_VIEW_TIME, {
      view_time_seconds: Math.round(seconds),
      severity,
      size,
    });
  },

  rescuePlanReEngagement: (oldSeverity: string, newSeverity: string) => {
    trackEvent(AnalyticsEvents.RESCUE_PLAN_RE_ENGAGEMENT, {
      old_severity: oldSeverity,
      new_severity: newSeverity,
    });
  },

  // Error Boundary (optional tracking)
  errorBoundary: (errorMessage: string, componentStack: string) => {
    // Note: Not in AnalyticsEvents const - optional tracking
    trackEvent('error_boundary' as AnalyticsEventName, {
      error_message: errorMessage.slice(0, 200),
      component_stack: componentStack.slice(0, 500),
    });
  },

  // Route Error (optional tracking)
  routeError: (status: number, message: string) => {
    // Note: Not in AnalyticsEvents const - optional tracking
    trackEvent('route_error' as AnalyticsEventName, {
      status,
      message: message.slice(0, 200),
    });
  },

  // V5: Granular Upload Errors
  uploadErrorByCode: (
    fileHash: string,
    code: import('@/core/types').DiagnosticErrorCode,
    errorMessage?: string
  ) => {
    const eventMap: Record<
      import('@/core/types').DiagnosticErrorCode,
      (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents]
    > = {
      // Existing
      NOT_ZIP: AnalyticsEvents.UPLOAD_ERROR_NOT_ZIP,
      HTML_FORMAT: AnalyticsEvents.UPLOAD_ERROR_HTML_FORMAT,
      NOT_INSTAGRAM_EXPORT: AnalyticsEvents.UPLOAD_ERROR_NOT_INSTAGRAM,
      INCOMPLETE_EXPORT: AnalyticsEvents.UPLOAD_ERROR_INCOMPLETE,
      NO_DATA_FILES: AnalyticsEvents.UPLOAD_ERROR_NO_DATA,
      MISSING_FOLLOWING: AnalyticsEvents.UPLOAD_ERROR_MISSING_FOLLOWING,
      MISSING_FOLLOWERS: AnalyticsEvents.UPLOAD_ERROR_MISSING_FOLLOWERS,
      // New - ZIP/File
      CORRUPTED_ZIP: AnalyticsEvents.UPLOAD_ERROR_CORRUPTED_ZIP,
      ZIP_ENCRYPTED: AnalyticsEvents.UPLOAD_ERROR_ZIP_ENCRYPTED,
      EMPTY_FILE: AnalyticsEvents.UPLOAD_ERROR_EMPTY_FILE,
      FILE_TOO_LARGE: AnalyticsEvents.UPLOAD_ERROR_FILE_TOO_LARGE,
      // New - Parsing
      JSON_PARSE_ERROR: AnalyticsEvents.UPLOAD_ERROR_JSON_PARSE,
      INVALID_DATA_STRUCTURE: AnalyticsEvents.UPLOAD_ERROR_INVALID_STRUCTURE,
      // New - Worker
      WORKER_TIMEOUT: AnalyticsEvents.UPLOAD_ERROR_TIMEOUT,
      WORKER_INIT_ERROR: AnalyticsEvents.UPLOAD_ERROR_WORKER_INIT,
      WORKER_CRASHED: AnalyticsEvents.UPLOAD_ERROR_WORKER_CRASHED,
      // New - Storage
      INDEXEDDB_ERROR: AnalyticsEvents.UPLOAD_ERROR_INDEXEDDB,
      QUOTA_EXCEEDED: AnalyticsEvents.UPLOAD_ERROR_QUOTA,
      IDB_NOT_SUPPORTED: AnalyticsEvents.UPLOAD_ERROR_IDB_NOT_SUPPORTED,
      IDB_PERMISSION_DENIED: AnalyticsEvents.UPLOAD_ERROR_IDB_PERMISSION,
      // New - Other
      UPLOAD_CANCELLED: AnalyticsEvents.UPLOAD_ERROR_CANCELLED,
      CRYPTO_NOT_AVAILABLE: AnalyticsEvents.UPLOAD_ERROR_CRYPTO,
      NETWORK_ERROR: AnalyticsEvents.UPLOAD_ERROR_NETWORK,
      // Fallback
      UNKNOWN: AnalyticsEvents.UPLOAD_ERROR_UNKNOWN,
    };
    trackEvent(eventMap[code], {
      file_hash: fileHash,
      error_message: errorMessage?.slice(0, 100) ?? '',
    });
    // Keep legacy event for backward compatibility
    analytics.fileUploadError(fileHash, `${code}: ${errorMessage ?? ''}`);
  },

  // V5: Session & Engagement
  timeOnResults: (seconds: number, accountCount: number, actionsCount: number) => {
    trackEvent(AnalyticsEvents.TIME_ON_RESULTS, {
      time_seconds: Math.round(seconds),
      account_count: accountCount,
      actions_count: actionsCount,
    });
  },

  sessionDuration: (seconds: number, pagesViewed: number) => {
    trackEvent(AnalyticsEvents.SESSION_DURATION, {
      duration_seconds: Math.round(seconds),
      pages_viewed: pagesViewed,
    });
  },

  returnUpload: (fileHashPrefix: string, daysSinceLastUpload: number) => {
    trackEvent(AnalyticsEvents.RETURN_UPLOAD, {
      file_hash_prefix: fileHashPrefix.slice(0, 8),
      days_since_last: daysSinceLastUpload,
    });
  },

  // V5: Mobile-specific (V8: removed filePickerOpen, added 25% sampling to filePickerCancel)
  filePickerCancel: () => {
    if (Math.random() > 0.25) return;
    trackEvent(AnalyticsEvents.FILE_PICKER_CANCEL);
  },
};

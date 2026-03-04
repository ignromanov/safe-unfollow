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
// V10: Removed SESSION_DURATION (Umami native), RESCUE_PLAN_IMPRESSION (low value),
//      RESULTS_SCROLL_DEPTH (inferred from time_on_results),
//      WIZARD_BACK_CLICK/CANCEL (low actionability)
export const AnalyticsEvents = {
  // File Upload
  FILE_UPLOAD_START: 'file_upload_start',
  FILE_UPLOAD_SUCCESS: 'file_upload_success',

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

  // Rescue Plan (V10: removed impression, kept only tool_click)
  RESCUE_PLAN_TOOL_CLICK: 'rescue_plan_tool_click',

  // Error tracking
  ERROR_BOUNDARY: 'error_boundary',
  ROUTE_ERROR: 'route_error',

  // Web Vitals (V10: 3% sampling)
  WEB_VITAL: 'web_vital',

  // PWA
  PWA_INSTALL_PROMPT: 'pwa_install_prompt',
  PWA_INSTALLED: 'pwa_installed',
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
type FilterAction = 'enable' | 'disable';

// Re-export DiagnosticErrorCode from core/types to ensure consistency
export type { DiagnosticErrorCode } from '@/core/types';

// --- UTM Parameter Tracking ---

const UTM_STORAGE_KEY = 'analytics_utm';
const ENTRY_CTA_KEY = 'analytics_entry_cta';

/**
 * Capture UTM parameters from URL on page load.
 * Store in sessionStorage for enriching events later.
 */
export function captureUTMParams(): void {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};

  for (const key of ['utm_source', 'utm_medium', 'utm_campaign'] as const) {
    const value = params.get(key);
    if (value) utm[key] = value;
  }

  if (Object.keys(utm).length > 0) {
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
  }
}

function getStoredUTM(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Store entry CTA for conversion attribution.
 * Called from Hero CTA handlers.
 */
export function setEntryCTA(cta: string): void {
  if (typeof window === 'undefined') return;
  // Only store the first CTA per session
  if (!sessionStorage.getItem(ENTRY_CTA_KEY)) {
    sessionStorage.setItem(ENTRY_CTA_KEY, cta);
  }
}

function getEntryCTA(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(ENTRY_CTA_KEY);
}

// --- Core tracking ---

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
 * Track event via sendBeacon for reliable delivery on page unload.
 * Falls back to regular trackEvent if sendBeacon is unavailable.
 */
export function trackBeacon(
  eventName: AnalyticsEventName,
  eventData?: Record<string, string | number | boolean>
): void {
  if (import.meta.env.DEV || isTrackingOptedOut()) return;
  if (typeof window === 'undefined') return;

  // Try sendBeacon first for reliability on mobile page unload
  if (navigator.sendBeacon && window.umami) {
    try {
      // Umami's collect endpoint
      const scriptEl = document.querySelector('script[data-website-id]');
      const websiteId = scriptEl?.getAttribute('data-website-id');
      const src = scriptEl?.getAttribute('src');
      if (src && websiteId) {
        const baseUrl = new URL(src).origin;
        navigator.sendBeacon(
          `${baseUrl}/api/send`,
          new Blob(
            [
              JSON.stringify({
                type: 'event',
                payload: {
                  website: websiteId,
                  name: eventName,
                  data: eventData,
                  hostname: window.location.hostname,
                  language: navigator.language,
                  url: window.location.pathname,
                },
              }),
            ],
            { type: 'application/json' }
          )
        );
        return;
      }
    } catch {
      // Fall through to regular tracking
    }
  }

  // Fallback: regular tracking
  trackEvent(eventName, eventData);
}

/**
 * Analytics helper object with typed methods
 */
export const analytics = {
  // File Upload events (V10: removed file_hash — not actionable in dashboard)
  fileUploadStart: (fileSizeMb: number) => {
    trackEvent(AnalyticsEvents.FILE_UPLOAD_START, {
      file_size_mb: Math.round(fileSizeMb * 100) / 100,
    });
  },

  // V10: Simplified — removed file_hash, processing_time_ms. Kept UTM for conversion attribution.
  fileUploadSuccess: (accountCount: number, fromCache: boolean) => {
    const utm = getStoredUTM();
    const entryCta = getEntryCTA();
    trackEvent(AnalyticsEvents.FILE_UPLOAD_SUCCESS, {
      account_count: accountCount,
      from_cache: fromCache,
      ...(utm.utm_source && { utm_source: utm.utm_source }),
      ...(utm.utm_medium && { utm_medium: utm.utm_medium }),
      ...(utm.utm_campaign && { utm_campaign: utm.utm_campaign }),
      ...(entryCta && { entry_cta: entryCta }),
    });
  },

  // Filter events (V10: 3% sampling, was 10%)
  filterToggle: (filterName: string, action: FilterAction, activeCount: number) => {
    if (Math.random() > 0.03) return;
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

  // Search events (V10: 5% sampling, was 25%)
  searchPerform: (
    queryLength: number,
    resultCount: number,
    totalCount: number,
    hasFiltersActive: boolean
  ) => {
    if (Math.random() > 0.05) return;
    trackEvent(AnalyticsEvents.SEARCH_PERFORM, {
      query_length: queryLength,
      result_count: resultCount,
      total_count: totalCount,
      has_filters_active: hasFiltersActive,
    });
  },

  // Aggregated click summary sent on page leave (V10: 25% sampling)
  resultsClicksSummary: (stats: {
    totalClicks: number;
    badgeClicks: Record<string, number>;
    timeSpentSeconds: number;
  }) => {
    if (Math.random() > 0.25) return;
    // Keep only top 3 badges by click count to reduce payload
    const top3 = Object.entries(stats.badgeClicks)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .reduce<Record<string, number>>((acc, [k, v]) => {
        acc[k] = v;
        return acc;
      }, {});

    trackEvent(AnalyticsEvents.RESULTS_CLICKS_SUMMARY, {
      total_clicks: stats.totalClicks,
      badge_clicks: JSON.stringify(top3),
      time_spent: Math.round(stats.timeSpentSeconds),
    });
  },

  // External links
  linkClick: (linkType: LinkType) => {
    trackEvent(AnalyticsEvents.LINK_CLICK, {
      link_type: linkType,
    });
  },

  // Hero CTAs (sets entry CTA for conversion attribution)
  heroCTAGuide: () => {
    setEntryCTA('guide');
    trackEvent(AnalyticsEvents.HERO_CTA_GUIDE);
  },

  heroCTASample: () => {
    setEntryCTA('sample');
    trackEvent(AnalyticsEvents.HERO_CTA_SAMPLE);
  },

  heroCTAUploadDirect: () => {
    setEntryCTA('upload_direct');
    trackEvent(AnalyticsEvents.HERO_CTA_UPLOAD_DIRECT);
  },

  heroCTAContinue: () => {
    setEntryCTA('continue');
    trackEvent(AnalyticsEvents.HERO_CTA_CONTINUE);
  },

  // Navigation
  themeToggle: (mode: 'dark' | 'light' | 'system') => {
    trackEvent(AnalyticsEvents.THEME_TOGGLE, { mode });
  },

  clearData: () => {
    trackEvent(AnalyticsEvents.CLEAR_DATA);
  },

  languageChange: (language: string) => {
    trackEvent(AnalyticsEvents.LANGUAGE_CHANGE, { language });
  },

  // Wizard events (V10: 5% sampling, was 25%)
  wizardStepView: (stepId: number, _stepTitle?: string) => {
    if (Math.random() > 0.05) return;
    trackEvent(AnalyticsEvents.WIZARD_STEP_VIEW, {
      step_id: stepId,
    });
  },

  // Page Views (V10: first-in-session UTM attribution only, Umami built-in handles pageviews)
  pageView: () => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('analytics_first_pv')) return;
    sessionStorage.setItem('analytics_first_pv', '1');

    const utm = getStoredUTM();
    if (!utm.utm_source) return;

    trackEvent(AnalyticsEvents.PAGE_VIEW, {
      utm_source: utm.utm_source,
      ...(utm.utm_medium && { utm_medium: utm.utm_medium }),
      ...(utm.utm_campaign && { utm_campaign: utm.utm_campaign }),
    });
  },

  // Upload Zone
  uploadClick: () => {
    trackEvent(AnalyticsEvents.UPLOAD_CLICK);
  },

  // Diagnostic Errors
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

  // FAQ
  faqExpand: (questionId: number, _questionText?: string) => {
    trackEvent(AnalyticsEvents.FAQ_EXPAND, {
      question_id: questionId,
    });
  },

  // Sample Data Load
  sampleDataLoad: (accountCount: number, loadTimeMs: number) => {
    trackEvent(AnalyticsEvents.SAMPLE_DATA_LOAD, {
      account_count: accountCount,
      load_time_ms: Math.round(loadTimeMs),
    });
  },

  // Donation Card (100% sampling — high-value conversion events)
  donationCardImpression: (accountCount: number) => {
    trackEvent(AnalyticsEvents.DONATION_CARD_IMPRESSION, {
      account_count: accountCount,
    });
  },

  donationCardClick: (accountCount: number) => {
    trackEvent(AnalyticsEvents.DONATION_CARD_CLICK, {
      account_count: accountCount,
    });
  },

  donationCardDismiss: (accountCount: number) => {
    trackEvent(AnalyticsEvents.DONATION_CARD_DISMISS, {
      account_count: accountCount,
    });
  },

  // Rescue Plan (V10: removed impression, kept only tool_click)
  rescuePlanToolClick: (toolId: string, severity: string, size: string) => {
    trackEvent(AnalyticsEvents.RESCUE_PLAN_TOOL_CLICK, {
      tool_id: toolId,
      severity,
      size,
    });
  },

  // Error Boundary
  errorBoundary: (errorMessage: string, componentStack: string) => {
    trackEvent(AnalyticsEvents.ERROR_BOUNDARY, {
      error_message: errorMessage.slice(0, 200),
      component_stack: componentStack.slice(0, 500),
    });
  },

  // Route Error
  routeError: (status: number, message: string) => {
    trackEvent(AnalyticsEvents.ROUTE_ERROR, {
      status,
      message: message.slice(0, 200),
    });
  },

  // Granular Upload Errors
  uploadErrorByCode: (
    fileHash: string,
    code: import('@/core/types').DiagnosticErrorCode,
    errorMessage?: string
  ) => {
    const eventMap: Record<
      import('@/core/types').DiagnosticErrorCode,
      (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents]
    > = {
      NOT_ZIP: AnalyticsEvents.UPLOAD_ERROR_NOT_ZIP,
      HTML_FORMAT: AnalyticsEvents.UPLOAD_ERROR_HTML_FORMAT,
      NOT_INSTAGRAM_EXPORT: AnalyticsEvents.UPLOAD_ERROR_NOT_INSTAGRAM,
      INCOMPLETE_EXPORT: AnalyticsEvents.UPLOAD_ERROR_INCOMPLETE,
      NO_DATA_FILES: AnalyticsEvents.UPLOAD_ERROR_NO_DATA,
      MISSING_FOLLOWING: AnalyticsEvents.UPLOAD_ERROR_MISSING_FOLLOWING,
      MISSING_FOLLOWERS: AnalyticsEvents.UPLOAD_ERROR_MISSING_FOLLOWERS,
      CORRUPTED_ZIP: AnalyticsEvents.UPLOAD_ERROR_CORRUPTED_ZIP,
      ZIP_ENCRYPTED: AnalyticsEvents.UPLOAD_ERROR_ZIP_ENCRYPTED,
      EMPTY_FILE: AnalyticsEvents.UPLOAD_ERROR_EMPTY_FILE,
      FILE_TOO_LARGE: AnalyticsEvents.UPLOAD_ERROR_FILE_TOO_LARGE,
      JSON_PARSE_ERROR: AnalyticsEvents.UPLOAD_ERROR_JSON_PARSE,
      INVALID_DATA_STRUCTURE: AnalyticsEvents.UPLOAD_ERROR_INVALID_STRUCTURE,
      WORKER_TIMEOUT: AnalyticsEvents.UPLOAD_ERROR_TIMEOUT,
      WORKER_INIT_ERROR: AnalyticsEvents.UPLOAD_ERROR_WORKER_INIT,
      WORKER_CRASHED: AnalyticsEvents.UPLOAD_ERROR_WORKER_CRASHED,
      INDEXEDDB_ERROR: AnalyticsEvents.UPLOAD_ERROR_INDEXEDDB,
      QUOTA_EXCEEDED: AnalyticsEvents.UPLOAD_ERROR_QUOTA,
      IDB_NOT_SUPPORTED: AnalyticsEvents.UPLOAD_ERROR_IDB_NOT_SUPPORTED,
      IDB_PERMISSION_DENIED: AnalyticsEvents.UPLOAD_ERROR_IDB_PERMISSION,
      UPLOAD_CANCELLED: AnalyticsEvents.UPLOAD_ERROR_CANCELLED,
      CRYPTO_NOT_AVAILABLE: AnalyticsEvents.UPLOAD_ERROR_CRYPTO,
      NETWORK_ERROR: AnalyticsEvents.UPLOAD_ERROR_NETWORK,
      UNKNOWN: AnalyticsEvents.UPLOAD_ERROR_UNKNOWN,
    };
    trackEvent(eventMap[code], {
      file_hash: fileHash.slice(0, 12),
      error_message: errorMessage?.slice(0, 50) ?? '',
    });
  },

  // Session & Engagement
  timeOnResults: (seconds: number, accountCount: number, actionsCount: number) => {
    trackEvent(AnalyticsEvents.TIME_ON_RESULTS, {
      time_seconds: Math.round(seconds),
      account_count: accountCount,
      actions_count: actionsCount,
    });
  },

  returnUpload: (fileHashPrefix: string, daysSinceLastUpload: number) => {
    trackEvent(AnalyticsEvents.RETURN_UPLOAD, {
      file_hash_prefix: fileHashPrefix.slice(0, 8),
      days_since_last: daysSinceLastUpload,
    });
  },

  // Web Vitals (V10: 3% sampling, was 10%)
  webVital: (name: string, value: number, rating: string) => {
    if (Math.random() > 0.03) return;
    trackEvent(AnalyticsEvents.WEB_VITAL, {
      metric_name: name,
      metric_value: Math.round(value),
      rating,
    });
  },

  // PWA Install
  pwaInstallPrompt: () => {
    trackEvent(AnalyticsEvents.PWA_INSTALL_PROMPT);
  },

  pwaInstalled: () => {
    trackEvent(AnalyticsEvents.PWA_INSTALLED);
  },
};

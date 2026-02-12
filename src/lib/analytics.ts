/**
 * Umami Analytics Utility (V9)
 *
 * Privacy-first analytics with file content hash for session correlation.
 * Uses the same hash as IndexedDB cache for consistency.
 * No personal data (usernames, file names) is ever tracked.
 *
 * V9 changes:
 * - Removed ~10 redundant/low-value events (storage optimization)
 * - Tightened sampling: filterToggle 10%, wizardStepView 25%, scrollDepth 10%, searchPerform 25%
 * - Reduced payloads: file_hash 12 chars, removed step_title/question_text
 * - Added trackBeacon for reliable mobile delivery
 * - Added UTM capture + conversion attribution
 * - Added error_boundary/route_error to AnalyticsEvents const (type safety)
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
// V9: Removed FILE_UPLOAD_ERROR (legacy duplicate of uploadErrorByCode),
//     PROFILE_CLICK (redundant with RESULTS_CLICKS_SUMMARY),
//     HELP_OPEN (5 opens in 47 days), FILE_PICKER_CANCEL (low signal),
//     RESCUE_PLAN_DISMISS/VIEW_TIME/RE_ENGAGEMENT (micro-engagement),
//     UPLOAD_DROP (duplicate of UPLOAD_CLICK), SAMPLE_DATA_CLICK (keep only SAMPLE_DATA_LOAD)
export const AnalyticsEvents = {
  // File Upload
  FILE_UPLOAD_START: 'file_upload_start',
  FILE_UPLOAD_SUCCESS: 'file_upload_success',

  // Filters
  FILTER_TOGGLE: 'filter_toggle',
  FILTER_CLEAR_ALL: 'filter_clear_all',

  // Search
  SEARCH_PERFORM: 'search_perform',

  // Account interactions (V9: only aggregated summary, removed per-click PROFILE_CLICK)
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

  // Wizard (V9: 25% sampling, removed step_title payload)
  WIZARD_STEP_VIEW: 'wizard_step_view',
  WIZARD_BACK_CLICK: 'wizard_back_click',
  WIZARD_CANCEL: 'wizard_cancel',

  // Funnel / Page Views
  PAGE_VIEW: 'page_view',

  // Upload Zone (V9: removed UPLOAD_DROP as duplicate of UPLOAD_CLICK)
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

  // Session & Engagement
  TIME_ON_RESULTS: 'time_on_results',
  SESSION_DURATION: 'session_duration',
  RETURN_UPLOAD: 'return_upload',

  // FAQ
  FAQ_EXPAND: 'faq_expand',

  // Results Engagement
  RESULTS_SCROLL_DEPTH: 'results_scroll_depth',

  // Rescue Plan (V9: kept only impression + tool_click)
  RESCUE_PLAN_IMPRESSION: 'rescue_plan_impression',
  RESCUE_PLAN_TOOL_CLICK: 'rescue_plan_tool_click',

  // Error tracking (V9: added to const for type safety, was previously cast)
  ERROR_BOUNDARY: 'error_boundary',
  ROUTE_ERROR: 'route_error',

  // Web Vitals (V9: new, 10% sampling)
  WEB_VITAL: 'web_vital',

  // PWA (V9: new)
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
type PageName = 'hero' | 'wizard' | 'upload' | 'results' | 'sample' | 'privacy' | 'terms' | '404';
type ScrollDepth = 25 | 50 | 75 | 100;

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
  // File Upload events (V9: file_hash truncated to 12 chars)
  fileUploadStart: (fileHash: string, fileSizeMb: number) => {
    trackEvent(AnalyticsEvents.FILE_UPLOAD_START, {
      file_hash: fileHash.slice(0, 12),
      file_size_mb: Math.round(fileSizeMb * 100) / 100,
    });
  },

  fileUploadSuccess: (
    fileHash: string,
    accountCount: number,
    processingTimeMs: number,
    fromCache: boolean
  ) => {
    const utm = getStoredUTM();
    const entryCta = getEntryCTA();
    trackEvent(AnalyticsEvents.FILE_UPLOAD_SUCCESS, {
      file_hash: fileHash.slice(0, 12),
      account_count: accountCount,
      processing_time_ms: Math.round(processingTimeMs),
      from_cache: fromCache,
      ...(utm.utm_source && { utm_source: utm.utm_source }),
      ...(utm.utm_medium && { utm_medium: utm.utm_medium }),
      ...(utm.utm_campaign && { utm_campaign: utm.utm_campaign }),
      ...(entryCta && { entry_cta: entryCta }),
    });
  },

  // V9: fileUploadError removed — uploadErrorByCode fires granular events

  // Filter events (V9: 10% sampling, was 25%)
  filterToggle: (filterName: string, action: FilterAction, activeCount: number) => {
    if (Math.random() > 0.1) return;
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

  // Search events (V9: 25% sampling, was 100%)
  searchPerform: (
    queryLength: number,
    resultCount: number,
    totalCount: number,
    hasFiltersActive: boolean
  ) => {
    if (Math.random() > 0.25) return;
    trackEvent(AnalyticsEvents.SEARCH_PERFORM, {
      query_length: queryLength,
      result_count: resultCount,
      total_count: totalCount,
      has_filters_active: hasFiltersActive,
    });
  },

  // V9: profileClick removed — resultsClicksSummary captures same data in aggregate

  // Aggregated click summary sent on page leave (V9: top 3 badges only)
  resultsClicksSummary: (stats: {
    totalClicks: number;
    badgeClicks: Record<string, number>;
    timeSpentSeconds: number;
  }) => {
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

  // Hero CTAs (V9: also sets entry CTA for conversion attribution)
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

  // V9: sampleDataClick removed — keep only sampleDataLoad (actual conversion)

  languageChange: (language: string) => {
    trackEvent(AnalyticsEvents.LANGUAGE_CHANGE, { language });
  },

  // Wizard events (V9: 25% sampling was 50%, removed step_title payload)
  wizardStepView: (stepId: number, _stepTitle?: string) => {
    if (Math.random() > 0.25) return;
    trackEvent(AnalyticsEvents.WIZARD_STEP_VIEW, {
      step_id: stepId,
    });
  },

  wizardBackClick: (fromStep: number) => {
    trackEvent(AnalyticsEvents.WIZARD_BACK_CLICK, { from_step: fromStep });
  },

  wizardCancel: () => {
    trackEvent(AnalyticsEvents.WIZARD_CANCEL);
  },

  // Page Views (V9: enriched with UTM + device context on first per session)
  pageView: (page: PageName, language?: string) => {
    const utm = getStoredUTM();
    const isFirstView =
      typeof window !== 'undefined' && !sessionStorage.getItem('analytics_first_pv');

    const data: Record<string, string | number | boolean> = {
      page,
      ...(language && { language }),
      ...(utm.utm_source && { utm_source: utm.utm_source }),
      ...(utm.utm_medium && { utm_medium: utm.utm_medium }),
      ...(utm.utm_campaign && { utm_campaign: utm.utm_campaign }),
    };

    // B8: Add device context on first page_view only
    if (isFirstView && typeof window !== 'undefined') {
      sessionStorage.setItem('analytics_first_pv', '1');
      const w = window.innerWidth;
      const viewport = w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
      data.viewport = viewport;
      data.is_pwa = window.matchMedia('(display-mode: standalone)').matches;
    }

    trackEvent(AnalyticsEvents.PAGE_VIEW, data);
  },

  // Upload Zone (V9: removed uploadDrop as duplicate of uploadClick)
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

  // FAQ (V9: removed question_text payload, question_id is sufficient)
  faqExpand: (questionId: number, _questionText?: string) => {
    trackEvent(AnalyticsEvents.FAQ_EXPAND, {
      question_id: questionId,
    });
  },

  // Results Engagement (V9: 10% sampling, was 25%)
  resultsScrollDepth: (depth: ScrollDepth, totalAccounts: number) => {
    if (Math.random() > 0.1) return;
    trackEvent(AnalyticsEvents.RESULTS_SCROLL_DEPTH, {
      depth,
      total_accounts: totalAccounts,
    });
  },

  // Sample Data Load
  sampleDataLoad: (accountCount: number, loadTimeMs: number) => {
    trackEvent(AnalyticsEvents.SAMPLE_DATA_LOAD, {
      account_count: accountCount,
      load_time_ms: Math.round(loadTimeMs),
    });
  },

  // Rescue Plan (V9: kept only impression + tool_click, removed dismiss/viewTime/reEngagement)
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

  // Error Boundary (V9: proper type, no more cast)
  errorBoundary: (errorMessage: string, componentStack: string) => {
    trackEvent(AnalyticsEvents.ERROR_BOUNDARY, {
      error_message: errorMessage.slice(0, 200),
      component_stack: componentStack.slice(0, 500),
    });
  },

  // Route Error (V9: proper type, no more cast)
  routeError: (status: number, message: string) => {
    trackEvent(AnalyticsEvents.ROUTE_ERROR, {
      status,
      message: message.slice(0, 200),
    });
  },

  // Granular Upload Errors (V9: removed legacy fileUploadError call, shorter payloads)
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

  // Web Vitals (V9: new, 10% sampling)
  webVital: (name: string, value: number, rating: string) => {
    if (Math.random() > 0.1) return;
    trackEvent(AnalyticsEvents.WEB_VITAL, {
      metric_name: name,
      metric_value: Math.round(value),
      rating,
    });
  },

  // PWA Install (V9: new)
  pwaInstallPrompt: () => {
    trackEvent(AnalyticsEvents.PWA_INSTALL_PROMPT);
  },

  pwaInstalled: () => {
    trackEvent(AnalyticsEvents.PWA_INSTALLED);
  },
};

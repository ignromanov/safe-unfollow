/**
 * Analytics helper object with typed methods for all tracked events.
 */

import { AnalyticsEvents, parseDurationBucket } from './constants';
import type { FilterAction, LinkType, ParseOutcome } from './constants';
import { trackEvent } from './core';
import { enqueueEvent } from './queue';
import { getStoredUTM, getEntryCTA, setEntryCTA } from './utm';
import type { LabelResolutionMode } from '@/core/types';
import type { LicenseFailureReason } from '@/lib/export/license';

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

  /**
   * How long the user sat in the processing state, bucketed, plus how it ended.
   *
   * Not a performance metric — it is the denominator for anything shown during
   * parsing (`config/loading-tips.ts`). Without it a dead placement and an
   * unappealing one look identical in the dashboard.
   */
  uploadParseDuration: (durationMs: number, outcome: ParseOutcome) => {
    trackEvent(AnalyticsEvents.UPLOAD_PARSE_DURATION, {
      duration_bucket: parseDurationBucket(durationMs),
      outcome,
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

  /**
   * Aggregated click summary sent on page leave.
   *
   * Unsampled here on purpose. `useTimeOnResults` is the only caller and it
   * already rolls once per visit, before any of its three triggers fire. A
   * second roll compounded to 6.25%, far too thin to segment `badge_clicks` by
   * badge — which is the only reason that field is in the payload at all.
   */
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

  // Loading Tips (shown during ZIP parsing)
  // Impressions are batched: three of these land inside the first second of a
  // parse, and one invocation for the set is as good as three.
  loadingTipImpression: (tipId: string, index: number, delayMs: number) => {
    enqueueEvent(AnalyticsEvents.LOADING_TIP_IMPRESSION, {
      tip_id: tipId,
      tip_index: index,
      delay_ms: delayMs,
    });
  },

  // Affiliate block on /upload
  affiliateBlockClick: (offerId: string) => {
    trackEvent(AnalyticsEvents.AFFILIATE_BLOCK_CLICK, {
      offer_id: offerId,
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
    enqueueEvent(AnalyticsEvents.DONATION_CARD_IMPRESSION, {
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

  // Rescue Plan (100% sampling — high-value conversion events)
  rescuePlanImpression: (
    severity: string,
    size: string,
    accountCount: number,
    unfollowedPercent: number
  ) => {
    enqueueEvent(AnalyticsEvents.RESCUE_PLAN_IMPRESSION, {
      severity,
      size,
      segment: `${severity}_${size}`,
      account_count: accountCount,
      unfollowed_percent: Math.round(unfollowedPercent * 10) / 10,
    });
  },

  rescuePlanToolClick: (
    toolId: string,
    position: number,
    severity: string,
    size: string,
    accountCount: number
  ) => {
    trackEvent(AnalyticsEvents.RESCUE_PLAN_TOOL_CLICK, {
      tool_id: toolId,
      position,
      severity,
      size,
      segment: `${severity}_${size}`,
      account_count: accountCount,
    });
  },

  rescuePlanDismiss: (severity: string, size: string, accountCount: number) => {
    trackEvent(AnalyticsEvents.RESCUE_PLAN_DISMISS, {
      severity,
      size,
      segment: `${severity}_${size}`,
      account_count: accountCount,
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
      INVALID_FOLLOWING_FORMAT: AnalyticsEvents.UPLOAD_ERROR_INVALID_FOLLOWING_FORMAT,
      INVALID_FOLLOWERS_FORMAT: AnalyticsEvents.UPLOAD_ERROR_INVALID_FOLLOWERS_FORMAT,
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

  // Ads — one viewable impression opportunity, by the MRC display standard.
  // Fires from the dwell gate in AdSlot, never on mount.
  adSlotViewable: (slot: string) => {
    enqueueEvent(AnalyticsEvents.AD_SLOT_VIEWABLE, {
      slot,
    });
  },

  // GH#21: fires once per optional relationship file whose shape drifted
  // (pending/restricted/close_friends/unfollowed/dismissed/permanent — see
  // instagram-file-specs.ts driftCode). Immediate, not batched: this is a
  // rare diagnostic signal about an upstream format change, not a high-volume
  // impression where losing a few events to a dropped batch is acceptable.
  optionalFileFormatDrift: (fileCode: string) => {
    trackEvent(AnalyticsEvents.OPTIONAL_FILE_FORMAT_DRIFT, {
      file_code: fileCode,
    });
  },

  // GH#21 Task 5: fires once per parse, always — unlike the drift event
  // above, a clean parse still emits this, as `fast-path`. Never the
  // resolved label string: it is Meta's UI text in the export's own
  // language, not the site's, and would leak that language. The mode alone
  // carries what the diagnosis needs. Immediate for the same reason as
  // `optionalFileFormatDrift`: a rare diagnostic about an upstream format
  // change, not a high-volume impression.
  usernameLabelResolution: (mode: LabelResolutionMode) => {
    trackEvent(AnalyticsEvents.USERNAME_LABEL_RESOLUTION, { mode });
  },

  // Pro Export
  //
  // Batched like the ad impressions it shares a gate with: an impression is
  // worth counting, not worth a serverless call each. Carries the unlock state
  // because a returning purchaser sees this trigger every visit and will never
  // buy again — leaving them in the denominator understates the real CTR.
  exportTriggerViewable: (isUnlocked: boolean) => {
    enqueueEvent(AnalyticsEvents.EXPORT_TRIGGER_VIEWABLE, { is_unlocked: isUnlocked });
  },

  exportClick: (isUnlocked: boolean) => {
    trackEvent(AnalyticsEvents.EXPORT_CLICK, { is_unlocked: isUnlocked });
  },

  // `capped` is the number that says whether the free tier is doing its job or
  // eating it: false means the reader's whole view fitted inside the allowance
  // and no paywall was shown, because there was nothing left to sell.
  freeExportDownload: (capped: boolean) => {
    trackEvent(AnalyticsEvents.FREE_EXPORT_DOWNLOAD, { capped });
  },

  paywallView: () => {
    trackEvent(AnalyticsEvents.PAYWALL_VIEW);
  },

  // Fires only for the three Radix-driven closes (X, Escape, overlay click) —
  // not for checkout (navigates away without touching the dialog's open
  // state) or manual key entry (closes the paywall by calling setState
  // directly, bypassing this handler). Both of those already have their own
  // event, and double-counting them here would corrupt the one ratio this
  // event exists to produce.
  paywallDismiss: () => {
    trackEvent(AnalyticsEvents.PAYWALL_DISMISS);
  },

  checkoutStart: () => {
    trackEvent(AnalyticsEvents.CHECKOUT_START);
  },

  purchaseSuccess: () => {
    trackEvent(AnalyticsEvents.PURCHASE_SUCCESS);
  },

  download: (format: 'csv' | 'json', rowCount: number) => {
    trackEvent(AnalyticsEvents.DOWNLOAD, { format, row_count: rowCount });
  },

  exportError: (format: 'csv' | 'json') => {
    trackEvent(AnalyticsEvents.EXPORT_ERROR, { format });
  },

  // A license activated by hand on a second device, rather than via checkout.
  licenseRestored: () => {
    trackEvent(AnalyticsEvents.LICENSE_RESTORED);
  },

  // Reason only — never the key, and never the customer PII the API returns.
  licenseError: (reason: LicenseFailureReason) => {
    trackEvent(AnalyticsEvents.LICENSE_ERROR, { reason });
  },

  licenseRevoked: () => {
    trackEvent(AnalyticsEvents.LICENSE_REVOKED);
  },
};

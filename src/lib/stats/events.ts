/**
 * Analytics helper object with typed methods for all tracked events.
 */

import { AnalyticsEvents, parseDurationBucket } from './constants';
import type { FilterAction, FilterSource, LinkType, ParseOutcome } from './constants';
import { trackEvent } from './core';
import { enqueueEvent, flushEvents, trackNavigating } from './queue';
import { getStoredUTM, getEntryCTA } from './utm';
import type { GuideSource } from '@/hooks/useGuideDialog';
import type { LabelResolutionMode, RelationshipFormat, RelationshipSkew } from '@/core/types';
import type { LicenseFailureReason } from '@/lib/export/license';

/**
 * True the first time this key is seen in this browser tab, false afterwards.
 *
 * The name says "tab" because `sessionStorage` is scoped to one tab and dies
 * with it, while Umami's `session_id` is scoped to a visitor and can span
 * days. The two disagree in the same direction every time: two tabs, or a
 * reopen an hour later, give two `true` rows against one Umami session. A
 * property called `first_view` would read as "first view this session" —
 * false against the only notion of session the dashboard has.
 *
 * `guideSectionView` is the caller, keyed per section per tab. The guide is
 * now one scroll rather than eight routes, so this is what tells "scrolled
 * past" from "read": scrolling up and back down re-enters a section and would
 * otherwise count it as read a second time. Mechanism follows the
 * `analytics_first_pv` precedent below (`pageView`).
 *
 * Unsampled since GH#123, so nothing currently stands between this call and
 * the enqueue. If a gate is ever reintroduced it goes *after* this call, never
 * before: the flag describes the reader's history ("has this section been
 * seen before"), not whether the view got reported. Writing the marker behind
 * a gate would make `first_view_in_tab: true` mean "the first view that
 * happened to be sampled" — expected true-count per session becomes
 * `1 - (1-rate)^n`, which is n-dependent.
 */
function firstViewInTab(key: string): boolean {
  if (typeof window === 'undefined') return false;
  const storageKey = `analytics_first_in_tab_${key}`;
  // The getter itself throws SecurityError under Safari's "Block all cookies"
  // and Firefox's "Block cookies and site data", and the one caller
  // (guideSectionView) runs inside GuideDialog's `[open, activeStep]` effect
  // — an unguarded throw takes the screen down to report a view. Degrading to
  // "not first view" under-reports instead, which is the same trade
  // `getStoredUTM` makes for the identical call (utm.ts).
  try {
    if (sessionStorage.getItem(storageKey)) return false;
    sessionStorage.setItem(storageKey, '1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Round a file size to two decimal places for the `file_size_mb` analytics
 * property. Shared so `file_upload_start` and `upload_error_*` report the
 * same file at the same precision.
 */
function roundMb(sizeMb: number): number {
  return Math.round(sizeMb * 100) / 100;
}

/**
 * The export's shape (GH#156), same alphabet `FileDiscovery.format` uses.
 *
 * Optional and omitted rather than defaulted on every caller: PR #152 pooled
 * an HTML markup drift with a JSON schema drift into the same error series
 * with no way to tell which population moved. A fact about the export's
 * shape is admissible on the same line `relationshipFileTruncated` and
 * `usernameLabelResolution` already draw — never a value read from the
 * archive's bytes.
 */
type ExportFormat = RelationshipFormat | 'unknown';

/**
 * Analytics helper object with typed methods
 */
export const analytics = {
  // File Upload events (V10: removed file_hash — not actionable in dashboard)
  //
  // The whole upload funnel is batched, and it moves as one unit on purpose:
  // `file_upload_success` is divided by `file_upload_start`, and every
  // `upload_error_<code>` is reported against that same denominator. Splitting
  // the transports would split the gate — `enqueueEvent` needs only the script
  // tag, `trackEvent` needs the script to have executed — and the 70.5% success
  // rate would divide two populations. Nothing here unloads the page, and where
  // an attempt's events are lost they are lost together, which leaves the ratio
  // unbiased; losing a success while its start survived would understate it.
  fileUploadStart: (fileSizeMb: number) => {
    enqueueEvent(AnalyticsEvents.FILE_UPLOAD_START, {
      file_size_mb: roundMb(fileSizeMb),
    });
  },

  // V10: Simplified — removed file_hash, processing_time_ms. Kept UTM for conversion attribution.
  //
  // `format` (GH#156) is undefined on the cache-hit path by design — nothing was
  // parsed this call, so the export's shape was not observed by it, and sending
  // 'unknown' there would read as a measurement rather than the omission it is.
  // `mixedRelationshipFormats` (GH#160) is omitted on the same path and for the
  // same reason as `format`, and it is spread on `=== undefined` rather than on
  // truthiness for a reason the boolean makes sharper than `format` ever could:
  // the whole point of the field is the rate `mixed / observed`, so `false` is
  // the denominator and must travel. Dropped when falsy, absence would mean
  // both "clean archive" and "never looked", which is not a rate.
  fileUploadSuccess: (
    accountCount: number,
    fromCache: boolean,
    format?: ExportFormat,
    mixedRelationshipFormats?: boolean
  ) => {
    const utm = getStoredUTM();
    const entryCta = getEntryCTA();
    enqueueEvent(AnalyticsEvents.FILE_UPLOAD_SUCCESS, {
      account_count: accountCount,
      from_cache: fromCache,
      ...(format === undefined ? {} : { format }),
      ...(mixedRelationshipFormats === undefined
        ? {}
        : { mixed_relationship_formats: mixedRelationshipFormats }),
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
    enqueueEvent(AnalyticsEvents.UPLOAD_PARSE_DURATION, {
      duration_bucket: parseDurationBucket(durationMs),
      outcome,
    });
  },

  // Filter events — unsampled since GH#123; read as an absolute count, and
  // sampling serves ratios over large N rather than counts.
  filterToggle: (
    filterName: string,
    action: FilterAction,
    activeCount: number,
    source: FilterSource
  ) => {
    enqueueEvent(AnalyticsEvents.FILTER_TOGGLE, {
      filter_name: filterName,
      filter_action: action,
      active_filter_count: activeCount,
      filter_source: source,
    });
  },

  filterClearAll: (previousCount: number) => {
    enqueueEvent(AnalyticsEvents.FILTER_CLEAR_ALL, {
      previous_count: previousCount,
    });
  },

  // Search events — unsampled since GH#123, see filterToggle.
  searchPerform: (
    queryLength: number,
    resultCount: number,
    totalCount: number,
    hasFiltersActive: boolean
  ) => {
    enqueueEvent(AnalyticsEvents.SEARCH_PERFORM, {
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

  // trackEvent-class, not enqueueEvent: the handler calls window.open, which
  // unloads nothing in this tab, so there is no navigation racing the beacon.
  // No payload — the control has one call site per surface and the surface is
  // recoverable from url_path.
  calendarReminderClick: () => {
    trackEvent(AnalyticsEvents.CALENDAR_REMINDER_CLICK);
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

  // Navigation
  themeToggle: (mode: 'dark' | 'light' | 'system') => {
    enqueueEvent(AnalyticsEvents.THEME_TOGGLE, { mode });
  },

  clearData: () => {
    trackEvent(AnalyticsEvents.CLEAR_DATA);
  },

  // Same-tab navigation: LanguageSwitcher does a full reload to fetch the new
  // locale's SSG HTML. Same defect as checkoutStart — see queue.ts.
  languageChange: (language: string) => {
    trackNavigating(AnalyticsEvents.LANGUAGE_CHANGE, { language });
  },

  /**
   * The gesture that opened the guide dialog, plus the section it landed on
   * (`step_id`, omitted when none was named). Fires exactly once per opening —
   * from `GuideDialog`, on the transition from closed to open — never from
   * repeated section changes within one opening.
   *
   * `source` has to be a payload key rather than something derived after the
   * fact: locale is recoverable from `website_event.url_path` today
   * (`/id/wizard/step/6`), but every guide view now sits on `url_path =
   * '/upload'`, and nothing in that path says which of the four gestures
   * opened it. `url_query` still carries `?step=N` as a cross-check, but not
   * the gesture itself.
   *
   * Unsampled, like its neighbour below, since GH#123.
   *
   * ⛔ NOT a success metric. The guide used to be a full screen between the
   * reader and the drop zone; it is now one click away from a block that
   * already renders on `/upload`. This count will be a fraction of the old
   * `guide_entry_view`, and substituting one for the other is a LARGER
   * discontinuity than the wizard_step_view → guide_section_view rename
   * below — never report it as "guide opens grew".
   */
  guideOpen: (source: GuideSource, step?: number) => {
    enqueueEvent(AnalyticsEvents.GUIDE_OPEN, {
      source,
      ...(step === undefined ? {} : { step_id: step }),
    });
  },

  /**
   * A section of the guide entering the viewport, inside the one scroll the
   * dialog now is.
   *
   * A NEW NAME rather than a `variant` on the old wizard_step_view: a variant
   * field would leave step_id:1 meaning two different screens depending on
   * the date, and every historical query silently wrong. Same precedent
   * guide_entry_view was chosen under, when GuideEntry replaced wizard step 1
   * — that event is deleted (GuideEntry dissolved when the wizard became a
   * dialog) and nothing replaces it; guide_open above stands where it stood,
   * counting a different population.
   *
   * `firstViewInTab`'s key changed with the rename, from `wizard_step_` to
   * `guide_section_`: the old key is already written into a returning
   * reader's `sessionStorage`, and reusing it would make their first section
   * view in a fresh tab report `false`.
   *
   * NOT comparable across the rename: the old event measured navigation
   * between eight routes, where 1→2→1→2 was a real detour that back
   * navigation could reintroduce. Under one scroll there is no back
   * navigation — scrolling up and back down simply re-enters a section, which
   * `first_view_in_tab` still tells from "read for the first time".
   */
  guideSectionView: (stepId: number) => {
    const isFirstView = firstViewInTab(`guide_section_${stepId}`);
    enqueueEvent(AnalyticsEvents.GUIDE_SECTION_VIEW, {
      step_id: stepId,
      first_view_in_tab: isFirstView,
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
    enqueueEvent(AnalyticsEvents.UPLOAD_CLICK);
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
    enqueueEvent(AnalyticsEvents.FAQ_EXPAND, {
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

  // Feedback prompt (/results, 100% sampling — deliberately, not house style).
  // The 3-5% precedents elsewhere in this file exist for high-volume events;
  // at ~7 clicks/month forecast, 5% sampling yields 0.35 events/month and the
  // series would measure nothing. Viewable batches like the ad/export
  // impressions it mirrors; click fires unbatched, before the Tally script
  // injection it precedes, so a failed script fetch still lands in the
  // numerator.
  feedbackPromptViewable: () => {
    enqueueEvent(AnalyticsEvents.FEEDBACK_PROMPT_VIEWABLE);
  },

  feedbackPromptClick: () => {
    trackEvent(AnalyticsEvents.FEEDBACK_PROMPT_CLICK);
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
  // No file hash. A 12-hex digest of the user's own export is stable across
  // sessions and was distinct for 877 of 2 818 error events — enough to link
  // every session that uploaded the same archive, on a product whose one
  // promise is that the export never leaves the browser. Nothing consumed it.
  // The parameter is gone rather than the field, so restoring it cannot be a
  // one-line change inside this function.
  uploadErrorByCode: (
    code: import('@/core/types').DiagnosticErrorCode,
    errorMessage?: string,
    fileSizeMb?: number,
    format?: ExportFormat
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
      TOO_MANY_ENTRIES: AnalyticsEvents.UPLOAD_ERROR_TOO_MANY_ENTRIES,
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
    enqueueEvent(eventMap[code], {
      error_message: errorMessage?.slice(0, 50) ?? '',
      // The size used to reach the database only inside error_message, i18n'd
      // into ten languages and truncated at 50 characters — German writes
      // "1176 MB", Russian "956МБ" in Cyrillic with no space. All 437 records
      // were recoverable by regex over translated prose. That worked once.
      //
      // Spread rather than defaulted: absent and zero must not be the same
      // thing in a column decisions get made from. Rounded the way
      // fileUploadStart rounds it, so two events about one file agree.
      ...(fileSizeMb === undefined ? {} : { file_size_mb: roundMb(fileSizeMb) }),
      // GH#156 — undefined when the failure happened before anything was
      // discovered about the export's shape (e.g. NOT_ZIP, UPLOAD_CANCELLED).
      ...(format === undefined ? {} : { format }),
    });
    // Drained here rather than left to `pagehide`: unlike the success path, a
    // failed upload navigates nowhere, so nothing else would trigger a flush
    // while the visitor stares at the error screen. One request per failure is
    // the price of not stranding the diagnostic the HTML-format work reads.
    flushEvents();
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
  //
  // Batched together: the prompt is the denominator the install is divided by,
  // so both must be gated on the same thing. Neither unloads the page.
  pwaInstallPrompt: () => {
    enqueueEvent(AnalyticsEvents.PWA_INSTALL_PROMPT);
  },

  pwaInstalled: () => {
    enqueueEvent(AnalyticsEvents.PWA_INSTALLED);
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
  optionalFileFormatDrift: (fileCode: string, format?: ExportFormat) => {
    trackEvent(AnalyticsEvents.OPTIONAL_FILE_FORMAT_DRIFT, {
      file_code: fileCode,
      ...(format === undefined ? {} : { format }),
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

  // Fires only when one of the two required relationship files looks cut short,
  // so unlike `usernameLabelResolution` a clean parse emits nothing. Immediate
  // rather than batched for the same reason as its two neighbours: a rare
  // diagnostic about the shape of an upstream export, not a high-volume
  // impression.
  //
  // The field is which of the two lists is short — a fact about the export's
  // shape, never about its contents. Same line the label event draws: no
  // username, no count, nothing derived from the file's bytes.
  relationshipFileTruncated: (file: 'followers' | 'following') => {
    trackEvent(AnalyticsEvents.RELATIONSHIP_FILE_TRUNCATED, { file });
  },

  // The same parse's verdict, including the two quiet ones and the abstention.
  // Fires on every parse, so unlike its neighbour it has a denominator and can
  // give the neighbour one. See the constant for why both exist.
  //
  // The verdict is a fixed four-way enum plus `not-applicable`, not a value
  // derived from the archive's bytes — same line the two events above draw.
  //
  // `datesFitted` (GH#156) separates one cause of `insufficient-data` from the
  // other two: an HTML `following`/`followers` file whose month-name table
  // failed to fit, which is locale-driven, from too few timestamps or rows
  // that never matched the date shape at all. A boolean fact about parse
  // mechanics, never a locale string or anything else derived from the
  // archive's bytes — same line `usernameLabelResolution` draws for the
  // resolved label.
  relationshipSkewVerdict: (
    verdict: RelationshipSkew,
    format?: ExportFormat,
    datesFitted?: boolean
  ) => {
    trackEvent(AnalyticsEvents.RELATIONSHIP_SKEW_VERDICT, {
      verdict,
      ...(format === undefined ? {} : { format }),
      ...(datesFitted === undefined ? {} : { dates_fitted: datesFitted }),
    });
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

  // locale and row_count are the two dimensions the paywall cannot be tuned
  // without: GH#25 (PAYWALL_MIN_ROWS against real selection sizes) and the
  // Indonesian share of the audience. Batched, so this divides the same
  // population as checkout_start — both gate on the analytics tag being in the
  // DOM, where trackEvent gates on the script having executed.
  paywallView: (locale: string, rowCount: number) => {
    enqueueEvent(AnalyticsEvents.PAYWALL_VIEW, { locale, row_count: rowCount });
  },

  // Fires only for the three Radix-driven closes (X, Escape, overlay click) —
  // not for checkout (navigates away without touching the dialog's open
  // state) or manual key entry (closes the paywall by calling setState
  // directly, bypassing this handler). Both of those already have their own
  // event, and double-counting them here would corrupt the one ratio this
  // event exists to produce.
  paywallDismiss: (locale: string, rowCount: number) => {
    enqueueEvent(AnalyticsEvents.PAYWALL_DISMISS, { locale, row_count: rowCount });
  },

  // Same-tab navigation: useProExport sets location.href in the next statement,
  // and window.umami.track() has no keepalive. See queue.ts.
  checkoutStart: (locale: string, rowCount: number) => {
    trackNavigating(AnalyticsEvents.CHECKOUT_START, { locale, row_count: rowCount });
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

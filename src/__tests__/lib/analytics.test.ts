/**
 * Analytics Tests
 *
 * Tests for privacy-first analytics utility with opt-out support
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  analytics,
  AnalyticsEvents,
  isTrackingOptedOut,
  optOutOfTracking,
  optIntoTracking,
} from '@/lib/analytics';

describe('Analytics', () => {
  let localStorageMock: Record<string, string> = {};
  let windowSpy: any;

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {};
    global.localStorage = {
      getItem: (key: string) => localStorageMock[key] || null,
      setItem: (key: string, value: string) => {
        localStorageMock[key] = value;
      },
      removeItem: (key: string) => {
        delete localStorageMock[key];
      },
      clear: () => {
        localStorageMock = {};
      },
      key: () => null,
      length: 0,
    };

    // Mock window.umami
    windowSpy = {
      umami: {
        track: vi.fn(),
      },
      location: {
        reload: vi.fn(),
      },
    };
    global.window = windowSpy as any;

    // Reset import.meta.env
    vi.stubEnv('DEV', false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe('Opt-out functionality', () => {
    it('should return false when not opted out', () => {
      expect(isTrackingOptedOut()).toBe(false);
    });

    it('should return true after opting out', () => {
      optOutOfTracking();
      expect(isTrackingOptedOut()).toBe(true);
    });

    it('should persist opt-out preference in localStorage', () => {
      optOutOfTracking();
      expect(localStorageMock['umami-opt-out']).toBe('true');
    });

    it('should remove umami instance when opting out', () => {
      optOutOfTracking();
      expect(windowSpy.umami).toBeUndefined();
    });

    it('should remove opt-out preference when opting back in', () => {
      optOutOfTracking();
      expect(localStorageMock['umami-opt-out']).toBe('true');

      optIntoTracking();
      expect(localStorageMock['umami-opt-out']).toBeUndefined();
    });

    it('should reload page when opting back in', () => {
      optIntoTracking();
      expect(windowSpy.location.reload).toHaveBeenCalled();
    });
  });

  describe('Event tracking', () => {
    describe('in production with opt-in', () => {
      beforeEach(() => {
        vi.stubEnv('DEV', false);
      });

      it('should track file upload start event', () => {
        analytics.fileUploadStart('abc123', 5.5);

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.FILE_UPLOAD_START, {
          file_hash: 'abc123',
          file_size_mb: 5.5,
        });
      });

      it('should track file upload success event', () => {
        analytics.fileUploadSuccess('abc123', 1500, 2500, false);

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.FILE_UPLOAD_SUCCESS, {
          file_hash: 'abc123',
          account_count: 1500,
          processing_time_ms: 2500,
          from_cache: false,
        });
      });

      it('should track file upload error with truncated message', () => {
        const longError = 'Error: '.repeat(50); // 350+ chars
        analytics.fileUploadError('abc123', longError);

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.FILE_UPLOAD_ERROR, {
          file_hash: 'abc123',
          error_message: expect.stringContaining('Error:'),
        });

        const call = windowSpy.umami.track.mock.calls[0];
        expect(call[1].error_message.length).toBeLessThanOrEqual(200);
      });

      it('should track filter toggle with action (25% sampling)', () => {
        // Mock Math.random to ensure the sampling passes
        const originalRandom = Math.random;
        Math.random = () => 0.1; // 10% < 25% threshold, so event fires

        analytics.filterToggle('notFollowingBack', 'enable', 3);

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.FILTER_TOGGLE, {
          filter_name: 'notFollowingBack',
          filter_action: 'enable',
          active_filter_count: 3,
        });

        Math.random = originalRandom;
      });

      it('should skip filter toggle when sampling excludes', () => {
        const originalRandom = Math.random;
        Math.random = () => 0.5; // 50% > 25% threshold, so event is skipped

        analytics.filterToggle('notFollowingBack', 'enable', 3);

        expect(windowSpy.umami.track).not.toHaveBeenCalled();

        Math.random = originalRandom;
      });

      it('should track filter clear all', () => {
        analytics.filterClearAll(5);

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.FILTER_CLEAR_ALL, {
          previous_count: 5,
        });
      });

      it('should track search with query stats', () => {
        analytics.searchPerform(10, 25, 1000, true);

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.SEARCH_PERFORM, {
          query_length: 10,
          result_count: 25,
          total_count: 1000,
          has_filters_active: true,
        });
      });

      it('should track profile click with badge types (V7)', () => {
        // Mock Math.random to ensure the sampling passes
        const originalRandom = Math.random;
        Math.random = () => 0.05; // 5% < 10% threshold, so event fires

        analytics.profileClick(['unfollowed', 'notFollowingBack']);

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.PROFILE_CLICK, {
          badge_types: 'unfollowed,notFollowingBack',
          badge_count: 2,
        });

        Math.random = originalRandom;
      });

      it('should skip profile click when sampling excludes (V7)', () => {
        const originalRandom = Math.random;
        Math.random = () => 0.5; // 50% > 10% threshold, so event is skipped

        analytics.profileClick(['following']);

        expect(windowSpy.umami.track).not.toHaveBeenCalled();

        Math.random = originalRandom;
      });

      it('should track help modal open with source', () => {
        analytics.helpOpen('header');

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.HELP_OPEN, {
          source: 'header',
        });
      });

      it('should track link clicks', () => {
        analytics.linkClick('github');

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.LINK_CLICK, {
          link_type: 'github',
        });
      });

      it('should track hero CTA clicks', () => {
        analytics.heroCTAGuide();
        expect(windowSpy.umami.track).toHaveBeenCalledWith(
          AnalyticsEvents.HERO_CTA_GUIDE,
          undefined
        );

        analytics.heroCTASample();
        expect(windowSpy.umami.track).toHaveBeenCalledWith(
          AnalyticsEvents.HERO_CTA_SAMPLE,
          undefined
        );

        analytics.heroCTAUploadDirect();
        expect(windowSpy.umami.track).toHaveBeenCalledWith(
          AnalyticsEvents.HERO_CTA_UPLOAD_DIRECT,
          undefined
        );

        analytics.heroCTAContinue();
        expect(windowSpy.umami.track).toHaveBeenCalledWith(
          AnalyticsEvents.HERO_CTA_CONTINUE,
          undefined
        );
      });

      it('should track theme toggle', () => {
        analytics.themeToggle('dark');

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.THEME_TOGGLE, {
          mode: 'dark',
        });
      });

      it('should track clear data action', () => {
        analytics.clearData();

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.CLEAR_DATA, undefined);
      });

      it('should track sample data click', () => {
        analytics.sampleDataClick();

        expect(windowSpy.umami.track).toHaveBeenCalledWith(
          AnalyticsEvents.SAMPLE_DATA_CLICK,
          undefined
        );
      });

      it('should track wizard events (50% sampling for step view)', () => {
        // Mock Math.random to ensure the sampling passes
        const originalRandom = Math.random;
        Math.random = () => 0.3; // 30% < 50% threshold, so event fires

        analytics.wizardStepView(1, 'Opening Settings');
        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.WIZARD_STEP_VIEW, {
          step_id: 1,
          step_title: 'Opening Settings',
        });

        Math.random = originalRandom;

        analytics.wizardBackClick(2);
        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.WIZARD_BACK_CLICK, {
          from_step: 2,
        });

        analytics.wizardCancel();
        expect(windowSpy.umami.track).toHaveBeenCalledWith(
          AnalyticsEvents.WIZARD_CANCEL,
          undefined
        );
      });

      it('should skip wizard step view when sampling excludes', () => {
        const originalRandom = Math.random;
        Math.random = () => 0.7; // 70% > 50% threshold, so event is skipped

        analytics.wizardStepView(1, 'Opening Settings');

        expect(windowSpy.umami.track).not.toHaveBeenCalled();

        Math.random = originalRandom;
      });

      it('should track results clicks summary (V7)', () => {
        analytics.resultsClicksSummary({
          totalClicks: 15,
          badgeClicks: { unfollowed: 8, notFollowingBack: 7 },
          timeSpentSeconds: 45.6,
        });

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.RESULTS_CLICKS_SUMMARY, {
          total_clicks: 15,
          badge_clicks: '{"unfollowed":8,"notFollowingBack":7}',
          time_spent: 46, // Rounded
        });
      });

      it('should round file size in upload start', () => {
        analytics.fileUploadStart('hash', 5.123456);

        const call = windowSpy.umami.track.mock.calls[0];
        expect(call[1].file_size_mb).toBe(5.12);
      });

      it('should round processing time in upload success', () => {
        analytics.fileUploadSuccess('hash', 1000, 1234.567, false);

        const call = windowSpy.umami.track.mock.calls[0];
        expect(call[1].processing_time_ms).toBe(1235);
      });

      it('should track language change', () => {
        analytics.languageChange('es');

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.LANGUAGE_CHANGE, {
          language: 'es',
        });
      });

      it('should track page view with language', () => {
        analytics.pageView('hero', 'en');

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.PAGE_VIEW, {
          page: 'hero',
          language: 'en',
        });
      });

      it('should track page view without language', () => {
        analytics.pageView('wizard');

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.PAGE_VIEW, {
          page: 'wizard',
        });
      });

      it('should track upload zone interactions', () => {
        // V8: uploadDragEnter and uploadDragLeave removed as low-value events
        analytics.uploadDrop();
        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.UPLOAD_DROP, undefined);

        analytics.uploadClick();
        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.UPLOAD_CLICK, undefined);
      });

      it('should track diagnostic error events', () => {
        analytics.diagnosticErrorView('NOT_ZIP', 'upload');
        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.DIAGNOSTIC_ERROR_VIEW, {
          error_code: 'NOT_ZIP',
          source: 'upload',
        });

        analytics.diagnosticErrorRetry('NOT_ZIP');
        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.DIAGNOSTIC_ERROR_RETRY, {
          error_code: 'NOT_ZIP',
        });

        analytics.diagnosticErrorHelp('NOT_ZIP');
        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.DIAGNOSTIC_ERROR_HELP, {
          error_code: 'NOT_ZIP',
        });
      });

      it('should track diagnostic error view without source', () => {
        analytics.diagnosticErrorView('HTML_FORMAT');

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.DIAGNOSTIC_ERROR_VIEW, {
          error_code: 'HTML_FORMAT',
        });
      });

      it('should track FAQ expansion with truncated text', () => {
        const longQuestion = 'Q: '.repeat(50); // 150+ chars
        analytics.faqExpand(1, longQuestion);

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.FAQ_EXPAND, {
          question_id: 1,
          question_text: expect.stringContaining('Q:'),
        });

        const call = windowSpy.umami.track.mock.calls[0];
        expect(call[1].question_text.length).toBeLessThanOrEqual(100);
      });

      it('should track results scroll depth (25% sampling)', () => {
        // Mock Math.random to ensure the sampling passes
        const originalRandom = Math.random;
        Math.random = () => 0.1; // 10% < 25% threshold, so event fires

        analytics.resultsScrollDepth(50, 1500);

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.RESULTS_SCROLL_DEPTH, {
          depth: 50,
          total_accounts: 1500,
        });

        Math.random = originalRandom;
      });

      it('should skip results scroll depth when sampling excludes', () => {
        const originalRandom = Math.random;
        Math.random = () => 0.5; // 50% > 25% threshold, so event is skipped

        analytics.resultsScrollDepth(50, 1500);

        expect(windowSpy.umami.track).not.toHaveBeenCalled();

        Math.random = originalRandom;
      });

      it('should track sample data load', () => {
        analytics.sampleDataLoad(500, 1234.567);

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.SAMPLE_DATA_LOAD, {
          account_count: 500,
          load_time_ms: 1235,
        });
      });

      it('should track rescue plan impression', () => {
        analytics.rescuePlanImpression('high', 'large', 45.678);

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.RESCUE_PLAN_IMPRESSION, {
          severity: 'high',
          size: 'large',
          unfollowed_percent: 46,
        });
      });

      it('should track rescue plan tool click', () => {
        analytics.rescuePlanToolClick('tool-1', 'medium', 'small');

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.RESCUE_PLAN_TOOL_CLICK, {
          tool_id: 'tool-1',
          severity: 'medium',
          size: 'small',
        });
      });

      it('should track rescue plan dismiss', () => {
        analytics.rescuePlanDismiss('low', 'medium', 12.345);

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.RESCUE_PLAN_DISMISS, {
          severity: 'low',
          size: 'medium',
          unfollowed_percent: 12,
        });
      });

      // V8: rescuePlanHover removed as micro-interaction with low value

      it('should track rescue plan view time', () => {
        analytics.rescuePlanViewTime(45.678, 'high', 'large');

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.RESCUE_PLAN_VIEW_TIME, {
          view_time_seconds: 46,
          severity: 'high',
          size: 'large',
        });
      });

      it('should track rescue plan re-engagement', () => {
        analytics.rescuePlanReEngagement('low', 'high');

        expect(windowSpy.umami.track).toHaveBeenCalledWith(
          AnalyticsEvents.RESCUE_PLAN_RE_ENGAGEMENT,
          {
            old_severity: 'low',
            new_severity: 'high',
          }
        );
      });
    });

    describe('in development mode', () => {
      beforeEach(() => {
        vi.stubEnv('DEV', true);
      });

      it('should not track events', () => {
        analytics.fileUploadStart('abc123', 5.5);
        analytics.filterToggle('mutuals', 'enable', 1);
        analytics.searchPerform(5, 10, 100, false);

        expect(windowSpy.umami.track).not.toHaveBeenCalled();
      });
    });

    describe('when opted out', () => {
      beforeEach(() => {
        vi.stubEnv('DEV', false);
        optOutOfTracking();
      });

      it('should not track events', () => {
        analytics.fileUploadStart('abc123', 5.5);
        analytics.filterToggle('mutuals', 'enable', 1);
        analytics.searchPerform(5, 10, 100, false);

        // umami was deleted during opt-out, so no calls
        expect(windowSpy.umami).toBeUndefined();
      });
    });

    describe('when umami not loaded', () => {
      beforeEach(() => {
        vi.stubEnv('DEV', false);
        delete windowSpy.umami;
      });

      it('should not throw error', () => {
        expect(() => {
          analytics.fileUploadStart('abc123', 5.5);
          analytics.filterToggle('mutuals', 'enable', 1);
        }).not.toThrow();
      });
    });

    describe('error handling', () => {
      beforeEach(() => {
        vi.stubEnv('DEV', false);
        windowSpy.umami.track = vi.fn(() => {
          throw new Error('Network error');
        });
      });

      it('should silently fail on tracking errors', () => {
        expect(() => {
          analytics.fileUploadStart('abc123', 5.5);
        }).not.toThrow();
      });
    });
  });

  describe('Event constants', () => {
    it('should have all expected event names', () => {
      expect(AnalyticsEvents.FILE_UPLOAD_START).toBe('file_upload_start');
      expect(AnalyticsEvents.FILE_UPLOAD_SUCCESS).toBe('file_upload_success');
      expect(AnalyticsEvents.FILE_UPLOAD_ERROR).toBe('file_upload_error');
      expect(AnalyticsEvents.FILTER_TOGGLE).toBe('filter_toggle');
      expect(AnalyticsEvents.FILTER_CLEAR_ALL).toBe('filter_clear_all');
      expect(AnalyticsEvents.SEARCH_PERFORM).toBe('search_perform');
      expect(AnalyticsEvents.PROFILE_CLICK).toBe('profile_click'); // V7
      expect(AnalyticsEvents.RESULTS_CLICKS_SUMMARY).toBe('results_clicks_summary'); // V7
      expect(AnalyticsEvents.HELP_OPEN).toBe('help_open');
      expect(AnalyticsEvents.LINK_CLICK).toBe('link_click');
      expect(AnalyticsEvents.HERO_CTA_GUIDE).toBe('hero_cta_guide');
      expect(AnalyticsEvents.HERO_CTA_SAMPLE).toBe('hero_cta_sample');
      expect(AnalyticsEvents.HERO_CTA_UPLOAD_DIRECT).toBe('hero_cta_upload_direct');
      expect(AnalyticsEvents.HERO_CTA_CONTINUE).toBe('hero_cta_continue');
      expect(AnalyticsEvents.THEME_TOGGLE).toBe('theme_toggle');
      expect(AnalyticsEvents.CLEAR_DATA).toBe('clear_data');
      expect(AnalyticsEvents.SAMPLE_DATA_CLICK).toBe('sample_data_click');
      expect(AnalyticsEvents.WIZARD_STEP_VIEW).toBe('wizard_step_view');
      // V8: WIZARD_NEXT_CLICK and WIZARD_EXTERNAL_LINK_CLICK removed as duplicates
      expect(AnalyticsEvents.WIZARD_BACK_CLICK).toBe('wizard_back_click');
      expect(AnalyticsEvents.WIZARD_CANCEL).toBe('wizard_cancel');
    });
  });

  describe('SSR safety', () => {
    it('should handle window undefined in isTrackingOptedOut', () => {
      const originalWindow = global.window;
      // @ts-expect-error - Testing SSR
      global.window = undefined;

      expect(isTrackingOptedOut()).toBe(false);

      global.window = originalWindow;
    });

    it('should handle window undefined in optOutOfTracking', () => {
      const originalWindow = global.window;
      // @ts-expect-error - Testing SSR
      global.window = undefined;

      expect(() => optOutOfTracking()).not.toThrow();

      global.window = originalWindow;
    });

    it('should handle window undefined in optIntoTracking', () => {
      const originalWindow = global.window;
      // @ts-expect-error - Testing SSR
      global.window = undefined;

      expect(() => optIntoTracking()).not.toThrow();

      global.window = originalWindow;
    });
  });
});

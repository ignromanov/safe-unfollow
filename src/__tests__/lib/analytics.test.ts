/**
 * Analytics Tests (V10)
 *
 * Tests for privacy-first analytics utility with opt-out support.
 * V10: Removed events (session_duration, rescue_plan_impression, results_scroll_depth,
 *       wizard_back_click, wizard_cancel), simplified payloads, tightened sampling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  analytics,
  AnalyticsEvents,
  isTrackingOptedOut,
  optOutOfTracking,
  optIntoTracking,
  captureUTMParams,
  setEntryCTA,
} from '@/lib/analytics';

describe('Analytics', () => {
  let localStorageMock: Record<string, string> = {};
  let sessionStorageMock: Record<string, string> = {};
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

    // Mock sessionStorage
    sessionStorageMock = {};
    global.sessionStorage = {
      getItem: (key: string) => sessionStorageMock[key] || null,
      setItem: (key: string, value: string) => {
        sessionStorageMock[key] = value;
      },
      removeItem: (key: string) => {
        delete sessionStorageMock[key];
      },
      clear: () => {
        sessionStorageMock = {};
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
        search: '',
        hostname: 'localhost',
        pathname: '/',
      },
      innerWidth: 1200,
      matchMedia: () => ({ matches: false }),
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

      it('should track file upload start with file size', () => {
        analytics.fileUploadStart(5.5);

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.FILE_UPLOAD_START, {
          file_size_mb: 5.5,
        });
      });

      it('should track file upload success without hash or processing time', () => {
        analytics.fileUploadSuccess(1500, false);

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.FILE_UPLOAD_SUCCESS, {
          account_count: 1500,
          from_cache: false,
        });
      });

      it('should enrich file upload success with UTM and entry CTA', () => {
        sessionStorageMock['analytics_utm'] = JSON.stringify({
          utm_source: 'producthunt',
          utm_medium: 'launch',
        });
        sessionStorageMock['analytics_entry_cta'] = 'guide';

        analytics.fileUploadSuccess(1500, false);

        const call = windowSpy.umami.track.mock.calls[0];
        expect(call[1].utm_source).toBe('producthunt');
        expect(call[1].utm_medium).toBe('launch');
        expect(call[1].entry_cta).toBe('guide');
      });

      it('should track filter toggle with 3% sampling', () => {
        const originalRandom = Math.random;
        Math.random = () => 0.02; // 2% < 3% threshold

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
        Math.random = () => 0.05; // 5% > 3% threshold

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

      it('should track search with 5% sampling', () => {
        const originalRandom = Math.random;
        Math.random = () => 0.03; // 3% < 5% threshold

        analytics.searchPerform(10, 25, 1000, true);

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.SEARCH_PERFORM, {
          query_length: 10,
          result_count: 25,
          total_count: 1000,
          has_filters_active: true,
        });

        Math.random = originalRandom;
      });

      it('should skip search when sampling excludes', () => {
        const originalRandom = Math.random;
        Math.random = () => 0.1; // 10% > 5% threshold

        analytics.searchPerform(10, 25, 1000, true);

        expect(windowSpy.umami.track).not.toHaveBeenCalled();

        Math.random = originalRandom;
      });

      it('should track results clicks summary with top 3 badges', () => {
        const originalRandom = Math.random;
        Math.random = () => 0.1;
        analytics.resultsClicksSummary({
          totalClicks: 20,
          badgeClicks: { unfollowed: 10, notFollowingBack: 5, following: 3, mutuals: 2 },
          timeSpentSeconds: 45.6,
        });

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.RESULTS_CLICKS_SUMMARY, {
          total_clicks: 20,
          badge_clicks: '{"unfollowed":10,"notFollowingBack":5,"following":3}',
          time_spent: 46,
        });
        Math.random = originalRandom;
      });

      it('should track link clicks', () => {
        analytics.linkClick('github');

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.LINK_CLICK, {
          link_type: 'github',
        });
      });

      it('should track hero CTA clicks and set entry CTA', () => {
        analytics.heroCTAGuide();
        expect(windowSpy.umami.track).toHaveBeenCalledWith(
          AnalyticsEvents.HERO_CTA_GUIDE,
          undefined
        );
        expect(sessionStorageMock['analytics_entry_cta']).toBe('guide');

        analytics.heroCTASample();
        expect(windowSpy.umami.track).toHaveBeenCalledWith(
          AnalyticsEvents.HERO_CTA_SAMPLE,
          undefined
        );
        // Entry CTA should not be overwritten (first per session)
        expect(sessionStorageMock['analytics_entry_cta']).toBe('guide');
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

      it('should track wizard step view with 5% sampling and no step_title', () => {
        const originalRandom = Math.random;
        Math.random = () => 0.03; // 3% < 5% threshold

        analytics.wizardStepView(1, 'Opening Settings');
        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.WIZARD_STEP_VIEW, {
          step_id: 1,
        });

        Math.random = originalRandom;
      });

      it('should skip wizard step view when sampling excludes', () => {
        const originalRandom = Math.random;
        Math.random = () => 0.1; // 10% > 5% threshold

        analytics.wizardStepView(1, 'Opening Settings');

        expect(windowSpy.umami.track).not.toHaveBeenCalled();

        Math.random = originalRandom;
      });

      it('should round file size in upload start', () => {
        analytics.fileUploadStart(5.123456);

        const call = windowSpy.umami.track.mock.calls[0];
        expect(call[1].file_size_mb).toBe(5.12);
      });

      it('should track language change', () => {
        analytics.languageChange('es');

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.LANGUAGE_CHANGE, {
          language: 'es',
        });
      });

      it('should track page view only once per session with UTM params', () => {
        sessionStorageMock['analytics_utm'] = JSON.stringify({
          utm_source: 'producthunt',
          utm_medium: 'launch',
        });

        analytics.pageView();

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.PAGE_VIEW, {
          utm_source: 'producthunt',
          utm_medium: 'launch',
        });
        expect(sessionStorageMock['analytics_first_pv']).toBe('1');

        // Second call should be skipped (already tracked this session)
        windowSpy.umami.track.mockClear();
        analytics.pageView();
        expect(windowSpy.umami.track).not.toHaveBeenCalled();
      });

      it('should not track page view without UTM params', () => {
        analytics.pageView();

        expect(windowSpy.umami.track).not.toHaveBeenCalled();
        // But session flag is still set
        expect(sessionStorageMock['analytics_first_pv']).toBe('1');
      });

      it('should track upload click', () => {
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

      it('should track FAQ expansion without question_text', () => {
        analytics.faqExpand(1, 'Some long question text');

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.FAQ_EXPAND, {
          question_id: 1,
        });
      });

      it('should track sample data load', () => {
        analytics.sampleDataLoad(500, 1234.567);

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.SAMPLE_DATA_LOAD, {
          account_count: 500,
          load_time_ms: 1235,
        });
      });

      it('should track rescue plan tool click', () => {
        analytics.rescuePlanToolClick('tool-1', 0, 'medium', 'small', 1500);

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.RESCUE_PLAN_TOOL_CLICK, {
          tool_id: 'tool-1',
          position: 0,
          severity: 'medium',
          size: 'small',
          segment: 'medium_small',
          account_count: 1500,
        });
      });

      it('should track error boundary with proper type', () => {
        analytics.errorBoundary('Test error', 'at Component');

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.ERROR_BOUNDARY, {
          error_message: 'Test error',
          component_stack: 'at Component',
        });
      });

      it('should track route error with proper type', () => {
        analytics.routeError(404, 'Not found');

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.ROUTE_ERROR, {
          status: 404,
          message: 'Not found',
        });
      });

      it('should track web vital with 3% sampling', () => {
        const originalRandom = Math.random;
        Math.random = () => 0.02; // 2% < 3% threshold

        analytics.webVital('LCP', 1234.5, 'good');

        expect(windowSpy.umami.track).toHaveBeenCalledWith(AnalyticsEvents.WEB_VITAL, {
          metric_name: 'LCP',
          metric_value: 1235,
          rating: 'good',
        });

        Math.random = originalRandom;
      });

      it('should track PWA events', () => {
        analytics.pwaInstallPrompt();
        expect(windowSpy.umami.track).toHaveBeenCalledWith(
          AnalyticsEvents.PWA_INSTALL_PROMPT,
          undefined
        );

        analytics.pwaInstalled();
        expect(windowSpy.umami.track).toHaveBeenCalledWith(
          AnalyticsEvents.PWA_INSTALLED,
          undefined
        );
      });
    });

    describe('in development mode', () => {
      beforeEach(() => {
        vi.stubEnv('DEV', true);
      });

      it('should not track events', () => {
        analytics.fileUploadStart(5.5);
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
        analytics.fileUploadStart(5.5);
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
          analytics.fileUploadStart(5.5);
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
          analytics.fileUploadStart(5.5);
        }).not.toThrow();
      });
    });
  });

  describe('UTM tracking', () => {
    it('should capture UTM params from URL', () => {
      windowSpy.location.search = '?utm_source=producthunt&utm_medium=launch&utm_campaign=v2';

      captureUTMParams();

      const stored = JSON.parse(sessionStorageMock['analytics_utm']);
      expect(stored.utm_source).toBe('producthunt');
      expect(stored.utm_medium).toBe('launch');
      expect(stored.utm_campaign).toBe('v2');
    });

    it('should not store empty UTM params', () => {
      windowSpy.location.search = '';

      captureUTMParams();

      expect(sessionStorageMock['analytics_utm']).toBeUndefined();
    });
  });

  describe('Entry CTA tracking', () => {
    it('should store entry CTA only once per session', () => {
      setEntryCTA('guide');
      expect(sessionStorageMock['analytics_entry_cta']).toBe('guide');

      setEntryCTA('sample');
      // Should not overwrite
      expect(sessionStorageMock['analytics_entry_cta']).toBe('guide');
    });
  });

  describe('Event constants', () => {
    it('should have all expected event names', () => {
      expect(AnalyticsEvents.FILE_UPLOAD_START).toBe('file_upload_start');
      expect(AnalyticsEvents.FILE_UPLOAD_SUCCESS).toBe('file_upload_success');
      expect(AnalyticsEvents.FILTER_TOGGLE).toBe('filter_toggle');
      expect(AnalyticsEvents.FILTER_CLEAR_ALL).toBe('filter_clear_all');
      expect(AnalyticsEvents.SEARCH_PERFORM).toBe('search_perform');
      expect(AnalyticsEvents.RESULTS_CLICKS_SUMMARY).toBe('results_clicks_summary');
      expect(AnalyticsEvents.LINK_CLICK).toBe('link_click');
      expect(AnalyticsEvents.HERO_CTA_GUIDE).toBe('hero_cta_guide');
      expect(AnalyticsEvents.HERO_CTA_SAMPLE).toBe('hero_cta_sample');
      expect(AnalyticsEvents.HERO_CTA_UPLOAD_DIRECT).toBe('hero_cta_upload_direct');
      expect(AnalyticsEvents.HERO_CTA_CONTINUE).toBe('hero_cta_continue');
      expect(AnalyticsEvents.THEME_TOGGLE).toBe('theme_toggle');
      expect(AnalyticsEvents.CLEAR_DATA).toBe('clear_data');
      expect(AnalyticsEvents.WIZARD_STEP_VIEW).toBe('wizard_step_view');
      expect(AnalyticsEvents.ERROR_BOUNDARY).toBe('error_boundary');
      expect(AnalyticsEvents.ROUTE_ERROR).toBe('route_error');
      expect(AnalyticsEvents.WEB_VITAL).toBe('web_vital');
      expect(AnalyticsEvents.PWA_INSTALL_PROMPT).toBe('pwa_install_prompt');
      expect(AnalyticsEvents.PWA_INSTALLED).toBe('pwa_installed');
    });

    it('should NOT have removed V9/V10 events', () => {
      const events = AnalyticsEvents as Record<string, string>;
      // V9 removals
      expect(events['FILE_UPLOAD_ERROR']).toBeUndefined();
      expect(events['PROFILE_CLICK']).toBeUndefined();
      expect(events['HELP_OPEN']).toBeUndefined();
      expect(events['FILE_PICKER_CANCEL']).toBeUndefined();
      expect(events['UPLOAD_DROP']).toBeUndefined();
      expect(events['SAMPLE_DATA_CLICK']).toBeUndefined();
      expect(events['RESCUE_PLAN_VIEW_TIME']).toBeUndefined();
      expect(events['RESCUE_PLAN_RE_ENGAGEMENT']).toBeUndefined();
      // V10 removals
      expect(events['SESSION_DURATION']).toBeUndefined();
      expect(events['RESULTS_SCROLL_DEPTH']).toBeUndefined();
      expect(events['WIZARD_BACK_CLICK']).toBeUndefined();
      expect(events['WIZARD_CANCEL']).toBeUndefined();
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

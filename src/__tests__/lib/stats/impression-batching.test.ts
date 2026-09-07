import { beforeEach, describe, expect, it, vi } from 'vitest';

const enqueueEvent = vi.fn();
const trackEvent = vi.fn();
const trackNavigating = vi.fn();
const flushEvents = vi.fn();
vi.mock('@/lib/stats/queue', () => ({
  enqueueEvent: (name: string, data?: unknown) => enqueueEvent(name, data),
  trackNavigating: (name: string, data?: unknown) => trackNavigating(name, data),
  flushEvents: () => flushEvents(),
}));
vi.mock('@/lib/stats/core', () => ({
  trackEvent: (name: string, data?: unknown) => trackEvent(name, data),
}));

import { analytics } from '@/lib/stats/events';
import { recordCTA } from '@/lib/stats/cta-capture';

describe('promo impression batching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('queues the ad viewable impression instead of sending it immediately', () => {
    analytics.adSlotViewable('results');

    expect(enqueueEvent).toHaveBeenCalledWith('ad_slot_viewable', { slot: 'results' });
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('queues loading tip impressions — three of them fire inside one parse', () => {
    analytics.loadingTipImpression('local-processing', 0, 800);
    analytics.loadingTipImpression('nordvpn', 1, 950);
    analytics.loadingTipImpression('revoke-access', 2, 1100);

    expect(enqueueEvent).toHaveBeenCalledTimes(3);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('queues the donation card impression', () => {
    analytics.donationCardImpression(42);

    expect(enqueueEvent).toHaveBeenCalledWith('donation_card_impression', { account_count: 42 });
  });

  it('queues the rescue plan impression', () => {
    analytics.rescuePlanImpression('critical', 'large', 4200, 37.5);

    expect(enqueueEvent).toHaveBeenCalledWith('rescue_plan_impression', {
      severity: 'critical',
      size: 'large',
      segment: 'critical_large',
      account_count: 4200,
      unfollowed_percent: 37.5,
    });
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('keeps new-tab clicks on the immediate path — they must not wait for a batch', () => {
    analytics.affiliateBlockClick('nordvpn_global');

    expect(trackEvent).toHaveBeenCalledWith('affiliate_block_click', {
      offer_id: 'nordvpn_global',
    });
    expect(enqueueEvent).not.toHaveBeenCalled();
  });

  it('leaves new-tab clicks on trackEvent — a _blank click never unloads this page', () => {
    analytics.donationCardClick(1200);

    expect(trackEvent).toHaveBeenCalledWith('donation_card_click', { account_count: 1200 });
    expect(trackNavigating).not.toHaveBeenCalled();
  });

  describe('same-tab navigations', () => {
    it('sends checkout_start over the keepalive path — the redirect would cancel it', () => {
      analytics.checkoutStart('en', 42);

      expect(trackNavigating).toHaveBeenCalledWith('checkout_start', {
        locale: 'en',
        row_count: 42,
      });
      expect(trackEvent).not.toHaveBeenCalled();
    });

    it('sends language_change over the keepalive path — it precedes a full reload', () => {
      analytics.languageChange('id');

      expect(trackNavigating).toHaveBeenCalledWith('language_change', { language: 'id' });
      expect(trackEvent).not.toHaveBeenCalled();
    });
  });

  describe('paywall funnel dimensions', () => {
    it('carries locale and row_count on every step of the funnel', () => {
      analytics.paywallView('id', 8930);
      analytics.checkoutStart('id', 8930);

      expect(enqueueEvent).toHaveBeenCalledWith('paywall_view', {
        locale: 'id',
        row_count: 8930,
      });
      expect(trackNavigating).toHaveBeenCalledWith('checkout_start', {
        locale: 'id',
        row_count: 8930,
      });
    });

    // The view is an impression and precedes no navigation, so it belongs on
    // the batch path — which also means it is gated on the same thing
    // checkout_start is gated on, and the ratio between them divides one
    // population rather than two.
    it('puts the dismiss on the same path as the view it is divided by', () => {
      analytics.paywallDismiss('en', 42);

      expect(enqueueEvent).toHaveBeenCalledWith('paywall_dismiss', {
        locale: 'en',
        row_count: 42,
      });
      expect(trackEvent).not.toHaveBeenCalled();
    });
  });

  // Edge Requests are billed per request that reaches the CDN, and a cache HIT
  // is billed like a MISS. These events unload nothing and are divided by
  // nothing that sits on another path, so one request for the page's set is as
  // good as one request each. New-tab clicks, same-tab navigations and rare
  // diagnostics deliberately stay where they are — see the cases above.
  describe('in-page telemetry that costs one request per event', () => {
    it('queues the install prompt and its outcome on one path, so the ratio divides one population', () => {
      analytics.pwaInstallPrompt();
      analytics.pwaInstalled();

      expect(enqueueEvent).toHaveBeenNthCalledWith(1, 'pwa_install_prompt', undefined);
      expect(enqueueEvent).toHaveBeenNthCalledWith(2, 'pwa_installed', undefined);
      expect(trackEvent).not.toHaveBeenCalled();
    });

    it('queues the guide section view — it is an impression, and a scroll unloads nothing', () => {
      analytics.guideSectionView(3);

      expect(enqueueEvent).toHaveBeenCalledWith('guide_section_view', {
        step_id: 3,
        first_view_in_tab: true,
      });
      expect(trackEvent).not.toHaveBeenCalled();
    });

    it('queues guide_open, carrying the gesture and the named section', () => {
      analytics.guideOpen('accordion');
      analytics.guideOpen('url', 3);

      expect(enqueueEvent).toHaveBeenNthCalledWith(1, 'guide_open', { source: 'accordion' });
      expect(enqueueEvent).toHaveBeenNthCalledWith(2, 'guide_open', {
        source: 'url',
        step_id: 3,
      });
      expect(trackEvent).not.toHaveBeenCalled();
    });

    it('queues in-page interactions, which fire repeatedly inside one page life', () => {
      analytics.filterClearAll(3);
      analytics.searchPerform(4, 10, 100, false);
      analytics.faqExpand(2);
      analytics.themeToggle('dark');

      expect(enqueueEvent).toHaveBeenNthCalledWith(1, 'filter_clear_all', {
        previous_count: 3,
      });
      expect(enqueueEvent).toHaveBeenNthCalledWith(2, 'search_perform', {
        query_length: 4,
        result_count: 10,
        total_count: 100,
        has_filters_active: false,
      });
      expect(enqueueEvent).toHaveBeenNthCalledWith(3, 'faq_expand', { question_id: 2 });
      expect(enqueueEvent).toHaveBeenNthCalledWith(4, 'theme_toggle', { mode: 'dark' });
      expect(trackEvent).not.toHaveBeenCalled();
    });

    // The four hero CTAs are PrefixedLink, i.e. react-router Link: the click is
    // preventDefault + pushState, so the document never unloads and there is no
    // in-flight request to cancel. The route change that follows drains the
    // queue on the next tick (useEventQueueFlush), so nothing waits either.
    // Contrast with checkout_start, which precedes a real `location.href`.
    it('queues the hero CTAs — an SPA link unloads nothing, and the route change drains the queue', () => {
      recordCTA('guide');
      recordCTA('sample');
      recordCTA('upload_direct');
      recordCTA('continue');

      expect(enqueueEvent).toHaveBeenNthCalledWith(1, 'hero_cta_guide', undefined);
      expect(enqueueEvent).toHaveBeenNthCalledWith(2, 'hero_cta_sample', undefined);
      expect(enqueueEvent).toHaveBeenNthCalledWith(3, 'hero_cta_upload_direct', undefined);
      expect(enqueueEvent).toHaveBeenNthCalledWith(4, 'hero_cta_continue', undefined);
      expect(trackEvent).not.toHaveBeenCalled();
      expect(trackNavigating).not.toHaveBeenCalled();
    });

    // Two of these (searchPerform, guideSectionView's wizard_step_view lineage)
    // had a GH#123 gate removed; guideOpen is new to this series and was
    // unsampled from birth (R8) rather than having one removed. A batched flush
    // is one request whatever it carries, so the volume argument that justified
    // a gate does not apply on this transport for any of the three — and all
    // three are read as counts, which sampling harms rather than helps. The
    // worst roll must still report.
    //
    // `filterToggle` was the fourth until its series ended; its replacement,
    // `filter_session_summary`, is unsampled for the same reason but rides
    // `trackBeacon` rather than the queue, so it is gated where it lives —
    // `src/__tests__/hooks/useTimeOnResults.test.tsx`.
    it('reports the three batched events on any roll — nothing samples them', () => {
      const random = vi.spyOn(Math, 'random').mockReturnValue(0.99);

      analytics.searchPerform(4, 10, 100, false);
      analytics.guideSectionView(3);
      analytics.guideOpen('accordion');

      expect(enqueueEvent).toHaveBeenCalledTimes(3);
      random.mockRestore();
    });
  });

  // guide_section_view's first_view_in_tab, unsampled since GH#123 (R8).
  describe('guide section view', () => {
    it('marks first views per section, so scrolling up and back down is not two funnels', () => {
      analytics.guideSectionView(2);
      analytics.guideSectionView(3);
      analytics.guideSectionView(2);

      expect(enqueueEvent).toHaveBeenNthCalledWith(1, 'guide_section_view', {
        step_id: 2,
        first_view_in_tab: true,
      });
      expect(enqueueEvent).toHaveBeenNthCalledWith(3, 'guide_section_view', {
        step_id: 2,
        first_view_in_tab: false,
      });
    });

    // Safari's "Block all cookies" and Firefox's "Block cookies and site
    // data" make the getter itself throw, and the caller runs inside a mount
    // effect — an unguarded throw would take the screen down to report a view.
    it('reports a view rather than throwing when sessionStorage is blocked', () => {
      vi.stubGlobal('sessionStorage', {
        getItem: () => {
          throw new DOMException('The operation is insecure.', 'SecurityError');
        },
        setItem: () => {},
        clear: () => {},
      });

      expect(() => analytics.guideSectionView(4)).not.toThrow();

      expect(enqueueEvent).toHaveBeenCalledExactlyOnceWith('guide_section_view', {
        step_id: 4,
        first_view_in_tab: false,
      });
      vi.unstubAllGlobals();
    });
  });

  // The upload funnel moves as one unit or not at all. `file_upload_success`
  // is divided by `file_upload_start`, and every `upload_error_<code>` is
  // reported against that same denominator, so a split gate would divide the
  // 70.5% success rate across two populations — the defect c026b6a closed.
  // Moving all of them keeps one gate, and correlated loss leaves the ratio
  // unbiased where independent loss of a success would understate it.
  describe('upload funnel', () => {
    it('queues every step of one upload attempt on one gate', () => {
      analytics.uploadClick();
      analytics.fileUploadStart(12.5);
      analytics.fileUploadSuccess(4200, false);
      analytics.uploadParseDuration(900, 'success');

      const queued = enqueueEvent.mock.calls.map(([name]) => name);
      expect(queued).toEqual([
        'upload_click',
        'file_upload_start',
        'file_upload_success',
        'upload_parse_duration',
      ]);
      expect(trackEvent).not.toHaveBeenCalled();
    });

    it('queues the error code on the same gate as the start it is divided by', () => {
      analytics.uploadErrorByCode('HTML_FORMAT', 'not a json export');

      expect(enqueueEvent).toHaveBeenCalledWith('upload_error_html_format', {
        error_message: 'not a json export',
      });
      expect(trackEvent).not.toHaveBeenCalled();
    });

    it('flushes on the error, because the error path navigates nowhere to trigger one', () => {
      analytics.uploadErrorByCode('HTML_FORMAT');

      expect(flushEvents).toHaveBeenCalledTimes(1);
    });

    it('does not flush on the success path — the route change to /results already does', () => {
      analytics.fileUploadSuccess(4200, false);

      expect(flushEvents).not.toHaveBeenCalled();
    });
  });

  it('applies no sampling to impressions', () => {
    // Reconciliation against the AdSense dashboard needs 1:1 counts, and
    // AdSense does not sample its own numbers for us to correct against.
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99);

    analytics.adSlotViewable('results');
    analytics.donationCardImpression(1);

    expect(enqueueEvent).toHaveBeenCalledTimes(2);
    random.mockRestore();
  });
});

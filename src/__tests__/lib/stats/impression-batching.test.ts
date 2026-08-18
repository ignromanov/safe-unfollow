import { beforeEach, describe, expect, it, vi } from 'vitest';

const enqueueEvent = vi.fn();
const trackEvent = vi.fn();
const trackNavigating = vi.fn();
vi.mock('@/lib/stats/queue', () => ({
  enqueueEvent: (name: string, data?: unknown) => enqueueEvent(name, data),
  trackNavigating: (name: string, data?: unknown) => trackNavigating(name, data),
}));
vi.mock('@/lib/stats/core', () => ({
  trackEvent: (name: string, data?: unknown) => trackEvent(name, data),
}));

import { analytics } from '@/lib/stats/events';

describe('promo impression batching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      analytics.checkoutStart();

      expect(trackNavigating).toHaveBeenCalledWith('checkout_start', undefined);
      expect(trackEvent).not.toHaveBeenCalled();
    });

    it('sends language_change over the keepalive path — it precedes a full reload', () => {
      analytics.languageChange('id');

      expect(trackNavigating).toHaveBeenCalledWith('language_change', { language: 'id' });
      expect(trackEvent).not.toHaveBeenCalled();
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

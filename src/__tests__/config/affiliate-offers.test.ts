import { describe, expect, it } from 'vitest';

import { resolveAffiliateOffer } from '@/config/affiliate-offers';
import { SUPPORTED_LANGUAGES } from '@/config/languages';

describe('resolveAffiliateOffer', () => {
  it('routes ru to the offer that actually includes Russia', () => {
    // The main offer excludes Russia, Belarus and China; offer 153 is those three.
    expect(resolveAffiliateOffer('ru')?.id).toBe('nordvpn_cis');
  });

  it('routes tr and ar to the offer that includes Turkey and the Gulf', () => {
    expect(resolveAffiliateOffer('tr')?.id).toBe('nordvpn_arabia');
    expect(resolveAffiliateOffer('ar')?.id).toBe('nordvpn_arabia');
  });

  it('routes everything else to the main offer', () => {
    for (const language of ['en', 'es', 'pt', 'de', 'fr', 'hi', 'ja', 'id']) {
      expect(resolveAffiliateOffer(language)?.id).toBe('nordvpn_global');
    }
  });

  it('routes ja to the main offer — offer 476 is South Korea only, and Japan is in the main list', () => {
    expect(resolveAffiliateOffer('ja')?.id).toBe('nordvpn_global');
  });

  it('normalizes a region-tagged tag like i18next reports', () => {
    expect(resolveAffiliateOffer('ru-RU')?.id).toBe('nordvpn_cis');
    expect(resolveAffiliateOffer('en-US')?.id).toBe('nordvpn_global');
  });

  it('falls back to the main offer for an unknown language', () => {
    expect(resolveAffiliateOffer('xx')?.id).toBe('nordvpn_global');
  });

  it('resolves an offer for every supported language', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      expect(resolveAffiliateOffer(language), language).not.toBeNull();
    }
  });

  it('shares one copy key across the geo variants — they sell the same product', () => {
    const ids = ['en', 'ru', 'ar'].map(l => resolveAffiliateOffer(l)?.copyKey);
    expect(new Set(ids).size).toBe(1);
  });

  it('serves every tracking link over https', () => {
    // Offer 153 is listed as plain http in the dashboard; a cleartext referrer
    // is a poor look on this product specifically.
    for (const language of SUPPORTED_LANGUAGES) {
      expect(resolveAffiliateOffer(language)?.url, language).toMatch(/^https:\/\//);
    }
  });

  it('shows a banner in every language — the geo offers borrow the one creative we hold', () => {
    // Only offer 15 was cut a creative. Lending it to 153 and 226 is a call
    // taken 2026-08-07 and NOT confirmed with the network: if creatives are
    // bound to an offer id rather than to the account, this is outside the
    // terms and the three assertions below are what to revert.
    for (const language of SUPPORTED_LANGUAGES) {
      expect(resolveAffiliateOffer(language)?.creative, language).toBeDefined();
    }
  });

  it('lends the same creative object rather than a copy per offer', () => {
    // One object, deliberately: a swap edits one constant and all three offers
    // follow. Were these separate literals, updating the creative would mean
    // remembering three places, and forgetting one would ship a stale banner
    // to exactly the locales nobody on the team reads.
    const shared = resolveAffiliateOffer('en')?.creative;
    expect(resolveAffiliateOffer('ru')?.creative).toBe(shared);
    expect(resolveAffiliateOffer('ar')?.creative).toBe(shared);
  });

  it('turns the placement off when an operator blanks a live offer url', () => {
    // The kill switch is operational: someone empties `url` on the module's
    // own offer constant during an incident. Exercise that exact object via
    // the real resolution path rather than a parallel test-only one.
    const offer = resolveAffiliateOffer('en');
    if (!offer) {
      throw new Error('expected the main offer to be active before exercising the kill switch');
    }
    const originalUrl = offer.url;
    offer.url = '';
    try {
      expect(resolveAffiliateOffer('en')).toBeNull();
    } finally {
      offer.url = originalUrl;
    }
  });
});

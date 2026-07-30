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

  it('attaches a creative only where the network actually has one', () => {
    expect(resolveAffiliateOffer('en')?.creative).toBeDefined();
    // Nothing is confirmed attached for 153 or 226, so those stay text-only.
    expect(resolveAffiliateOffer('ru')?.creative).toBeUndefined();
    expect(resolveAffiliateOffer('ar')?.creative).toBeUndefined();
  });
});

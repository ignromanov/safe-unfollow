import { describe, it, expect } from 'vitest';

import { AFFILIATE_LINKS } from '@/config/affiliate-links';

describe('AFFILIATE_LINKS.nordvpn env fallback', () => {
  it('resolves to an empty string, not undefined, when VITE_NORDVPN_URL is unset', () => {
    // No .env file defines VITE_NORDVPN_URL in this repo/test run, so the
    // `?? ''` fallback in affiliate-links.ts must have already kicked in.
    expect(import.meta.env.VITE_NORDVPN_URL).toBeUndefined();
    expect(AFFILIATE_LINKS.nordvpn).toBe('');
  });

  it('produces a string type that downstream hide-on-empty checks can rely on', () => {
    // LoadingTips/config/loading-tips.ts treats `url: ''` as "hide the tip" and
    // `url: undefined` as "always show" (see LoadingTip.url comment) — the
    // fallback must never leave nordvpn as undefined, or the affiliate tip
    // would render unconditionally with no link.
    expect(typeof AFFILIATE_LINKS.nordvpn).toBe('string');
    expect(AFFILIATE_LINKS.nordvpn).not.toBeUndefined();
  });
});

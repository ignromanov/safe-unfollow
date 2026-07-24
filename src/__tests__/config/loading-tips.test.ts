import { describe, it, expect, afterEach, vi } from 'vitest';

import { LOADING_TIPS, VISIBLE_LOADING_TIPS } from '@/config/loading-tips';

describe('VISIBLE_LOADING_TIPS', () => {
  afterEach(() => {
    vi.doUnmock('@/config/affiliate-links');
    vi.resetModules();
  });

  it('renders every tip while the affiliate link is configured', () => {
    expect(VISIBLE_LOADING_TIPS).toHaveLength(LOADING_TIPS.length);
    expect(VISIBLE_LOADING_TIPS.find(tip => tip.id === 'nordvpn')?.url).toMatch(/^https:\/\//);
  });

  it('drops the affiliate tip when its link is blanked, keeping the privacy tips', async () => {
    // The kill switch: blanking the URL in affiliate-links.ts must remove the
    // paid card without touching the tips that carry no link.
    vi.doMock('@/config/affiliate-links', () => ({ AFFILIATE_LINKS: { nordvpn: '' } }));
    vi.resetModules();

    const reloaded = await import('@/config/loading-tips');

    expect(reloaded.VISIBLE_LOADING_TIPS.some(tip => tip.id === 'nordvpn')).toBe(false);
    expect(reloaded.VISIBLE_LOADING_TIPS).toHaveLength(reloaded.LOADING_TIPS.length - 1);
  });

  it('keeps delays ascending, which is what makes reveal indices match analytics', () => {
    const delays = VISIBLE_LOADING_TIPS.map(tip => tip.delayMs);
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
  });

  it('reveals every tip inside the window a typical parse survives', () => {
    // The delays are choreography, not gating. Most exports (80% of users hold
    // under 3k accounts) finish parsing in 1-3s, and the 42% of uploads that
    // fail on format usually fail sooner than that — so a tip scheduled past
    // this bound is a tip nobody sees. Watch upload_parse_duration before
    // raising it.
    const REVEAL_BUDGET_MS = 1200;

    for (const tip of VISIBLE_LOADING_TIPS) {
      expect(tip.delayMs, `${tip.id} is revealed too late to be seen`).toBeLessThanOrEqual(
        REVEAL_BUDGET_MS
      );
    }
  });
});

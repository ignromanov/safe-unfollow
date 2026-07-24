import { describe, it, expect, afterEach, vi } from 'vitest';

/**
 * Covers the real config wiring (env -> AFFILIATE_LINKS -> VISIBLE_LOADING_TIPS)
 * that `LoadingTips.test.tsx` mocks away.
 */
describe('VISIBLE_LOADING_TIPS', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('drops the affiliate tip when VITE_NORDVPN_URL is unset', async () => {
    vi.stubEnv('VITE_NORDVPN_URL', undefined);
    vi.resetModules();

    const { LOADING_TIPS, VISIBLE_LOADING_TIPS } = await import('@/config/loading-tips');

    expect(VISIBLE_LOADING_TIPS.some(tip => tip.id === 'nordvpn')).toBe(false);
    // The privacy tips must not depend on affiliate configuration.
    expect(VISIBLE_LOADING_TIPS).toHaveLength(LOADING_TIPS.length - 1);
  });

  it('keeps the affiliate tip with its link when VITE_NORDVPN_URL is set', async () => {
    vi.stubEnv('VITE_NORDVPN_URL', 'https://go.nordvpn.example/TEST');
    vi.resetModules();

    const { LOADING_TIPS, VISIBLE_LOADING_TIPS } = await import('@/config/loading-tips');

    expect(VISIBLE_LOADING_TIPS).toHaveLength(LOADING_TIPS.length);
    expect(VISIBLE_LOADING_TIPS.find(tip => tip.id === 'nordvpn')?.url).toBe(
      'https://go.nordvpn.example/TEST'
    );
  });

  it('keeps delays ascending, which is what makes reveal indices match analytics', async () => {
    const { VISIBLE_LOADING_TIPS } = await import('@/config/loading-tips');

    const delays = VISIBLE_LOADING_TIPS.map(tip => tip.delayMs);
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
  });
});

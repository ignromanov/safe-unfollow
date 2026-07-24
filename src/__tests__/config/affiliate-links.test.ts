import { describe, it, expect, afterEach, vi } from 'vitest';

/**
 * `AFFILIATE_LINKS.nordvpn` is resolved from `import.meta.env` at module load,
 * so each case stubs the env and re-imports the module rather than relying on
 * whatever the ambient environment happens to define.
 */
describe('AFFILIATE_LINKS.nordvpn env resolution', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('falls back to an empty string when VITE_NORDVPN_URL is unset', async () => {
    vi.stubEnv('VITE_NORDVPN_URL', undefined);
    vi.resetModules();

    const { AFFILIATE_LINKS } = await import('@/config/affiliate-links');

    // Never undefined: downstream code treats '' as "hide the tip", while
    // undefined means "a tip that carries no link at all".
    expect(AFFILIATE_LINKS.nordvpn).toBe('');
  });

  it('exposes the configured URL when VITE_NORDVPN_URL is set', async () => {
    vi.stubEnv('VITE_NORDVPN_URL', 'https://go.nordvpn.example/TEST');
    vi.resetModules();

    const { AFFILIATE_LINKS } = await import('@/config/affiliate-links');

    expect(AFFILIATE_LINKS.nordvpn).toBe('https://go.nordvpn.example/TEST');
  });
});

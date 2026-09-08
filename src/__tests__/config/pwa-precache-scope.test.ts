import { describe, expect, it } from 'vitest';

import { pwaConfig } from '../../../vite/pwa-config';

/**
 * What the service worker precaches decides what the site may say about offline.
 *
 * GH#224: `docs/roadmap.md` said "176 precached assets", `docs/tech-spec.md` said "cached
 * app shell", eight hero locales said "Works offline." — and `globPatterns` had been
 * `**\/*.{ico,png,svg}` the whole time, 15 icons on production. No test read the config,
 * so a number nobody recomputed stood for months. The copy was narrowed 2026-09-08 to
 * "pages you have already opened keep working with the network off", and that sentence
 * is true *because* of the three facts asserted here.
 *
 * This is not a lock on the config. Widening the precache is a legitimate engineering
 * decision (vera-cto's — it costs bundle bytes and `globIgnores` excludes `assets/**` on
 * purpose). It is a coupling: if the precache ever covers the app shell, this test goes
 * red on purpose so that the offline copy — and the `OFFLINE_CLAIM` gates in
 * `monetization-claims.test.ts` and `structured-data-claims.test.tsx` — are revisited in
 * the same change, instead of the copy staying narrow after the claim became true.
 */
const SHELL_EXTENSIONS = /\b(?:html|js|css|woff2?)\b/;

function precachesShell(
  globPatterns: readonly string[] | undefined,
  navigateFallback: unknown
): boolean {
  return (
    (globPatterns ?? []).some(pattern => SHELL_EXTENSIONS.test(pattern)) ||
    navigateFallback !== null
  );
}

describe('the precache covers icons only, which is why the offline copy is narrowed', () => {
  const workbox = pwaConfig.workbox;

  it('reads a workbox block at all', () => {
    // Guards the guard: an absent block would make every assertion below vacuous.
    expect(workbox).toBeDefined();
  });

  it('the detector goes red on a precache that would cover the shell', () => {
    expect(precachesShell(['**/*.{ico,png,svg}', '**/*.html'], null)).toBe(true);
    expect(precachesShell(['**/*.{js,css}'], null)).toBe(true);
    expect(precachesShell(['**/*.{ico,png,svg}'], 'index.html')).toBe(true);
  });

  it('the detector stays quiet on the icon-only precache', () => {
    expect(precachesShell(['**/*.{ico,png,svg}'], null)).toBe(false);
  });

  it('precaches no HTML, JS, CSS or font, and has no navigation fallback', () => {
    expect(
      precachesShell(workbox?.globPatterns, workbox?.navigateFallback),
      'the precache now covers the app shell — the offline copy narrowed for GH#224 may be ' +
        'widened, and the OFFLINE_CLAIM gates must move with it'
    ).toBe(false);
  });

  it('assets/** stays excluded from the precache on purpose', () => {
    expect(workbox?.globIgnores).toContain('**/assets/**');
  });
});

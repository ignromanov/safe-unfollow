import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * A rejected `initPromise` is cached exactly like a resolved one (src/locales/index.ts), so
 * one transient failure on the English bundle is permanent for the life of the page rather
 * than for the length of the outage — every later `initI18n()` replays the stored rejection
 * without asking the network again. GH#59.
 *
 * English is the case that matters: it is the fallback bundle and is fetched for every visitor
 * in every locale, and unlike the URL language it has no `.catch` (that asymmetry is what
 * locales-init-fallback.test.ts covers from the other side).
 *
 * The mock is the dedicated module rather than the JSON files — Vite compiles the two-variable
 * dynamic import into an internal glob table that a per-file `vi.mock` does not intercept, and
 * loadLanguageResources.ts exists as its own module for exactly this reason. Its own docblock
 * says so.
 */
const chunks = vi.hoisted(() => ({ englishFails: true, calls: 0 }));

vi.mock('@/locales/loadLanguageResources', async () => {
  const { I18N_NAMESPACES } = await import('@/config/languages');
  return {
    loadLanguageResources: vi.fn((lang: string) => {
      chunks.calls += 1;
      if (lang === 'en' && chunks.englishFails) {
        return Promise.reject(new Error('simulated chunk load failure'));
      }
      // Derived from the constant rather than listed here, so a namespace added to
      // I18N_NAMESPACES cannot leave this fixture one key short of what i18next is handed.
      return Promise.resolve(
        Object.fromEntries(I18N_NAMESPACES.map(ns => [ns, { greeting: `hello (${lang})` }]))
      );
    }),
  };
});

describe('initI18n after a failed English bundle', () => {
  beforeEach(() => {
    // Between attempts, not between the two calls inside the test. The cached promise under
    // test lives in module scope, so resetting mid-test would hand the second call a fresh
    // module and pass unconditionally — while not resetting at all leaks a poisoned module
    // into vitest's `retry: 2`, where the first call then rejects without reaching the
    // network and the fixture counts zero fetches.
    vi.resetModules();
    window.history.pushState({}, '', '/');
    chunks.englishFails = true;
    chunks.calls = 0;
  });

  it('asks again once the outage is over, instead of replaying the stored rejection', async () => {
    // vitest.setup.ts stubs @/locales globally (initI18n a no-op); without this the test
    // exercises the stub and passes having driven no production code at all.
    vi.doUnmock('@/locales');
    const locales = await import('@/locales');

    await expect(locales.initI18n({ isClient: true })).rejects.toThrow(
      'simulated chunk load failure'
    );
    const callsWhileFailing = chunks.calls;
    expect(callsWhileFailing).toBeGreaterThan(0); // the instrument fired at all

    chunks.englishFails = false;

    await expect(locales.initI18n({ isClient: true })).resolves.toBeUndefined();
    // A second fetch actually went out. Without this the assertion above could be satisfied
    // by a cached *resolution*, which is not what is being fixed.
    expect(chunks.calls).toBeGreaterThan(callsWhileFailing);
    expect(locales.default.hasResourceBundle('en', 'common')).toBe(true);
  });
});

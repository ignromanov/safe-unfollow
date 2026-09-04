import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Force loadLanguageResources('ru') to reject, simulating a failed chunk fetch for one
// non-English locale. The `.catch` in initI18n's client branch (src/locales/index.ts) is the
// only thing standing between this and a rejected Promise.all that would break i18n
// initialisation for every visitor, not just the one requesting ru — this test exercises that
// path directly rather than trusting the comment.
//
// This mocks the dedicated module (src/locales/loadLanguageResources.ts), not the underlying
// JSON file: an earlier attempt tried `vi.mock('@/locales/ru/common.json', ...)` and it had no
// effect — errorSpy was never called and `i18n.hasResourceBundle('ru', 'common')` came back
// true, meaning the real file loaded anyway. Vite compiles the two-variable dynamic import
// `import(\`./${lang}/${ns}.json\`)` into an internal glob lookup table that Vitest's module
// mock does not intercept per-file. loadLanguageResources was split into its own module for
// exactly this reason — a same-file helper's internal calls bind at compile time and cannot be
// mocked at all.
vi.mock('@/locales/loadLanguageResources', () => ({
  loadLanguageResources: vi.fn((lang: string) =>
    lang === 'ru'
      ? Promise.reject(new Error('simulated chunk load failure'))
      : Promise.resolve({
          common: { greeting: `hello (${lang})` },
          faq: {},
          hero: {},
          howto: {},
          meta: {},
          results: {},
          upload: {},
          wizard: {},
        })
  ),
}));

describe('initI18n client fallback', () => {
  const originalPathname = window.location.pathname;

  beforeEach(() => {
    vi.resetModules();
    window.history.pushState({}, '', '/ru/docs/faq');
  });

  afterEach(() => {
    window.history.pushState({}, '', originalPathname);
  });

  it('still resolves with English available when the URL-language fetch rejects', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // vitest.setup.ts globally stubs @/locales (initI18n as a no-op, hasResourceBundle
    // hardcoded to always return true) for every other test file's convenience. That stub
    // would make this test pass unconditionally without exercising any real code — unmock it
    // so this file drives the actual initI18n implementation.
    vi.doUnmock('@/locales');

    const locales = await import('@/locales');
    const i18n = locales.default;

    await expect(locales.initI18n({ isClient: true })).resolves.toBeUndefined();

    // English loaded and registered — the fallback bundle survives the ru failure.
    expect(i18n.hasResourceBundle('en', 'common')).toBe(true);
    // ru never got registered — the rejected promise did not silently smuggle in partial data.
    expect(i18n.hasResourceBundle('ru', 'common')).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith('Failed to load language: ru', expect.any(Error));

    errorSpy.mockRestore();
  });
});

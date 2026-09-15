import { describe, it, expect } from 'vitest';

import { localeChunkHrefs } from '../../../vite/ssg-meta-injector';

/**
 * Post-merge manifest shape, measured from a real build on 2026-09-15.
 *
 * `manualChunks` groups each language's eight namespace JSONs into one chunk, and Vite then
 * stops emitting the per-source `src/locales/<lang>/<ns>.json` keys this suite used to model:
 * they went 80 -> 0, replaced by ten `_locale-<lang>-<hash>.js` entries. The hash contains
 * dashes, which is why the language is matched by pattern rather than recovered by splitting.
 */
function fixtureManifest(): Record<string, { file: string }> {
  return {
    'index.html': { file: 'assets/app-Ab12Cd34.js' },
    '_locale-en-DO4jB1BK.js': { file: 'assets/locale-en-DO4jB1BK.js' },
    '_locale-id-3b4kPu-t.js': { file: 'assets/locale-id-3b4kPu-t.js' },
  };
}

describe('localeChunkHrefs', () => {
  it('emits one href for an English page', () => {
    // Was 8. The eight namespace chunks weighed 16,695 bytes between them and cost eight
    // requests on every page, against an Edge Request limit already 79% over.
    expect(localeChunkHrefs('en', fixtureManifest())).toEqual(['/assets/locale-en-DO4jB1BK.js']);
  });

  it('emits two for a non-English page, English first', () => {
    // initI18n awaits loadLanguageResources('en') unconditionally and FIRST, then the URL
    // language. Preloading only the URL locale gives priority to the second wave and leaves
    // the actually-gating English chunk cold — a regression for the ~26-36% of pageviews
    // that are not English. Order is load-bearing, so this asserts the array, not a set.
    expect(localeChunkHrefs('id', fixtureManifest())).toEqual([
      '/assets/locale-en-DO4jB1BK.js',
      '/assets/locale-id-3b4kPu-t.js',
    ]);
  });

  it('throws rather than emitting a dead href when the language has no chunk', () => {
    // Load-bearing: a 404 modulepreload is silent in the network panel. This is also the
    // guard that made the chunking change safe — when manualChunks stopped producing
    // per-source manifest keys, this threw and the build failed instead of shipping dead
    // preloads. It is how the manifest shape above came to be measured at all.
    const broken = fixtureManifest();
    delete broken['_locale-id-3b4kPu-t.js'];
    expect(() => localeChunkHrefs('id', broken)).toThrow(/0 chunks matching/);
  });

  it('throws rather than guessing when the language pattern matches two chunks', () => {
    // The control on the other side. A regional code would make `locale-en-*` match both
    // `locale-en-<hash>` and `locale-en-gb-<hash>`, and taking the first would preload the
    // wrong language for some readers while every test above still passed.
    const ambiguous = fixtureManifest();
    ambiguous['_locale-en-gb-XyZ12345.js'] = { file: 'assets/locale-en-gb-XyZ12345.js' };
    expect(() => localeChunkHrefs('en', ambiguous)).toThrow(/2 chunks matching/);
  });
});

import { describe, it, expect } from 'vitest';

import { localeChunkHrefs } from '../../../vite/ssg-meta-injector';

const NAMESPACES = ['common', 'faq', 'hero', 'howto', 'meta', 'results', 'upload', 'wizard'];

function fixtureManifest(): Record<string, { file: string }> {
  const m: Record<string, { file: string }> = {};
  for (const lang of ['en', 'id']) {
    for (const ns of NAMESPACES)
      m[`src/locales/${lang}/${ns}.json`] = { file: `assets/${ns}-${lang}.js` };
  }
  return m;
}

describe('localeChunkHrefs', () => {
  it('emits 8 hrefs for an English page', () => {
    expect(localeChunkHrefs('en', fixtureManifest())).toHaveLength(8);
  });

  it('emits 16 for a non-English page, English first', () => {
    // initI18n awaits loadLanguageResources('en') unconditionally and FIRST, then the
    // URL language. Preloading only the URL locale would give priority to the second
    // wave and leave the actually-gating English chunks cold — a regression for the
    // ~26-36% of pageviews that are not English.
    const hrefs = localeChunkHrefs('id', fixtureManifest());
    expect(hrefs).toHaveLength(16);
    expect(hrefs.slice(0, 8).every(h => h.endsWith('-en.js'))).toBe(true);
  });

  it('throws rather than emitting a dead href when the manifest lacks an entry', () => {
    const broken = fixtureManifest();
    delete broken['src/locales/id/common.json'];
    expect(() => localeChunkHrefs('id', broken)).toThrow(/src\/locales\/id\/common\.json/);
  });
});

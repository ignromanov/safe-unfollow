import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES } from '@/config/languages';

/**
 * The `/upload` subtitle carries one idea, and it is not privacy.
 *
 * It used to read "Your data remains 100% private. We analyze your Instagram
 * ZIP file locally in your browser." — three lines at 390px that repeated
 * "Instagram ZIP" from the h1 one line above, and made the privacy promise
 * that already stands under the button and again in the guide block. That
 * height is what pushed the guide block under the fold.
 *
 * What replaces it is the highest-CTR message the property has measured:
 * "no login" runs at 50-100% CTR on "without login" queries (product.md →
 * Key Marketing Messages). Privacy is still said twice, where it answers a
 * hesitation rather than opening the page.
 */
const BUNDLES = import.meta.glob<Record<string, any>>('../../locales/*/upload.json', {
  eager: true,
  import: 'default',
});

function bundleFor(language: string) {
  const entry = Object.entries(BUNDLES).find(([path]) => path.includes(`/${language}/`));
  if (!entry) throw new Error(`no upload.json for ${language}`);
  return entry[1];
}

// Derived from English (44) with headroom for the morphologically longer
// locales — NOT measured. jsdom performs no layout, so nothing here can see a
// line break. If a locale honestly does not fit, raise this and record the new
// number; do not bend a translation to satisfy a threshold nobody measured.
const MAX_LENGTH = 70;

describe('zone.description', () => {
  it.each(SUPPORTED_LANGUAGES)('%s keeps the subtitle to one idea', language => {
    const text: string = bundleFor(language).zone.description;

    expect(text).toBeTruthy();
    // It no longer repeats the h1. "ZIP" is the h1's own word in nine of the
    // ten locales, and the tenth (ar) never carried it.
    expect(text).not.toMatch(/\bZIP\b/i);
    expect(text.length).toBeLessThanOrEqual(MAX_LENGTH);
  });
});

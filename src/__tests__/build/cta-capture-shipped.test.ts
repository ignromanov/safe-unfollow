import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, it, expect } from 'vitest';

import { SUPPORTED_LANGUAGES } from '@/config/languages';

/**
 * The pre-hydration CTA recorder only works if two things reach the built page: the
 * capture-phase listener from `index.html`, and the `data-cta` attributes it reads
 * (GH#99). Both are asserted at unit level elsewhere — this is the level where the build
 * itself could drop them, by relocating the inline script or stripping the attribute.
 *
 * It matters more than a usual build assertion because there is no second recorder:
 * `Hero.tsx` carries no `onClick`, so a silent break here takes every `hero_cta_*` event
 * with it and reads in the dashboard as a fall in clicks rather than as a bug.
 */
const dist = resolve(__dirname, '../../../dist');
const built = existsSync(dist) && existsSync(join(dist, 'index.html'));

/** Locale home pages — the only prerendered route that renders the hero. */
const HOME_PAGES = SUPPORTED_LANGUAGES.map(lang => (lang === 'en' ? 'index.html' : `${lang}.html`));

describe.runIf(built)('CTA capture reaches the built pages', () => {
  it('ships the listener on every locale home page', () => {
    for (const page of HOME_PAGES) {
      const html = readFileSync(join(dist, page), 'utf-8');
      expect(html, `${page} lost the CTA listener`).toContain('__ctaSink');
      expect(html, `${page} lost the parking key`).toContain('analytics_pending_cta');
    }
  });

  it('marks the three hero CTAs a first-time visitor can see', () => {
    // `continue` is absent by design: it renders only when data is already loaded,
    // which no prerendered page can be.
    for (const page of HOME_PAGES) {
      const html = readFileSync(join(dist, page), 'utf-8');
      const marked = [...html.matchAll(/data-cta="([a-z_-]+)"/g)].map(m => m[1]).sort();
      expect(marked, `${page} is missing a CTA marker`).toEqual([
        'guide',
        'sample',
        'upload_direct',
      ]);
    }
  });

  it('the extractor above can actually see a hyphenated marker — the control', () => {
    // `[a-z_]+` requires the closing quote straight after that run, so a hyphenated value
    // (an intent-page slug, e.g. "who-doesnt-follow-me-back") yields no match at all, and
    // the assertion above is a whitelist — an escaped marker leaves the array exactly equal
    // to what is expected. A synthetic marker, not a real slug, so this keeps working if the
    // slugs are renamed.
    const marked = [...'<a data-cta="a-b">'.matchAll(/data-cta="([a-z_-]+)"/g)].map(m => m[1]);
    expect(marked).toEqual(['a-b']);
  });
});

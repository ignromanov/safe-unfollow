import { describe, it, expect } from 'vitest';
import { INTENT_PAGES } from '@/config/intent-pages';
import { BADGE_ORDER } from '@/core/badges';
import meta from '@/locales/en/meta.json';
import resultsEN from '@/locales/en/results.json';
import { INTENT_CONTENT } from '@/pages/intent-content';
import { SUPPORTED_LANGUAGES } from '@/config/languages';
import { HERO_CTA_KEYS } from '@/lib/stats/cta-capture';

/**
 * The slug travels twice: as the URL, and as the `?from=` value the results page reads back
 * through readArrivalSource(). That reader validates against this exact pattern, so a slug
 * outside it would 200 as a page and arrive as `arrived_from: null` with nothing saying so.
 */
const ARRIVAL_SLUG = /^[a-z0-9-]{1,40}$/;

describe('INTENT_PAGES', () => {
  it('should list three pages', () => {
    expect(INTENT_PAGES).toHaveLength(3);
  });

  it('should name only real badges', () => {
    for (const page of INTENT_PAGES) {
      expect(BADGE_ORDER).toContain(page.badge);
    }
  });

  it('should use slugs the arrival reader accepts', () => {
    for (const page of INTENT_PAGES) {
      expect(page.slug).toMatch(ARRIVAL_SLUG);
    }
  });

  it('should not repeat a slug or a badge', () => {
    expect(new Set(INTENT_PAGES.map(p => p.slug)).size).toBe(INTENT_PAGES.length);
    expect(new Set(INTENT_PAGES.map(p => p.badge)).size).toBe(INTENT_PAGES.length);
  });

  it('should give every page a distinct h1', () => {
    expect(new Set(INTENT_PAGES.map(p => p.h1)).size).toBe(INTENT_PAGES.length);
  });

  it('should give every page a distinct short label that reads inside a sentence', () => {
    const labels = INTENT_PAGES.map(p => p.shortLabel);
    expect(new Set(labels).size).toBe(labels.length);
    // Lower case and no trailing punctuation: these are rendered mid-sentence, and a capital
    // or a full stop in the manifest would show up as one on the home page.
    for (const label of labels) {
      expect(label).toBe(label.toLowerCase());
      expect(label).not.toMatch(/[.!?]$/);
    }
  });

  it('should not use a slug that reads as a language prefix', () => {
    // useLanguagePrefix() reads the first path segment; for these single-segment routes that
    // is the slug itself. A slug equal to a language code would make every link on the page
    // resolve into that locale.
    for (const page of INTENT_PAGES) {
      expect(SUPPORTED_LANGUAGES).not.toContain(page.slug);
      expect(page.slug).not.toContain('/');
    }
  });

  it('should not collide with a hero CTA slug', () => {
    // Task 6 puts the slug in `data-cta`, where the pre-hydration listener reads one flat
    // namespace shared with the hero keys. A page slugged `sample` would be recorded as a
    // hero CTA and would write `entry_cta`, silently, on a live series. Derived from
    // HERO_CTA_KEYS rather than hand-listed, so a fifth hero CTA cannot slip past this gate.
    for (const page of INTENT_PAGES) {
      expect(HERO_CTA_KEYS).not.toContain(page.slug);
    }
  });
});

describe('intent pages do not cannibalise each other or the property', () => {
  const routes = meta.routes as Record<string, { title: string }>;

  it('should give every intent page a routes entry', () => {
    for (const page of INTENT_PAGES) {
      expect(routes[`/${page.slug}`]?.title).toBeTruthy();
    }
  });

  it('should not repeat a title inside meta.json', () => {
    // Every title the property serves from this file — the intent pages' and everyone else's.
    const titles = [meta.title, ...Object.values(routes).map(r => r.title)];
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('should not share a section heading between two pages', () => {
    const headings = INTENT_PAGES.flatMap(p => INTENT_CONTENT[p.slug].sections.map(s => s.heading));
    expect(new Set(headings).size).toBe(headings.length);
  });

  it('should not share a call to action between two pages', () => {
    const labels = INTENT_PAGES.map(p => INTENT_CONTENT[p.slug].ctaLabel);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('should name each badge exactly as the English locale spells it', () => {
    // badgeLabel is a literal because intent-pages.ts may hold no runtime import and these
    // pages are English-only — and because an unresolved i18n key renders as the key itself on
    // a prerendered public page with nothing to flag it (GH#78). Two copies of one fact are
    // acceptable only while something binds them; this is that something.
    for (const page of INTENT_PAGES) {
      expect(resultsEN.badges[page.badge]).toBe(page.badgeLabel);
    }
  });

  it('should answer all four questions on every page', () => {
    // The four sections are the page's contract with the reader — see IntentContent's doc
    // comment. A page that ships with three is the thin-content shape this page class is
    // judged on, and until now only the comment said so.
    for (const page of INTENT_PAGES) {
      expect(INTENT_CONTENT[page.slug].sections.length).toBeGreaterThanOrEqual(4);
    }
  });
});

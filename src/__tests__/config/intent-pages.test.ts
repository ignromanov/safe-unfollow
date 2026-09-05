import { describe, it, expect } from 'vitest';
import { INTENT_PAGES } from '@/config/intent-pages';
import { BADGE_ORDER } from '@/core/badges';

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

  it('should not collide with a hero CTA slug', () => {
    // Task 6 puts the slug in `data-cta`, where the pre-hydration listener reads one flat
    // namespace shared with the four hero keys. A page slugged `sample` would be recorded as a
    // hero CTA and would write `entry_cta`, silently, on a live series.
    const heroKeys = ['guide', 'sample', 'upload_direct', 'continue'];
    for (const page of INTENT_PAGES) {
      expect(heroKeys).not.toContain(page.slug);
    }
  });
});

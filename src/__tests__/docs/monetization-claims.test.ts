import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const DOCS_ROOT = join(process.cwd(), 'docs');

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return entry === 'assets' ? [] : markdownFiles(full);
    return full.endsWith('.md') ? [full] : [];
  });
}

const DOCS = markdownFiles(DOCS_ROOT).map(path => ({
  name: relative(DOCS_ROOT, path),
  text: readFileSync(path, 'utf-8'),
}));

/**
 * Claims that were true when written and stopped being true without anyone
 * editing the sentence.
 *
 * This is not hypothetical. `84b0cca` had to correct a footer that still said
 * the tool was ad-free eleven days after AdSense went live, and this same
 * roadmap went on claiming "No ads or sponsored content" for longer. A docs
 * page is exactly where a sceptical reader goes to check a promise, so a stale
 * promise there costs more than the revenue that broke it.
 *
 * A blanket denial is banned rather than policed: if a future page needs to say
 * something precise about ads — which surface, which vendor, what they receive —
 * it can, and this test will not object. What it refuses is the sweeping version
 * that goes false the moment any surface is sold.
 */
const BANNED = [
  { pattern: /no paywalls?/i, why: 'a $7 export unlock is a paywall' },
  { pattern: /no "?premium"? features?/i, why: 'the export is a paid feature' },
  { pattern: /no ads\b/i, why: 'AdSense units ship on / and /results' },
  { pattern: /no sponsored content/i, why: '/upload carries an affiliate placement' },
  { pattern: /remains completely free/i, why: 'the file export is paid' },
  { pattern: /free forever/i, why: 'true of the analysis, read as true of everything' },
];

/**
 * The same failure one document over, found 2026-08-09.
 *
 * `42862d3` swept the docs for claims monetization had falsified and fixed every one
 * it found — but it was reading for *money*. These sentences went false at the same
 * instant, for the same reason, and it walked past them: `privacy.md` denied
 * advertising integrations and tracking cookies, `tech-spec.md` said "No cookies",
 * `roadmap.md` said "No data sharing with external services". All three were false
 * from the day AdSense shipped.
 *
 * They live in this file rather than a new one because they are not a second subject:
 * the class is "a claim that stopped being true without anyone editing the sentence",
 * and the surface that falsifies it is the same revenue surface as above.
 *
 * Same rule as the monetization list: a precise statement about a named third party is
 * allowed and this test will not object. What is banned is the sweeping form, which
 * goes false the moment any third party is added.
 */
const BANNED_PRIVACY = [
  { pattern: /no advertising/i, why: 'AdSense serves ads on / and /results' },
  { pattern: /no tracking cookies?/i, why: 'AdSense sets ad cookies once consent is given' },
  { pattern: /no data sharing/i, why: 'Umami receives events, AdSense receives ad requests' },
  { pattern: /no network requests? after/i, why: 'ad fills, /api/batch and the licence API all run after load' },
];

/**
 * Two privacy policies on one origin drifted apart twice: PR #15 (AdSense) and PR #11
 * (Dodo, affiliates) both updated the React page at /privacy and left this Jekyll copy
 * at /docs/privacy/ asserting the opposite — same domain, opposite claims, both indexed.
 *
 * The fix was to stop having two, so the ceiling below is the actual guard: a page that
 * points at the canonical policy cannot drift from it, and a page that restates the
 * policy will not fit. The old copy was 5,089 bytes. Raising this is allowed, but it has
 * to be a decision, not a side effect.
 */
const CANONICAL_PRIVACY_URL = /safeunfollow\.app\/privacy/;
const DOCS_PRIVACY_MAX_BYTES = 3500;

describe('docs monetization claims', () => {
  it('finds documentation to check', () => {
    expect(DOCS.length).toBeGreaterThan(5);
  });

  for (const { pattern, why } of BANNED) {
    it(`never claims ${String(pattern)} — ${why}`, () => {
      const offenders = DOCS.filter(doc => pattern.test(doc.text)).map(doc => doc.name);

      expect(offenders, `${offenders.join(', ')} — ${why}`).toEqual([]);
    });
  }

  for (const { pattern, why } of BANNED_PRIVACY) {
    it(`never claims ${String(pattern)} — ${why}`, () => {
      const offenders = DOCS.filter(doc => pattern.test(doc.text)).map(doc => doc.name);

      expect(offenders, `${offenders.join(', ')} — ${why}`).toEqual([]);
    });
  }

  it('keeps exactly one privacy policy, and it is not this one', () => {
    const doc = DOCS.find(entry => entry.name === 'privacy.md');

    expect(doc, 'docs/privacy.md exists').toBeDefined();
    expect(doc!.text, 'points at the canonical policy').toMatch(CANONICAL_PRIVACY_URL);
    expect(
      Buffer.byteLength(doc!.text, 'utf-8'),
      'short enough that it cannot be a second policy'
    ).toBeLessThan(DOCS_PRIVACY_MAX_BYTES);
  });

  // The comparison pages are the ones that put a number in a Price row next to a
  // competitor's monthly fee. A reader comparing prices there must be able to
  // see ours, not discover it at a checkout.
  it('discloses the export price on every page that compares prices', () => {
    const priceTables = DOCS.filter(doc => /\|\s*\*\*Price\*\*\s*\|/.test(doc.text));

    expect(priceTables.length, 'comparison pages with a Price row').toBe(3);
    for (const doc of priceTables) {
      expect(doc.text, `${doc.name} states the export price`).toMatch(/\$7/);
    }
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, it, expect } from 'vitest';

import { NON_ENGLISH_LANGUAGES } from '@/config/languages';

/**
 * The language-redirect script in index.html runs before the bundle loads, so it
 * is unreachable from jsdom — nothing in the component tree ever executes it.
 * These assertions therefore work on the file as text. That is the only level at
 * which this code can be guarded at all.
 */
const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf-8');

/** The IIFE between the `<script>` tags that carries the redirect. */
const redirectScript = (() => {
  const match = html.match(/<script>\s*\(function\s*\(\)\s*\{[\s\S]*?\}\)\(\);\s*<\/script>/);
  if (!match) throw new Error('language-redirect script not found in index.html');
  return match[0];
})();

describe('index.html language redirect', () => {
  it('carries the query string and hash through every redirect', () => {
    // A redirect built from location.pathname alone silently drops ?utm_*, ?gclid
    // and the ?license_key= parameter the checkout return depends on. Losing them
    // is invisible: the visitor lands on a working page, and the attribution is
    // gone before any analytics code has run.
    //
    // The pattern covers `location.href =`, `window.location =`, `location.assign(...)`
    // and `location.replace(...)`. Matching only `location.href =` would let a refactor
    // to one of the other forms slip a query-string-dropping redirect past this guard.
    const assignments = redirectScript.match(
      /\blocation(?:\.href\s*=|\s*=|\.(?:assign|replace)\()[^;]+;/g
    );

    // String.match returns null, not undefined, when nothing matches — assert on
    // non-null so a deleted redirect fails here instead of passing vacuously.
    expect(assignments, 'no redirect statement found in the script').not.toBeNull();
    expect(assignments?.length).toBeGreaterThan(0);
    for (const assignment of assignments ?? []) {
      expect(assignment, 'redirect must preserve the query string').toContain('location.search');
      expect(assignment, 'redirect must preserve the hash').toContain('location.hash');
    }
  });

  it('lists exactly the non-English languages the app actually ships', () => {
    // The array is hand-maintained and carries a "SYNC with languages.ts" comment
    // that nothing enforced. Drifting high sends visitors to a locale that no
    // longer exists; drifting low strands a shipped locale behind the English page.
    const match = redirectScript.match(/var NON_EN_LANGS\s*=\s*\[([^\]]*)\]/);
    expect(match, 'NON_EN_LANGS array not found').not.toBeNull();

    const inHtml = (match?.[1] ?? '')
      .split(',')
      .map(entry => entry.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);

    expect([...inHtml].sort()).toEqual([...NON_ENGLISH_LANGUAGES].sort());
  });

  it('never guesses a language from the browser', () => {
    // A guessed redirect costs a non-English visitor a full extra document load —
    // measured: 2 main-frame navigations and ~130 KB downloaded and discarded, on mobile
    // data, before the 3.7s dead window even starts. An explicit choice is a promise and
    // stays; a guess is not, and goes.
    expect(redirectScript).not.toContain('navigator.language');
  });

  it('still honours an explicitly stored language choice', () => {
    // The other half of the same decision: deleting the whole script would break the one
    // case the product actually promised.
    expect(redirectScript).toContain('storedLang');
  });
});

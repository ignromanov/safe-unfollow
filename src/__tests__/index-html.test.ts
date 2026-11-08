import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, it, expect } from 'vitest';

import { NON_ENGLISH_LANGUAGES } from '@/config/languages';
import { FUNDING_CHOICES_SCRIPT_SRC, GA4_MEASUREMENT_ID, GA4_SCRIPT_ID } from '@/lib/ga4-loader';
import { TRACKING_OPT_OUT_KEY } from '@/lib/stats/constants';
import { PENDING_CTA_KEY } from '@/lib/stats/cta-capture';

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

/**
 * The CTA listener has the same problem as the redirect above — it runs before the
 * bundle, so nothing in jsdom executes it — with a sharper consequence: it is now the
 * *only* recorder of a hero CTA click. `Hero.tsx` carries no `onClick` at all, so a
 * silent break here takes every hero CTA event with it and looks exactly like a drop in
 * clicks. These assertions are the only guard that exists at this level.
 */
const ctaScript = (() => {
  const scripts = html.match(/<script>[\s\S]*?<\/script>/g) ?? [];
  const found = scripts.find(script => script.includes('data-cta'));
  if (!found) throw new Error('CTA capture script not found in index.html');
  return found;
})();

describe('index.html CTA capture', () => {
  it('listens in the capture phase, so nothing can stop the click before it', () => {
    // Bubble phase would put the listener behind any handler that calls
    // stopPropagation, and behind React's own root listener once hydrated.
    expect(ctaScript).toMatch(/addEventListener\(\s*['"]click['"][\s\S]*?,\s*true\s*\)/);
  });

  it('parks the click under the key the app drains', () => {
    // The two halves live in different files and different languages; a rename on
    // either side silently strands every pre-hydration click.
    expect(ctaScript).toContain(PENDING_CTA_KEY);
  });

  it('hands the click straight to the app when the app is up', () => {
    // Without this branch a hydrated click would be parked and replayed on the next
    // page load instead of recorded where it happened — or double-counted.
    expect(ctaScript).toContain('__ctaSink');
  });

  it('honours the analytics opt-out before writing anything', () => {
    // enqueueEvent checks this key on every call. New code that stores a click for a
    // visitor who opted out would be writing where the rest of analytics does not.
    expect(ctaScript).toContain(TRACKING_OPT_OUT_KEY);
  });
});

const gaScript = (() => {
  const scripts = html.match(/<script>[\s\S]*?<\/script>/g) ?? [];
  const found = scripts.find(script => script.includes(GA4_MEASUREMENT_ID));
  if (!found) throw new Error('GA4 head bootstrap script not found in index.html');
  return found;
})();

describe('index.html GA4 & Funding Choices <head> bootstrap', () => {
  it('runs after the language redirect so redirected visits do not double-fire', () => {
    expect(html.indexOf(redirectScript)).toBeLessThan(html.indexOf(gaScript));
  });

  it('uses standard window.dataLayer without &l= queue renaming so Funding Choices CMP connects', () => {
    expect(gaScript).toContain('window.dataLayer');
    expect(gaScript).toContain(GA4_SCRIPT_ID);
    expect(gaScript).not.toContain('&l=');
  });

  it('honours umami-opt-out and sets the ga-disable kill switch before injecting any script', () => {
    expect(gaScript).toContain(TRACKING_OPT_OUT_KEY);
    expect(gaScript).toContain("window['ga-disable-' + GA_ID] = true");
  });

  it('strips Dodo checkout PII from page_location copy without mutating window.location (GH#312)', () => {
    for (const param of ['license_key', 'payment_id', 'subscription_id', 'status', 'email']) {
      expect(gaScript).toContain(`'${param}'`);
    }
    expect(gaScript).toContain('page_location: cleanUrl');
    // Must not overwrite location.href or history.replaceState before stripCheckoutReturnParams() runs.
    expect(gaScript).not.toMatch(/location\.(?:href|replace|assign)\s*[=(]/);
    expect(gaScript).not.toContain('replaceState');
  });

  it('loads standalone Funding Choices CMP everywhere except /sample and /:lang/sample (§5.4)', () => {
    expect(gaScript).toContain(FUNDING_CHOICES_SCRIPT_SRC);
    expect(gaScript).toContain('googlefcPresent');
    expect(gaScript).toMatch(
      /!\s*\/\(\?:\^\|\\\/\)sample\(\?:\\\/\|\$\)\/\.test\(location\.pathname\)/
    );
  });
});

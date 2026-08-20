import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { describe, it, expect } from 'vitest';

/**
 * Every page on this site ships as prerendered HTML that is completely inert until React
 * hydrates. During that window a `<button onClick={navigate(...)}>` does nothing at all,
 * while an `<a href>` navigates — so a control that leads somewhere must be an anchor.
 *
 * This replaces a test that asserted four literal `href` strings in four named files. It
 * was satisfied by the output it was written against and permitted any number of NEW dead
 * buttons; it constrained only the paths already fixed.
 *
 * The invariant here is the other way round: enumerate every button-like control in the
 * prerendered output and require each one to be accounted for. A control that toggles
 * something in place is identified structurally — `aria-expanded` means it controls a
 * disclosure, not a destination — and everything else must be named in ALLOWED with a
 * reason. Adding a navigational button anywhere in the tree fails this test.
 *
 * ALLOWED is also asserted to be exhausted, so it cannot rot: converting the wizard
 * removes those entries, and leaving a stale one fails just as loudly.
 */

const LOCALES = ['ar', 'de', 'es', 'fr', 'id', 'ja', 'pt', 'ru', 'tr'];

/** Controls that are legitimately buttons: they act, they do not navigate. */
const ACTIONS: Record<string, string> = {
  'System Mode': 'theme toggle — cycles system/light/dark in place',
  'Disable anonymous analytics': 'analytics opt-out toggle',
  'Add Reminder to Calendar': 'generates and downloads an .ics file',
};

/**
 * Controls that DO navigate and are still buttons. Every one of these is dead during the
 * pre-hydration window. They are grouped rather than fixed here because each one receives
 * its destination as a callback prop from a parent, so converting them is a design change
 * about where the destination lives — GH#50, one issue rather than seven.
 *
 * Delete an entry here in the same commit that converts its control: the stale-entry test
 * below fails otherwise, so this list can only shrink.
 */
const KNOWN_DEAD: Record<string, string> = {
  'Back to Home': 'PrivacyPolicy / Terms — onBack prop',
  'See the step-by-step guide': 'UploadZone — onOpenWizard prop',
  'Not sure what to upload? See the guide': 'UploadZone — onOpenWizard prop',
  'Learn how to fix': 'UploadZone — onOpenWizard prop',
};

const ALLOWED = { ...ACTIONS, ...KNOWN_DEAD };

const root = resolve(__dirname, '../../..');
const dist = join(root, 'dist');

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full);
    return entry.name.endsWith('.html') ? [full] : [];
  });
}

function englishPages(): string[] {
  const localeDir = new RegExp(`^(${LOCALES.join('|')})(/|\\.html$)`);
  return htmlFiles(dist).filter(f => !localeDir.test(relative(dist, f)));
}

interface Control {
  page: string;
  identity: string;
}

/** Every `<button>` and `role="button"` element, minus in-place disclosure toggles. */
function controls(file: string): Control[] {
  const html = readFileSync(file, 'utf-8');
  const page = relative(dist, file);
  const found: Control[] = [];

  for (const match of html.matchAll(/<([a-z]+)\b([^>]*)>/g)) {
    const [openTag, tag, attrs] = match;
    if (tag !== 'button' && !attrs.includes('role="button"')) continue;
    // A control that owns an expanded/collapsed state is a disclosure or a menu. It
    // cannot be a destination, so it needs no allow-list entry.
    if (attrs.includes('aria-expanded')) continue;

    const label = /aria-label="([^"]*)"/.exec(attrs) ?? /title="([^"]*)"/.exec(attrs);
    if (label) {
      found.push({ page, identity: label[1] });
      continue;
    }

    // Fall back to the visible text. Non-nesting elements only (a <button> cannot
    // contain a <button>), so the first closing tag is this element's.
    const start = match.index + openTag.length;
    const end = html.indexOf(`</${tag}>`, start);
    const inner = end === -1 ? '' : html.slice(start, end);
    found.push({
      page,
      identity: inner
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    });
  }
  return found;
}

const built = existsSync(dist) && existsSync(join(dist, 'index.html'));

/**
 * Walked lazily, inside the tests. `describe.runIf` marks a suite skipped but still RUNS
 * its callback during collection, so touching the filesystem in the suite body throws
 * ENOENT in every CI job that does not build first — which is two of the three.
 */
let scanned: { pages: string[]; all: Control[] } | null = null;
function scan(): { pages: string[]; all: Control[] } {
  if (scanned === null) {
    const pages = englishPages();
    scanned = { pages, all: pages.flatMap(controls) };
  }
  return scanned;
}

describe.runIf(built)('prerendered controls', () => {
  it('scans the English prerendered pages, and there are some to scan', () => {
    // Guards the guard: a glob that silently matched nothing would report success.
    const { pages, all } = scan();
    expect(pages.length).toBeGreaterThan(10);
    expect(all.length).toBeGreaterThan(10);
  });

  it('has no button-like control that is not accounted for', () => {
    const { all } = scan();
    const unaccounted = all.filter(c => !(c.identity in ALLOWED));
    expect(
      unaccounted.map(c => `${c.page}: ${c.identity || '(no label, no text)'}`),
      'A new button-like control reached the prerendered HTML. If it navigates, make it a ' +
        'PrefixedLink — it is dead until React hydrates. If it acts in place, add it to ' +
        'ACTIONS with a reason.'
    ).toEqual([]);
  });

  it('does not carry a stale allow-list entry', () => {
    const seen = new Set(scan().all.map(c => c.identity));
    const stale = Object.keys(ALLOWED).filter(identity => !seen.has(identity));
    expect(stale, 'These controls no longer exist. Remove them from the allow-list.').toEqual([]);
  });
});

/**
 * `useLanguagePrefix` reads `useLocation()`, which during SSG resolves against the static
 * router. A regression there would emit English hrefs into every localized page with no
 * runtime symptom whatsoever — the site would still work, and every non-English visitor
 * would be silently dropped into the English funnel.
 */
const HREF_CASES = [
  { page: 'index.html', prefix: '' },
  { page: 'id.html', prefix: '/id' },
  { page: 'ru.html', prefix: '/ru' },
  { page: 'ar.html', prefix: '/ar' },
];

/** Destinations that must appear as real anchors on the landing page. */
const LANDING_HREFS = ['/wizard/step/1', '/sample', '/upload', '/'];

const hrefBuilt = HREF_CASES.every(c => existsSync(join(dist, c.page)));

describe.runIf(hrefBuilt)('prerendered CTA hrefs', () => {
  it.each(HREF_CASES)(
    '$page carries localized anchors for every landing CTA',
    ({ page, prefix }) => {
      const html = readFileSync(join(dist, page), 'utf-8');
      for (const href of LANDING_HREFS) {
        // The home link must carry NO trailing slash: vercel.json sets trailingSlash:false,
        // so `/ru/` is a 308 to `/ru` — a wasted round trip in the very window these
        // anchors exist to serve. English has no prefix, so it stays plain `/`.
        const expected = href === '/' ? prefix || '/' : `${prefix}${href}`;
        expect(html, `${page} is missing href="${expected}"`).toContain(`href="${expected}"`);
      }
    }
  );
});

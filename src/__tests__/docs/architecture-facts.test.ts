import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES } from '@/config/languages';

const ROOT = process.cwd();

/**
 * Facts about this codebase that documentation keeps restating — and getting wrong.
 *
 * The 2026-08-14 architecture audit found the prerendered page count written down in
 * six places with four different values (88, 80, 72, and "10 locales x 8 routes"), none
 * of them right. They were not typos. Each author copied the number from another
 * document instead of deriving it from the config, so one original mistake — forgetting
 * that `includedRoutes` adds eight wizard steps per language — propagated everywhere and
 * then drifted. One of those wrong numbers reached an engineering plan, which reasoned
 * about a defect's blast radius as "all 80 prerendered pages" when it was 160.
 *
 * The fix is not to correct the six copies. It is to make the number derivable, assert
 * the derivation here, and let this test fail the moment a locale or route is added
 * without the documentation following. A fact that a test computes cannot silently rot.
 *
 * SCOPE, stated honestly: the architecture registries live in `.claude/architecture/`,
 * which is a symlink into the separate private `.ai/` repository. That path does not
 * exist in a fresh checkout, in a git worktree, or in CI, so this test cannot read them
 * and does not pretend to. It guards the documentation that ships inside this repository
 * and gives the private registries one authoritative number to be checked against.
 */

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    if (entry === 'node_modules' || entry === 'assets' || entry.startsWith('.')) return [];
    const full = join(dir, entry);
    return statSync(full).isDirectory()
      ? markdownFiles(full)
      : full.endsWith('.md')
        ? [full]
        : [];
  });
}

/**
 * Release histories are excluded from the staleness scans. A changelog entry records what
 * a version shipped and what was believed at the time; correcting it in place destroys the
 * record rather than fixing an error. Present-tense claims about the product are in scope.
 */
const HISTORY = /(?:roadmap|changelog|release[-_]notes)\.md$/i;

const TRACKED_DOCS = [
  ...markdownFiles(join(ROOT, 'src')),
  ...markdownFiles(join(ROOT, 'docs')),
  join(ROOT, 'README.md'),
]
  .filter(path => !HISTORY.test(path))
  .map(path => ({ name: relative(ROOT, path), text: readFileSync(path, 'utf-8') }));

// --- Derivations. Each reads the file that actually decides the value. ---

const routesSource = readFileSync(join(ROOT, 'src/routes.tsx'), 'utf-8');
const viteConfigSource = readFileSync(join(ROOT, 'vite.config.ts'), 'utf-8');
const storeSource = readFileSync(join(ROOT, 'src/lib/store.ts'), 'utf-8');

/**
 * Routes vite-react-ssg will prerender for one language. It walks the route tree and
 * drops any path containing ':' or '*' (DefaultIncludedRoutes), which is always applied
 * even when a project supplies its own `includedRoutes`.
 */
function prerenderableRoutesPerLanguage(): number {
  const children = routesSource.match(/createPageChildren\(\)[\s\S]*?return \[([\s\S]*?)\];/);
  if (!children) throw new Error('createPageChildren() not found in src/routes.tsx');

  return children[1]
    .split('\n')
    .filter(line => /\bindex:\s*true|\bpath:\s*'/.test(line))
    .filter(line => !line.includes(':stepId') && !line.includes("'*'")).length;
}

/** Concrete wizard-step pages vite.config.ts adds back, per language. */
function wizardStepsPerLanguage(): number {
  const match = viteConfigSource.match(/wizardSteps\s*=\s*Array\.from\(\{\s*length:\s*(\d+)/);
  if (!match) throw new Error('wizardSteps length not found in vite.config.ts');
  return Number(match[1]);
}

/** Field names declared on the Zustand `AppState` interface (state, not actions). */
function storeStateFields(): string[] {
  const body = storeSource.match(/interface AppState \{([\s\S]*?)\n\}/);
  if (!body) throw new Error('AppState interface not found in src/lib/store.ts');

  return body[1]
    .split('\n')
    // Exactly two spaces of indent: deeper lines are the nested object literal in
    // setUploadInfo's parameter, which are not store fields.
    .map(line => /^ {2}(_?[A-Za-z][A-Za-z0-9_]*)\??:\s*(.+)$/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .filter(([, , type]) => !type.includes('(') && !type.includes('=>')) // actions
    .map(([, name]) => name);
}

const LANGUAGES = SUPPORTED_LANGUAGES.length;
const STATIC_ROUTES = prerenderableRoutesPerLanguage();
const WIZARD_STEPS = wizardStepsPerLanguage();
const PRERENDERED_ROUTES = LANGUAGES * (STATIC_ROUTES + WIZARD_STEPS);

describe('architecture facts — derived, not copied', () => {
  it('finds documentation to check', () => {
    // Guards the scanner itself: zero offenders must mean "nothing wrong", never
    // "nothing read". Every negative result below depends on this passing.
    expect(TRACKED_DOCS.length).toBeGreaterThan(3);
  });

  it('derives the prerendered route count from config', () => {
    expect(LANGUAGES).toBeGreaterThan(0);
    expect(STATIC_ROUTES).toBeGreaterThan(0);
    expect(WIZARD_STEPS).toBeGreaterThan(0);

    // 10 languages x (8 static + 8 wizard steps). Change a locale or a route and this
    // fails on purpose — update .claude/architecture/*, CLAUDE.md and product.md too.
    expect({ LANGUAGES, STATIC_ROUTES, WIZARD_STEPS, PRERENDERED_ROUTES }).toEqual({
      LANGUAGES: 10,
      STATIC_ROUTES: 8,
      WIZARD_STEPS: 8,
      PRERENDERED_ROUTES: 160,
    });
  });

  it('no shipped document states a stale prerendered page count', () => {
    // `\+?` is load-bearing. "80+ pre-rendered pages" escaped this scanner for months on
    // punctuation alone — the digits are followed by a plus, not by the whitespace the
    // pattern demanded, so the one document that hedged its stale number was the one
    // document the guard could not read. A hedge is not a disclaimer; `80+` still asserts
    // a floor, and the floor was wrong.
    const stale = /(\d+)\+?\s+(?:prerendered|pre-rendered)\s+(?:HTML\s+)?pages?/gi;

    const offenders = TRACKED_DOCS.flatMap(doc =>
      [...doc.text.matchAll(stale)]
        .filter(match => Number(match[1]) !== PRERENDERED_ROUTES)
        .map(match => `${doc.name}: "${match[0]}"`)
    );

    expect(
      offenders,
      `real count is ${PRERENDERED_ROUTES} (${LANGUAGES} languages x ${STATIC_ROUTES + WIZARD_STEPS} pages)`
    ).toEqual([]);
  });

  it('routes.tsx does not claim /results is unprerendered', () => {
    // /results is a static child route, so it prerenders like any other and
    // dist/<lang>/results.html ships. Its content is the Hero fallback, because
    // useInstagramData() has no data during SSG — that is a different statement.
    // A comment claiming it is not prerendered sent the registry the wrong way once
    // already, and hides that the HTML is real SSG surface. See GH#44.
    const denial = /\/results[^\n]*not\s+prerendered/i;

    expect(denial.test(routesSource), 'src/routes.tsx').toBe(false);
  });

  it('the Zustand store holds exactly the documented state fields', () => {
    // CLAUDE.md's "ALLOWED" list is the architecture contract (UI state only, no account
    // data). It listed `theme`, which has never existed in this store — theme lives in
    // theme-provider.tsx via next-themes — while omitting `currentFileName` and
    // `_hasHydrated`, which do. Adding a field here without updating that list is what
    // this assertion is for.
    expect(storeStateFields().sort()).toEqual(
      [
        '_hasHydrated',
        'currentFileName',
        'fileDiscovery',
        'fileMetadata',
        'filters',
        'language',
        'parseWarnings',
        'uploadError',
        'uploadStatus',
      ].sort()
    );
  });

  it('no shipped document presents an unmeasured speedup as achieved', () => {
    // 32x is an arithmetic identity asserted in performance/filter-optimization.test.ts,
    // which never calls the filter engine. 40x and 75x have no derivation anywhere in
    // this repository. The only 1M-scale test mocks IndexedDB entirely and asserts
    // <500ms. None of these may be restated as a measurement; say "design target".
    const achieved = /\b(?:achieved|measured|benchmarked)\b[^.\n]{0,40}\b\d+x\b/i;

    const offenders = TRACKED_DOCS.filter(doc => achieved.test(doc.text)).map(doc => doc.name);

    expect(
      offenders,
      'state these as design targets — see FILTER_OPTIMIZATION.md "Provenance"'
    ).toEqual([]);
  });
});

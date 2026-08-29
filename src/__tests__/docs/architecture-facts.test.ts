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
const storeSource = readFileSync(join(ROOT, 'src/lib/store.ts'), 'utf-8');
const viteConfigSource = readFileSync(join(ROOT, 'vite.config.ts'), 'utf-8');

/**
 * The `includedRoutes` hook, whitespace-collapsed onto one line.
 *
 * The prerendered count has TWO sources, not one. `routes.tsx` declares the route
 * tree, and this hook can hand vite-react-ssg pages the route tree never declares —
 * which is precisely what it did until GH#102, adding eight `/wizard/step/N` pages per
 * language. So `LANGUAGES x STATIC_ROUTES` is the whole count only while the hook
 * contributes nothing of its own, and that is a fact about a second file.
 */
function includedRoutesHook(): string {
  // Non-greedy to the first `}`: the body has no nested braces today, and anything
  // that introduces one stops the match early and changes the string — which is the
  // failure this is here to cause.
  const hook = viteConfigSource.match(/includedRoutes\([\s\S]*?\}/);
  if (!hook) throw new Error('includedRoutes() not found in vite.config.ts');

  return hook[0].replace(/\s+/g, ' ');
}

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
    .filter(line => !/path:\s*'[^']*[:*]/.test(line)).length;
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
const PRERENDERED_ROUTES = LANGUAGES * STATIC_ROUTES;

describe('architecture facts — derived, not copied', () => {
  it('finds documentation to check', () => {
    // Guards the scanner itself: zero offenders must mean "nothing wrong", never
    // "nothing read". Every negative result below depends on this passing.
    expect(TRACKED_DOCS.length).toBeGreaterThan(3);
  });

  it('derives the prerendered route count from config', () => {
    expect(LANGUAGES).toBeGreaterThan(0);
    expect(STATIC_ROUTES).toBeGreaterThan(0);

    // 10 languages x 7 static routes. Change a locale or a route and this fails on
    // purpose — update .claude/architecture/*, CLAUDE.md and product.md too.
    //
    // There used to be a second term here: vite.config.ts `includedRoutes` added eight
    // concrete `/wizard/step/N` pages per language, and the count was 10 x (8 + 8) =
    // 160. Those routes are gone (GH#102) and the hook adds nothing back, so the
    // derivation has one term again — and "adds nothing back" is asserted by the next
    // test rather than believed, because a hook that grows a term would otherwise ship
    // more pages than this number while every document repeating it stayed green.
    // `?guide=1` and `?step=N` are query strings — vite-react-ssg prerenders paths, so
    // they can never contribute a page here.
    expect({ LANGUAGES, STATIC_ROUTES, PRERENDERED_ROUTES }).toEqual({
      LANGUAGES: 10,
      STATIC_ROUTES: 7,
      PRERENDERED_ROUTES: 70,
    });
  });

  it('the includedRoutes hook adds no route the route table does not declare', () => {
    // The second term of the derivation above, pinned. Adding a page here is what this
    // hook is FOR, and this repo has done it twice — so the failure to guard against is
    // not a typo but a legitimate edit: someone appends a path, the build emits more
    // than PRERENDERED_ROUTES files, and every "N prerendered pages" line keeps passing
    // because the count above never learned about the new page. Both other guards on
    // this number are floors (`font-loading.test.ts` and `sitemap-no-wizard.test.ts`
    // both assert `> 50`), so an INCREASE is invisible to them by construction.
    //
    // `/404` is not a route addition: vite-react-ssg emits it for Vercel's static
    // fallback and `routes.tsx` declares a `/404` path of its own, so it is already
    // inside `paths`.
    expect(
      includedRoutesHook(),
      'vite.config.ts includedRoutes() no longer returns only the routes routes.tsx ' +
        'declares. If that is deliberate, PRERENDERED_ROUTES above needs the second ' +
        'term back (count x LANGUAGES if the addition is per-language), and README.md ' +
        'plus docs/tech-spec.md need the new number.'
    ).toBe("includedRoutes(paths) { return [...paths, '/404']; }");
  });

  it('no shipped document states a stale prerendered page count', () => {
    const stale = /(\d+)\s+(?:prerendered|pre-rendered)\s+(?:HTML\s+)?pages?/gi;

    const offenders = TRACKED_DOCS.flatMap(doc =>
      [...doc.text.matchAll(stale)]
        .filter(match => Number(match[1]) !== PRERENDERED_ROUTES)
        .map(match => `${doc.name}: "${match[0]}"`)
    );

    expect(
      offenders,
      `real count is ${PRERENDERED_ROUTES} (${LANGUAGES} languages x ${STATIC_ROUTES} pages)`
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

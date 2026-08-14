import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, it, expect } from 'vitest';

/**
 * GH#36 — 263 `route_error` events over 24 Jul – 12 Aug 2026, `status` always -1,
 * the largest message byte-for-byte `Unexpected token '<', "<!DOCTYPE "... is not
 * valid JSON`. Reproduced exactly by running `JSON.parse` over `dist/404.html`.
 *
 * The throw is not in this repository. On every page carrying
 * `[data-server-rendered=true]`, vite-react-ssg injects a loader onto EVERY route
 * during hydration (`node_modules/vite-react-ssg/dist/index.mjs:99-140`) which
 * fetches `/static-loader-data-manifest-<hash>.json` and calls `.json()` on the
 * response with no `response.ok` check and no `try`/`catch` (`:117`). The hash
 * comes from `Math.random().toString(36)` (`shared/*.mjs:834`) rather than from
 * content, so each deploy orphans the previous filename. A visitor whose HTML came
 * from the service worker's week-long `pages-cache` requests a file that no longer
 * exists; Vercel answers 404 with an HTML body; `.json()` throws; and a loader
 * rejection lands on `errorElement`, which is the sole emitter of `route_error`.
 *
 * `index.html` defeats that by defining the manifest before the app loads, which
 * short-circuits the fetch. Declaring `loader` on our own routes does not work
 * instead: the transform assigns `route.loader` unconditionally and overwrites
 * whatever we declared.
 *
 * **The variable that does the short-circuiting moved in 0.9.0** ("split server
 * loader manifest"). In 0.8.x `__VITE_REACT_SSG_STATIC_LOADER_DATA__` *was* the
 * manifest; in 0.9.x it is a second-stage per-path cache and the gate sits on
 * `__VITE_REACT_SSG_STATIC_LOADER_MANIFEST__`. Both names are still in the bundle,
 * so assigning the old one leaves a page that looks patched and fetches anyway.
 * That is why `manifestGateVariable()` reads the name out of the artifact rather
 * than this file repeating it.
 *
 * These tests hold the two facts that make `{}` the right value rather than a stub:
 *
 *  1. Every route resolves to `null`, because no route declares a loader. Add one
 *     and this fails — which is the point: its data would otherwise be dropped on
 *     the floor with no other symptom.
 *  2. The assignment survives SSG into every prerendered page, under the name the
 *     shipped runtime actually gates on. It lives in `index.html`, which the build
 *     rewrites per page, so its presence in the source proves nothing.
 */

const root = resolve(__dirname, '../../..');
const dist = join(root, 'dist');
const built = existsSync(dist) && existsSync(join(dist, 'index.html'));

/**
 * Walked lazily, inside a test. `describe.runIf` marks a suite skipped but still
 * runs its callback during collection, so reading `dist` from the suite body —
 * or from an `it.each` argument — throws ENOENT in the CI jobs that do not build.
 */
function distFiles(extension: string): string[] {
  return readdirSync(dist, { recursive: true }).filter(
    (entry): entry is string => typeof entry === 'string' && entry.endsWith(extension)
  );
}

/**
 * The pages that must carry the assignment, derived rather than listed: the
 * injected loader keys off `[data-server-rendered=true]`, so that attribute IS
 * the set at risk. A hand-picked sample would have to be extended by hand for
 * every new locale and route, and would go on passing when it was not.
 */
function serverRenderedPages(): string[] {
  return distFiles('.html').filter(page =>
    readFileSync(join(dist, page), 'utf8').includes('data-server-rendered')
  );
}

/**
 * The variable the shipped runtime gates its manifest fetch on, read out of the
 * bundle rather than written down here.
 *
 * The names survive minification because they are `window.` property accesses,
 * not manglable identifiers, so the guard reads verbatim in `dist/assets/*.js`:
 *
 *     if(!window.__VITE_REACT_SSG_STATIC_LOADER_MANIFEST__){
 *       const e=cs(d,`static-loader-data-manifest-${window.__VITE_REACT_SSG_HASH__}.json`);
 *
 * Taking the last guard before the URL, rather than the first in the chunk, is
 * what keeps this pointed at the fetch it is about.
 */
function manifestGateVariable(): string | null {
  for (const asset of distFiles('.js')) {
    const js = readFileSync(join(dist, asset), 'utf8');
    const fetchSite = js.indexOf('static-loader-data-manifest-');
    if (fetchSite === -1) continue;

    const preceding = js.slice(Math.max(0, fetchSite - 200), fetchSite);
    const guards = [
      ...preceding.matchAll(/if\s*\(\s*!\s*window\.(__VITE_REACT_SSG_[A-Z_]+)\s*\)/g),
    ];
    if (guards.length > 0) {
      return guards[guards.length - 1][1];
    }
  }
  return null;
}

describe.runIf(built)('SSG static loader manifest', () => {
  it('resolves to null for every route, so an empty manifest is an exact substitute', () => {
    // The per-page data live under `static-loader-data/`; the index that points at
    // them is a *sibling file*, `static-loader-data-manifest-<hash>.json`, whose
    // values are those filenames. Matching on the directory segment keeps the index
    // out — a substring match pulls it in and reports every page as carrying data.
    const dataFiles = distFiles('.json').filter(
      file => file.split(/[\\/]/)[0] === 'static-loader-data'
    );

    // Guards the guard: no data files at all would satisfy the assertion below
    // vacuously, and would itself mean the mechanism changed shape.
    expect(
      dataFiles.length,
      'no static-loader-data/*.json in dist — vite-react-ssg no longer emits per-page ' +
        'loader data, so re-derive what index.html has to short-circuit (GH#36).'
    ).toBeGreaterThan(0);

    const withData = dataFiles.flatMap(file => {
      const byRouteId = JSON.parse(readFileSync(join(dist, file), 'utf8')) as Record<
        string,
        unknown
      >;
      return Object.entries(byRouteId)
        .filter(([, value]) => value !== null)
        .map(([routeId]) => `${file} -> ${routeId}`);
    });

    expect(
      withData,
      'A route now returns real SSG loader data. index.html short-circuits the manifest ' +
        'with {}, so that data would never reach the route. Remove the assignment and ' +
        'solve GH#36 another way.'
    ).toEqual([]);
  });

  it('assigns the variable the runtime gates on, before the app loads, on every prerendered page', () => {
    const gate = manifestGateVariable();

    expect(
      gate,
      'No `if (!window.__VITE_REACT_SSG_*)` guards the manifest fetch in any bundled ' +
        'chunk. The mechanism GH#36 works against has changed shape — read the loader in ' +
        'node_modules/vite-react-ssg/dist/index.mjs before touching index.html.'
    ).not.toBeNull();

    const pages = serverRenderedPages();

    // Guards the guard: a walk that matched nothing would report success.
    expect(pages.length, 'no [data-server-rendered] pages in dist').toBeGreaterThan(0);

    // Ordering is the whole point: the loader reads the variable during hydration,
    // so an assignment placed after the entry script would still race the fetch.
    const broken = pages.filter(page => {
      const html = readFileSync(join(dist, page), 'utf8');
      const assignment = html.indexOf(`window.${gate}`);
      const entry = html.indexOf('type="module"');
      return assignment === -1 || entry === -1 || assignment > entry;
    });

    expect(
      broken,
      `These prerendered pages do not assign window.${gate} before their module entry ` +
        'script, so the injected loader will fetch the orphaned manifest on them (GH#36). ' +
        `If index.html assigns a different name, ${gate} is the one that now short-circuits.`
    ).toEqual([]);
  });
});

/**
 * Why the dependency is pinned rather than ranged.
 *
 * The workaround is written against internals — a global name, an unguarded
 * `.json()`, and a short-circuit upstream never documented. 0.9.0 moved that
 * global while leaving the old name alive elsewhere in the bundle, which is
 * exactly the shape of change a range would have taken silently.
 *
 * Outside `describe.runIf(built)` deliberately — this reads `package.json`, so
 * it runs in the two CI jobs that never build as well as the one that does.
 */
describe('vite-react-ssg version', () => {
  it('is pinned exactly, because this fix depends on internals a minor has already moved', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };

    expect(
      pkg.dependencies['vite-react-ssg'],
      'A range lets an install swap the hydration internals this file asserts against. ' +
        'Bumping is fine — pin the new version and re-run this suite against a fresh build.'
    ).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

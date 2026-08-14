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
 * during hydration (`dist/index.mjs:184`) which fetches
 * `/static-loader-data-manifest-<hash>.json` and calls `.json()` on the response
 * with no `response.ok` check and no `try`/`catch` (`:171`). The hash comes from
 * `Math.random().toString(36)` (`shared/vite-react-ssg.qp2k9AZ2.mjs:705`) rather
 * than from content, so each deploy orphans the previous filename. A visitor whose
 * HTML came from the service worker's week-long `pages-cache` requests a file that
 * no longer exists; Vercel answers 404 with an HTML body; `.json()` throws; and a
 * loader rejection lands on `errorElement`, which is the sole emitter of
 * `route_error`.
 *
 * `index.html` defeats that by defining `window.__VITE_REACT_SSG_STATIC_LOADER_DATA__`
 * before the app loads, which short-circuits the fetch (`:167-169`). Declaring
 * `loader` on our own routes does not work instead: the transform assigns
 * `route.loader` unconditionally and overwrites whatever we declared.
 *
 * These tests hold the two facts that make `{}` the right value rather than a stub,
 * so neither can change silently:
 *
 *  1. The real manifest holds `null` for every route, because no route declares a
 *     loader. Add one and this fails — which is the point: its data would otherwise
 *     be dropped on the floor with no other symptom.
 *  2. The assignment survives SSG into every prerendered page. It lives in
 *     `index.html`, which the build rewrites per page, so its presence in the source
 *     proves nothing about the artifact.
 */

const root = resolve(__dirname, '../../..');
const dist = join(root, 'dist');
const built = existsSync(dist) && existsSync(join(dist, 'index.html'));

/**
 * The pages that must carry the assignment, derived rather than listed: the
 * injected loader keys off `[data-server-rendered=true]`, so that attribute IS
 * the set at risk. A hand-picked sample would have to be extended by hand for
 * every new locale and route, and would go on passing when it was not.
 *
 * Walked lazily, inside a test. `describe.runIf` marks a suite skipped but still
 * runs its callback during collection, so reading `dist` from the suite body —
 * or from an `it.each` argument — throws ENOENT in the CI jobs that do not build.
 */
function serverRenderedPages(): string[] {
  return readdirSync(dist, { recursive: true })
    .filter((entry): entry is string => typeof entry === 'string' && entry.endsWith('.html'))
    .filter(page => readFileSync(join(dist, page), 'utf8').includes('data-server-rendered'));
}

function manifestPath(): string | null {
  const name = readdirSync(dist).find(
    f => f.startsWith('static-loader-data-manifest-') && f.endsWith('.json')
  );
  return name === undefined ? null : join(dist, name);
}

describe.runIf(built)('SSG static loader manifest', () => {
  it('holds null for every route, so an empty object is an exact substitute', () => {
    const path = manifestPath();
    expect(path, 'no static-loader-data-manifest-*.json in dist').not.toBeNull();

    const manifest = JSON.parse(readFileSync(path as string, 'utf8')) as Record<
      string,
      Record<string, unknown>
    >;

    const routes = Object.entries(manifest);
    // Guards the guard: an empty manifest would satisfy the assertion below vacuously.
    expect(routes.length).toBeGreaterThan(0);

    const withData = routes.flatMap(([path_, byRouteId]) =>
      Object.entries(byRouteId)
        .filter(([, value]) => value !== null)
        .map(([routeId]) => `${path_} -> ${routeId}`)
    );

    expect(
      withData,
      'A route now returns real SSG loader data. index.html short-circuits the manifest ' +
        'fetch with {}, so that data would never reach the route. Remove the ' +
        '__VITE_REACT_SSG_STATIC_LOADER_DATA__ assignment and solve GH#36 another way.'
    ).toEqual([]);
  });

  it('defines the loader data before the app loads, on every prerendered page', () => {
    const pages = serverRenderedPages();

    // Guards the guard: a walk that matched nothing would report success.
    expect(pages.length, 'no [data-server-rendered] pages in dist').toBeGreaterThan(0);

    // Ordering is the whole point: the loader reads the variable during hydration,
    // so an assignment placed after the entry script would still race the fetch.
    const broken = pages.filter(page => {
      const html = readFileSync(join(dist, page), 'utf8');
      const assignment = html.indexOf('__VITE_REACT_SSG_STATIC_LOADER_DATA__');
      const entry = html.indexOf('type="module"');
      return assignment === -1 || entry === -1 || assignment > entry;
    });

    expect(
      broken,
      'These prerendered pages do not assign __VITE_REACT_SSG_STATIC_LOADER_DATA__ ' +
        'before their module entry script, so the injected loader will fetch the ' +
        'orphaned manifest on them (GH#36).'
    ).toEqual([]);
  });
});

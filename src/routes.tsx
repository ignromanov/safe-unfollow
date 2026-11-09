import type { RouteRecord } from 'vite-react-ssg';
import { Layout } from '@/components/Layout';
import { RouteErrorPage } from '@/components/RouteErrorPage';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/locales';
import { INTENT_PAGES } from '@/config/intent-pages';
import IntentPage from './pages/IntentPage';

// Static: these pages are the entry chunk every visitor downloads, so a reader landing on
// one waits for no second module (8af34d1 made every route static for that reason).
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import NotFoundPage from './pages/NotFoundPage';

/**
 * `/results` and `/sample` are route chunks (GH#292). Between them they carry the virtualizer,
 * the rows, the follow-date line and the caveats, which no other page runs. Kept in the entry,
 * every visitor paid for them, and most visitors never reach either page.
 *
 * Neither reintroduces the waterfall 8af34d1 removed. A direct load gets a `modulepreload` for
 * the route chunk in its prerendered HTML: vite-react-ssg's `remix` router mode writes one for
 * every module a route rendered. On the client the library also resolves the matched route's
 * `lazy` before it hydrates, so the prerendered markup is never hydrated against a missing
 * component. `src/__tests__/build/results-out-of-entry.test.ts` asserts the preloads, because
 * this behaviour comes from a library and is not visible in our source.
 *
 * There is deliberately no prefetch from /upload. Starting one when the parse starts would
 * save one chunk fetch after a parse that takes seconds. The cost: a chunk that 404s after a
 * deploy fires `vite:preloadError`, and `installStaleChunkRecovery` answers that with a reload.
 * The reload would land mid-parse and throw away the reader's file. Fetched on navigation
 * instead, the same 404 arrives after the accounts are already in IndexedDB.
 */
const loadResultsPage = () => import('./pages/ResultsPage');
const loadSamplePage = () => import('./pages/SamplePage');

/**
 * Factory for page children — each parent route needs its own object references
 * to avoid React Router route ID collisions (IDs are derived from object identity).
 */
function createPageChildren(): RouteRecord[] {
  return [
    { index: true, element: <HomePage /> },
    { path: 'upload', element: <UploadPage /> },
    { path: 'results', lazy: loadResultsPage },
    { path: 'sample', lazy: loadSamplePage },
    { path: '404', element: <NotFoundPage /> },
    { path: '*', element: <NotFoundPage /> },
  ];
}

/**
 * The legal pages, English only since v1.7.0 (plan 2026-11-09-seo-aeo-geo, task 08a).
 *
 * The policy and terms are hard-coded English, so the nine locale copies told engines a
 * translation exists when it does not. `/xx/privacy` and `/xx/terms` are 308s to these pages in
 * public/_redirects; a route under a locale would answer that navigation client-side and the
 * redirect would never be requested. Paths: src/config/legal-pages.ts.
 */
function createLegalPageChildren(): RouteRecord[] {
  return [
    { path: 'privacy', element: <PrivacyPage /> },
    { path: 'terms', element: <TermsPage /> },
  ];
}

/**
 * The intent landing pages, English only.
 *
 * Deliberately NOT part of createPageChildren(): that factory is called once for `/` and once
 * for each of the nine other languages (:74-80), so anything inside it ships in ten locales.
 * These pages exist in English and nowhere else, which is the operator's scope ruling for the
 * pSEO stream — see .claude/plans/2026-09-05-filter-and-intent-pages/00-INDEX.md.
 *
 * A request for /ru/who-doesnt-follow-me-back therefore falls to that language's `*` route and
 * renders NotFoundPage. That is intended: nothing links there, and after this task nothing
 * advertises it either.
 */
function createIntentPageChildren(): RouteRecord[] {
  return INTENT_PAGES.map(page => ({
    path: page.slug,
    element: <IntentPage page={page} />,
  }));
}

/**
 * Route definitions for SSG prerendering
 *
 * Structure (5 prerendered routes per language):
 * - / (hero)
 * - /upload (file upload, and the export guide it opens as a dialog)
 * - /results
 * - /sample
 * - /404
 * plus, in English only, /privacy, /terms and the intent pages.
 *
 * The `*` catch-all is stripped by vite-react-ssg (it skips any path containing
 * ':' or '*'). The prerendered count is not restated here: count the HTML under dist/.
 *
 * Nine more used to be `/wizard` and `/wizard/step/1..8`, prerendered per
 * language by an `includedRoutes` hook — 90 of the sitemap's 163 entries, 80 of
 * them canonicalized away to a single page. The guide is a dialog on /upload
 * now (GH#102) and those addresses are permanent redirects in public/_redirects. The guide's own
 * deep links are `?guide=1` and `?step=N`, which are query strings:
 * vite-react-ssg prerenders paths, so they add no route here and no sitemap
 * entry.
 *
 * /results IS prerendered, despite needing user data: it is a static child route,
 * so nothing excludes it and dist/<lang>/results.html ships for all 10 languages.
 * What it contains is the Hero fallback, because useInstagramData() has no data
 * during SSG (IndexedDB is browser-only). Treat that HTML as SSG-visible surface —
 * meta tags and hydration safety apply to it. See GH#44.
 *
 * Each route also has language variants:
 * - /es, /es/upload, /es/results, etc.
 * - /ru, /ru/upload, /ru/results, etc.
 */
export const routes: RouteRecord[] = [
  {
    path: '/',
    element: <Layout />,
    errorElement: <RouteErrorPage />,
    entry: 'src/components/Layout.tsx',
    children: [
      ...createIntentPageChildren(),
      ...createLegalPageChildren(),
      ...createPageChildren(),
    ],
  },
  // Language-prefixed routes (es, ru, de, etc.)
  ...SUPPORTED_LANGUAGES.filter(lang => lang !== 'en').map((lang): RouteRecord => ({
    path: `/${lang}`,
    element: <Layout lang={lang} />,
    errorElement: <RouteErrorPage />,
    entry: 'src/components/Layout.tsx',
    children: createPageChildren(),
  })),
];

export type { SupportedLanguage };

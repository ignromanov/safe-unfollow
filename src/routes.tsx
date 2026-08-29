import type { RouteRecord } from 'vite-react-ssg';
import { Layout } from '@/components/Layout';
import { RouteErrorPage } from '@/components/RouteErrorPage';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/locales';

// Direct imports for parallel loading (no lazy waterfall)
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import ResultsPage from './pages/ResultsPage';
import SamplePage from './pages/SamplePage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import NotFoundPage from './pages/NotFoundPage';

/**
 * Factory for page children — each parent route needs its own object references
 * to avoid React Router route ID collisions (IDs are derived from object identity).
 */
function createPageChildren(): RouteRecord[] {
  return [
    { index: true, element: <HomePage /> },
    { path: 'upload', element: <UploadPage /> },
    { path: 'results', element: <ResultsPage /> },
    { path: 'sample', element: <SamplePage /> },
    { path: 'privacy', element: <PrivacyPage /> },
    { path: 'terms', element: <TermsPage /> },
    { path: '404', element: <NotFoundPage /> },
    { path: '*', element: <NotFoundPage /> },
  ];
}

/**
 * Route definitions for SSG prerendering
 *
 * Structure (7 prerendered routes per language):
 * - / (hero)
 * - /upload (file upload, and the export guide it opens as a dialog)
 * - /results
 * - /sample
 * - /privacy
 * - /terms
 * - /404
 *
 * The `*` catch-all is stripped by vite-react-ssg (it skips any path containing
 * ':' or '*'), so the real build emits 10 languages x 7 = 70 prerendered routes.
 *
 * Eight of these used to be `/wizard` and `/wizard/step/1..8`, prerendered per
 * language by an `includedRoutes` hook — 90 of the sitemap's 163 entries, 80 of
 * them canonicalized away to a single page. The guide is a dialog on /upload
 * now (GH#102) and those addresses are permanent redirects in vercel.json. The guide's own
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
    children: createPageChildren(),
  },
  // Language-prefixed routes (es, ru, de, etc.)
  ...SUPPORTED_LANGUAGES.filter(lang => lang !== 'en').map(
    (lang): RouteRecord => ({
      path: `/${lang}`,
      element: <Layout lang={lang} />,
      errorElement: <RouteErrorPage />,
      entry: 'src/components/Layout.tsx',
      children: createPageChildren(),
    })
  ),
];

export type { SupportedLanguage };

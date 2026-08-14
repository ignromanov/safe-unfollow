import type { RouteRecord } from 'vite-react-ssg';
import React from 'react';
import { Layout } from '@/components/Layout';
import { RouteErrorPage } from '@/components/RouteErrorPage';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/locales';

// Direct imports for parallel loading (no lazy waterfall)
import HomePage from './pages/HomePage';
import WizardPage from './pages/WizardPage';
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
    { path: 'wizard', element: <WizardPage /> },
    { path: 'wizard/step/:stepId', element: <WizardPage /> },
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
 * Structure (8 prerendered routes per language):
 * - / (hero)
 * - /wizard (step-by-step export guide)
 * - /upload (file upload)
 * - /results
 * - /sample
 * - /privacy
 * - /terms
 * - /404
 *
 * `wizard/step/:stepId` and the `*` catch-all are stripped by vite-react-ssg
 * (it skips any path containing ':' or '*'). The eight concrete wizard steps are
 * added back per language in vite.config.ts `includedRoutes`, so the real build
 * emits 10 languages x (8 + 8) = 160 prerendered routes — not 8 per language.
 *
 * /results IS prerendered, despite needing user data: it is a static child route,
 * so nothing excludes it and dist/<lang>/results.html ships for all 10 languages.
 * What it contains is the Hero fallback, because useInstagramData() has no data
 * during SSG (IndexedDB is browser-only). Treat that HTML as SSG-visible surface —
 * meta tags and hydration safety apply to it. See GH#44.
 *
 * Each route also has language variants:
 * - /es, /es/wizard, /es/upload, etc.
 * - /ru, /ru/wizard, /ru/upload, etc.
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

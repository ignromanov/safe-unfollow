import type { RouteRecord } from 'vite-react-ssg';
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
 * Structure:
 * - / (hero)
 * - /wizard (step-by-step export guide)
 * - /upload (file upload)
 * - /results (client-only, not prerendered - requires user data)
 * - /sample
 * - /privacy
 * - /terms
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

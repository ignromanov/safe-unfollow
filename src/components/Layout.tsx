import i18n from 'i18next';
import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { BuyMeCoffeeWidget } from '@/components/BuyMeCoffeeWidget';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { OrganizationSchema } from '@/components/OrganizationSchema';
import { ThemeProvider } from '@/components/theme-provider';
import { AppState } from '@/core/types';
import { useInstagramData } from '@/hooks/useInstagramData';
import { useLanguageFromPath } from '@/hooks/useLanguageFromPath';
import { useLanguagePrefix } from '@/hooks/useLanguagePrefix';
import { useLanguageRedirect } from '@/hooks/useLanguageRedirect';
import { useSessionDuration } from '@/hooks/useSessionDuration';
import { analytics } from '@/lib/analytics';
import { RTL_LANGUAGES, type SupportedLanguage } from '@/locales';

interface LayoutProps {
  lang?: SupportedLanguage;
}

type PageName = 'hero' | 'wizard' | 'upload' | 'results' | 'sample' | 'privacy' | 'terms';

/**
 * Map pathname to page name for analytics
 */
function getPageNameFromPath(pathname: string): PageName {
  if (pathname.endsWith('/results')) return 'results';
  if (pathname.endsWith('/upload')) return 'upload';
  if (pathname.endsWith('/wizard')) return 'wizard';
  if (pathname.endsWith('/sample')) return 'sample';
  if (pathname.endsWith('/privacy')) return 'privacy';
  if (pathname.endsWith('/terms')) return 'terms';
  return 'hero';
}

/**
 * Map pathname to AppState for header highlighting
 */
function getActiveScreen(pathname: string): AppState {
  if (pathname.endsWith('/results')) return AppState.RESULTS;
  if (pathname.endsWith('/upload')) return AppState.UPLOAD;
  if (pathname.endsWith('/wizard')) return AppState.WIZARD;
  if (pathname.endsWith('/sample')) return AppState.SAMPLE;
  if (pathname.endsWith('/privacy')) return AppState.PRIVACY;
  if (pathname.endsWith('/terms')) return AppState.TERMS;
  return AppState.HERO;
}

/**
 * Root layout component for all pages
 * Handles:
 * - Theme provider wrapper
 * - Header and Footer
 * - Language sync from URL path
 * - Loading states
 * - BMC widget display
 */
export function Layout({ lang }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { uploadState, handleClearData, fileMetadata } = useInstagramData();

  // Client-mounted check (prevents hydration mismatch)
  // Effects run AFTER hydration, so this is safe
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // SSG: Switch language synchronously BEFORE rendering
  // This works because during SSG all language resources are preloaded
  // On client, this is a no-op since language is already set from URL
  const targetLang = lang ?? 'en';
  if (i18n.language !== targetLang && i18n.hasResourceBundle(targetLang, 'common')) {
    i18n.changeLanguage(targetLang);
  }

  // Sync language from URL path (e.g., /es/wizard -> Spanish)
  useLanguageFromPath(lang);

  // Redirect from language-less paths to user's preferred language
  // Uses useLayoutEffect to redirect BEFORE paint
  useLanguageRedirect();

  // Track session duration for engagement analytics
  useSessionDuration();

  // Get language prefix for navigation
  const prefix = useLanguagePrefix();

  // Determine text direction for RTL languages (Arabic, etc.)
  const isRTL = lang ? RTL_LANGUAGES.includes(lang) : false;

  // Guard with mounted to prevent hydration mismatch
  // SSG renders with hasResults=false, client updates after mount
  const hasResults = mounted && uploadState.status === 'success' && fileMetadata !== null;
  const activeScreen = getActiveScreen(location.pathname);

  // Determine current screen for BMC widget
  const isResultsPage =
    location.pathname.endsWith('/results') || location.pathname.endsWith('/sample');

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  // Track page views
  useEffect(() => {
    const pageName = getPageNameFromPath(location.pathname);
    analytics.pageView(pageName, lang);
  }, [location.pathname, lang]);

  // Navigation handlers
  const handleViewResults = () => navigate(`${prefix}/results`);
  const handleUpload = () => navigate(`${prefix}/upload`);
  const handleLogoClick = () => navigate(`${prefix}/`);
  const handleClear = () => {
    handleClearData();
    navigate(`${prefix}/`);
  };

  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <div
          dir={isRTL ? 'rtl' : 'ltr'}
          className="min-h-screen bg-background flex flex-col transition-colors duration-300"
          suppressHydrationWarning
        >
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:inset-inline-start-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
          >
            Skip to main content
          </a>

          <Header
            hasData={hasResults}
            activeScreen={activeScreen}
            onViewResults={handleViewResults}
            onUpload={handleUpload}
            onLogoClick={handleLogoClick}
            onClear={handleClear}
          />

          <main id="main-content" className="flex-1 container mx-auto px-4">
            <Outlet />
          </main>

          <Footer />

          {/* BMC Widget - shows only on results pages, auto-open disabled */}
          <BuyMeCoffeeWidget
            show={isResultsPage}
            expandDelay={999999999}
            autoCollapseAfter={10000}
            skipStorageCheck={location.pathname.endsWith('/sample')}
          />

          {/* Structured data for SEO */}
          <BreadcrumbSchema />
          <OrganizationSchema />
        </div>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default Layout;

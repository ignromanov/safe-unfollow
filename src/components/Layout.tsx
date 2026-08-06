import i18n from 'i18next';
import { useEffect, useLayoutEffect } from 'react';
import { Outlet } from 'react-router-dom';

import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { BuyMeCoffeeWidget } from '@/components/BuyMeCoffeeWidget';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { OrganizationSchema } from '@/components/OrganizationSchema';
import { ThemeProvider } from '@/components/theme-provider';
import { useEventQueueFlush } from '@/hooks/useEventQueueFlush';
import { useInstagramData } from '@/hooks/useInstagramData';
import { useLanguageFromPath } from '@/hooks/useLanguageFromPath';
import { useLanguageRedirect } from '@/hooks/useLanguageRedirect';
import { useLayoutAnalytics } from '@/hooks/useLayoutAnalytics';
import { useLayoutNavigation } from '@/hooks/useLayoutNavigation';
import { useLayoutState } from '@/hooks/useLayoutState';
import { RTL_LANGUAGES, type SupportedLanguage } from '@/locales';

// Use useLayoutEffect on client to sync language BEFORE paint,
// preventing a flash of wrong language. Falls back to useEffect during SSG.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface LayoutProps {
  lang?: SupportedLanguage;
}

/**
 * Root layout component for all pages.
 * Composes extracted hooks for navigation, analytics, and state management.
 *
 * Handles:
 * - Theme provider wrapper
 * - Header and Footer
 * - Language sync from URL path
 * - BMC widget display
 * - Structured data (SEO)
 */
export function Layout({ lang }: LayoutProps) {
  const { uploadState, handleClearData, fileMetadata } = useInstagramData();

  // Extracted hooks
  const {
    pathname,
    activeScreen,
    isResultsPage,
    handleViewResults,
    handleUpload,
    handleLogoClick,
    handleClear,
  } = useLayoutNavigation();
  const { mounted } = useLayoutState(pathname);

  // Analytics (UTM capture, page view, PWA install)
  useLayoutAnalytics();
  useEventQueueFlush();

  // SSG: Switch language synchronously BEFORE rendering
  // This works because during SSG all language resources are preloaded
  // On client, this is a no-op since language is already set from URL
  const targetLang = lang ?? 'en';
  if (i18n.language !== targetLang && i18n.hasResourceBundle(targetLang, 'common')) {
    i18n.changeLanguage(targetLang);
  }

  // Client-side: ensure language is synced before paint on navigation
  useIsomorphicLayoutEffect(() => {
    if (i18n.language !== targetLang && i18n.hasResourceBundle(targetLang, 'common')) {
      i18n.changeLanguage(targetLang);
    }
  }, [targetLang]);

  // Sync language from URL path (e.g., /es/wizard -> Spanish)
  useLanguageFromPath(lang);

  // Redirect from language-less paths to user's preferred language
  useLanguageRedirect();

  // Determine text direction for RTL languages (Arabic, etc.)
  const isRTL = lang ? RTL_LANGUAGES.includes(lang) : false;

  // Guard with mounted to prevent hydration mismatch
  // SSG renders with hasResults=false, client updates after mount
  const hasResults = mounted && uploadState.status === 'success' && fileMetadata !== null;

  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <div
          dir={isRTL ? 'rtl' : 'ltr'}
          className="min-h-dvh bg-background flex flex-col"
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
            onClear={() => handleClear(handleClearData)}
          />

          <main id="main-content" className="flex-1 container mx-auto px-4">
            <Outlet />
          </main>

          <Footer />

          {/* BMC Widget - shows only on results pages, auto-expand after 60s */}
          <BuyMeCoffeeWidget
            show={isResultsPage}
            expandDelay={60000}
            autoCollapseAfter={10000}
            skipStorageCheck={pathname.endsWith('/sample')}
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

import i18n from 'i18next';
import { Suspense, lazy, useEffect, useLayoutEffect, useState } from 'react';
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
import { consumeLicenseParam, getStoredLicense, isExportFeatureEnabled } from '@/lib/export/unlock';
import { RTL_LANGUAGES, type SupportedLanguage } from '@/locales';

// Only ever needed on the one page load that carries a checkout redirect, so it
// stays out of the bundle that all 88 prerendered pages ship.
const LicenseDialog = lazy(() =>
  import('@/components/export/LicenseDialog').then(module => ({ default: module.LicenseDialog }))
);

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

  // Read once, during the first render: the param must be stripped before any
  // navigation or analytics can observe the key. A second read would spend one
  // of the license's 3 device activations, so nothing may re-trigger this.
  // NOTE: this initializer has a side effect (history.replaceState). The app
  // does not use StrictMode today; under StrictMode React double-invokes this
  // initializer and commits the second result, which would find the param
  // already stripped and silently drop the paid redirect.
  const [capturedLicenseKey] = useState<string | null>(() => {
    // Stripping is always safe and must happen even when the feature flag is
    // off — otherwise a key lingers in the address bar and in Umami's
    // auto-tracked pageview URL. Only mounting the dialog below is gated on
    // the flag.
    const key = consumeLicenseParam();
    return isExportFeatureEnabled() ? key : null;
  });
  const [isLicenseDialogOpen, setIsLicenseDialogOpen] = useState(() => {
    // An empty or whitespace-only `?license_key=` (e.g. a truncated link) is not
    // a key at all — opening the manual-entry form for it would show a
    // license prompt to someone who never bought anything.
    const trimmed = capturedLicenseKey?.trim() ?? '';
    if (trimmed.length === 0) return false;

    // If this device already holds this exact key, opening the dialog only
    // for LicenseDialog's own guard to close it immediately flashes a modal
    // with no confirmation (plausibly read as another failure) and loads the
    // lazy chunk for nothing. Decide not to open at all instead — the guard
    // inside LicenseDialog stays as the correct last line of defence for
    // every other caller.
    return getStoredLicense()?.key !== trimmed;
  });

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

          <Suspense fallback={null}>
            {capturedLicenseKey !== null && isLicenseDialogOpen ? (
              <LicenseDialog
                open={isLicenseDialogOpen}
                onOpenChange={setIsLicenseDialogOpen}
                initialKey={capturedLicenseKey}
                source="redirect"
              />
            ) : null}
          </Suspense>
        </div>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default Layout;

import i18n from 'i18next';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';

import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LicenseDialogMount } from '@/components/export/LicenseDialogMount';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { OrganizationSchema } from '@/components/OrganizationSchema';
import { ThemeProvider } from '@/components/theme-provider';
import { useEventQueueFlush } from '@/hooks/useEventQueueFlush';
import { useHasResults } from '@/hooks/useHasResults';
import { useInstagramData } from '@/hooks/useInstagramData';
import { useLanguageFromPath } from '@/hooks/useLanguageFromPath';
import { useLanguageRedirect } from '@/hooks/useLanguageRedirect';
import { useLayoutAnalytics } from '@/hooks/useLayoutAnalytics';
import { useLayoutNavigation } from '@/hooks/useLayoutNavigation';
import { useLayoutState } from '@/hooks/useLayoutState';
import { consumeLicenseParam, getStoredLicense, isExportFeatureEnabled } from '@/lib/export/unlock';
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
 * - Structured data (SEO)
 */
export function Layout({ lang }: LayoutProps) {
  const { handleClearData } = useInstagramData();

  // Extracted hooks
  const { pathname, activeScreen, handleClear } = useLayoutNavigation();
  useLayoutState(pathname);

  // Analytics (UTM capture, page view, PWA install)
  useLayoutAnalytics();
  useEventQueueFlush();

  const [capturedLicenseKey, setCapturedLicenseKey] = useState<string | null>(null);
  const [isLicenseDialogOpen, setIsLicenseDialogOpen] = useState(false);
  // Survives re-runs of the effect against the same mounted component; a real
  // remount gets a fresh one, which is what the recovery path below needs.
  const hasConsumedLicenseParam = useRef(false);

  // Read once, after the tree is committed — NOT during render, which is the
  // distinction the whole redirect depends on.
  //
  // `consumeLicenseParam` strips the param with history.replaceState, so it is
  // a side effect, and a render may be thrown away. `/results` is prerendered
  // and therefore hydrated: on 2026-08-21 a real test purchase returned to
  // /results?license_key=..., the client's first render mounted a dialog the
  // server HTML did not have (React #418), React discarded that render and
  // client-rendered the whole root (#423) — and the discarded render had
  // already eaten the param. The second one found an empty URL and the buyer's
  // export stayed locked. The file predicted this failure for StrictMode and
  // called it hypothetical; hydration recovery is the same double invocation.
  //
  // A commit-phase read cannot lose that way: the render React throws away
  // never commits, so this never ran, and the param is still in the URL for
  // the render that does commit.
  //
  // Layout-phase rather than passive, and this is load-bearing: stripping must
  // beat anything that can observe the URL. useLayoutAnalytics fires its
  // pageview from a passive useEffect, and every passive effect in the tree
  // runs after every layout effect — so the key is out of the address bar
  // before analytics can read it, whatever order the hooks are declared in.
  useIsomorphicLayoutEffect(() => {
    if (hasConsumedLicenseParam.current) return;
    hasConsumedLicenseParam.current = true;

    // Stripping is always safe and must happen even when the feature flag is
    // off — otherwise a key lingers in the address bar and in Umami's
    // auto-tracked pageview URL. Only the dialog is gated on the flag.
    const key = consumeLicenseParam();
    if (!isExportFeatureEnabled() || key === null) return;

    setCapturedLicenseKey(key);

    // An empty or whitespace-only `?license_key=` (e.g. a truncated link) is not
    // a key at all — opening the manual-entry form for it would show a
    // license prompt to someone who never bought anything.
    const trimmed = key.trim();
    if (trimmed.length === 0) return;

    // If this device already holds this exact key, opening the dialog only
    // for LicenseDialog's own guard to close it immediately flashes a modal
    // with no confirmation (plausibly read as another failure) and loads the
    // lazy chunk for nothing. Decide not to open at all instead — the guard
    // inside LicenseDialog stays as the correct last line of defence for
    // every other caller.
    if (getStoredLicense()?.key === trimmed) return;

    setIsLicenseDialogOpen(true);
  }, []);

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

  // Sync language from URL path (e.g., /es/upload -> Spanish)
  useLanguageFromPath(lang);

  // Redirect from language-less paths to user's preferred language
  useLanguageRedirect();

  // Determine text direction for RTL languages (Arabic, etc.)
  const isRTL = lang ? RTL_LANGUAGES.includes(lang) : false;

  const hasResults = useHasResults();

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
            onClear={() => handleClear(handleClearData)}
          />

          <main id="main-content" className="flex-1 container mx-auto px-4">
            <Outlet />
          </main>

          <Footer />

          {/* Structured data for SEO */}
          <BreadcrumbSchema />
          <OrganizationSchema />

          {capturedLicenseKey !== null && isLicenseDialogOpen ? (
            <LicenseDialogMount
              licenseKey={capturedLicenseKey}
              open={isLicenseDialogOpen}
              onOpenChange={setIsLicenseDialogOpen}
            />
          ) : null}
        </div>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default Layout;

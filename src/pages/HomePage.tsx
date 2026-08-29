import { useEffect } from 'react';

import { AdSlot } from '@/components/ads/AdSlot';
import { FAQSection } from '@/components/FAQSection';
import { FooterCTA } from '@/components/FooterCTA';
import { Hero } from '@/components/Hero';
import { HowToSection } from '@/components/HowToSection';
import { useHasResults } from '@/hooks/useHasResults';

// NOTE: Removed lazy() loading for SSG compatibility.
// Lazy loading with Suspense causes hydration mismatch:
// - SSG renders fallback skeleton
// - Client renders full content
// - React detects mismatch → errors #418, #425
// These sections contain SEO-critical structured data (HowTo, FAQ schemas)
// and must be in the initial HTML for search engines.

/**
 * Home page (landing)
 * Prerendered for SEO with Hero, HowTo, FAQ sections
 */
export function Component() {
  const hasResults = useHasResults();

  // Prefetch the guide dialog on idle: it is what this page's primary CTA
  // costs. Hero, FooterCTA and every HowTo row now point at /upload?guide=1
  // (GH#102), and `useGuideDialog` opens the dialog straight from that query
  // on arrival — but `GuideDialog` is lazy inside UploadPage (it is a modal,
  // so it does not ship in the entry chunk), while UploadPage itself is a
  // static import in routes.tsx and is already in the initial module graph.
  // So the dialog is the one cold chunk on the path, and warming it here
  // keeps the parity the WizardPage prefetch used to provide.
  //
  // The specifier must stay byte-identical to UploadPage.tsx:17's, or Vite
  // resolves them to two chunks and this warms the wrong one.
  useEffect(() => {
    const prefetchGuide = () => {
      import('@/components/guide/GuideDialog').catch(() => {
        // Ignore prefetch errors (network, etc.)
      });
    };

    // Use requestIdleCallback for non-blocking prefetch
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(prefetchGuide, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    } else {
      // Fallback: setTimeout after 2 seconds
      const id = setTimeout(prefetchGuide, 2000);
      return () => clearTimeout(id);
    }
  }, []);

  return (
    <>
      <Hero hasData={hasResults} />
      <div className="animate-in fade-in duration-1000">
        <HowToSection />
        <AdSlot name="home" slot={import.meta.env.VITE_ADSENSE_SLOT_HOME} className="my-8" />
        <FAQSection />
        <FooterCTA />
      </div>
    </>
  );
}

export default Component;

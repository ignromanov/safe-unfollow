import { useEffect } from 'react';

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

  // Prefetch wizard chunk on idle for instant navigation
  useEffect(() => {
    const prefetchWizard = () => {
      import('./WizardPage').catch(() => {
        // Ignore prefetch errors (network, etc.)
      });
    };

    // Use requestIdleCallback for non-blocking prefetch
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(prefetchWizard, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    } else {
      // Fallback: setTimeout after 2 seconds
      const id = setTimeout(prefetchWizard, 2000);
      return () => clearTimeout(id);
    }
  }, []);

  return (
    <>
      <Hero hasData={hasResults} />
      <div className="animate-in fade-in duration-1000">
        <HowToSection />
        <FAQSection />
        <FooterCTA />
      </div>
    </>
  );
}

export default Component;

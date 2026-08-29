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

  // There was an idle prefetch of WizardPage here. That page is gone (GH#102):
  // every guide CTA on this screen now points at /upload, whose chunk this
  // page does not own. The guide itself is lazy inside UploadPage, so a
  // reader arriving at /upload?guide=1 pays a chunk fetch at hydration — worth
  // a preload, but one that belongs next to the measurement of that arrival
  // path, not to a hook this page keeps for a module it no longer imports.

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

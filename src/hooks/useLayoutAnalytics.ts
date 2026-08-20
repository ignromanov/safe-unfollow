import { useEffect } from 'react';

import { usePWAInstallAnalytics } from '@/hooks/usePWAInstallAnalytics';
import { analytics, captureUTMParams } from '@/lib/analytics';
import { installCTACapture } from '@/lib/stats/cta-capture';

/**
 * Hook for Layout analytics concerns:
 * - Hero CTA capture: replay anything the previous page parked before it could hydrate,
 *   then take clicks directly from the inline listener (see lib/stats/cta-capture.ts)
 * - UTM parameter capture on first render
 * - Initial page view tracking
 * - PWA install event tracking
 */
export function useLayoutAnalytics(): void {
  // Track PWA install events
  usePWAInstallAnalytics();

  // Layout wraps every route, so this runs on the page a pre-hydration click landed on.
  useEffect(() => {
    installCTACapture();
  }, []);

  // Capture UTM params from URL on first render
  useEffect(() => {
    captureUTMParams();
  }, []);

  // UTM attribution on first page view only (Umami built-in handles pageviews)
  useEffect(() => {
    analytics.pageView();
  }, []);
}

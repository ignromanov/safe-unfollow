import { useEffect } from 'react';

import { usePWAInstallAnalytics } from '@/hooks/usePWAInstallAnalytics';
import { analytics, captureUTMParams } from '@/lib/analytics';

/**
 * Hook for Layout analytics concerns:
 * - UTM parameter capture on first render
 * - Initial page view tracking
 * - PWA install event tracking
 */
export function useLayoutAnalytics(): void {
  // Track PWA install events
  usePWAInstallAnalytics();

  // Capture UTM params from URL on first render
  useEffect(() => {
    captureUTMParams();
  }, []);

  // UTM attribution on first page view only (Umami built-in handles pageviews)
  useEffect(() => {
    analytics.pageView();
  }, []);
}

import { analytics } from '@/lib/analytics';
import { useEffect, useRef } from 'react';

/**
 * Track PWA install prompt and actual installation.
 *
 * Listens for:
 * - `beforeinstallprompt` — browser is ready to show install prompt
 * - `appinstalled` — user completed PWA installation
 *
 * Storage impact: Near-zero (~0-5 events/day, PWA installs are rare <1% of sessions).
 */
export function usePWAInstallAnalytics(): void {
  const hasTrackedPrompt = useRef(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = () => {
      if (!hasTrackedPrompt.current) {
        analytics.pwaInstallPrompt();
        hasTrackedPrompt.current = true;
      }
    };

    const handleAppInstalled = () => {
      analytics.pwaInstalled();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);
}

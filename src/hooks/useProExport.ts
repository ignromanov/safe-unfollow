/**
 * Pro Export state: feature gating, unlock status, and checkout kickoff.
 *
 * The license redirect-back is captured elsewhere (in Layout, a parent), so
 * its effect runs after this hook's first render — hence useSyncExternalStore
 * rather than a one-shot snapshot.
 */

import { useSyncExternalStore } from 'react';

import {
  getCheckoutUrl,
  isExportFeatureEnabled,
  isExportUnlocked,
  subscribeUnlock,
} from '@/lib/export/unlock';
import { analytics } from '@/lib/stats';

export interface UseProExportResult {
  isEnabled: boolean;
  isUnlocked: boolean;
  startCheckout: () => void;
}

// Module-level so the store identity stays stable across renders.
const getUnlockSnapshot = (): boolean => isExportFeatureEnabled() && isExportUnlocked();
const getServerUnlockSnapshot = (): boolean => false;

export function useProExport(): UseProExportResult {
  const isEnabled = isExportFeatureEnabled();
  const isUnlocked = useSyncExternalStore(
    subscribeUnlock,
    getUnlockSnapshot,
    getServerUnlockSnapshot
  );

  const startCheckout = (): void => {
    const checkoutUrl = getCheckoutUrl();
    if (!checkoutUrl) return;

    analytics.checkoutStart();
    window.location.href = checkoutUrl;
  };

  return { isEnabled, isUnlocked, startCheckout };
}

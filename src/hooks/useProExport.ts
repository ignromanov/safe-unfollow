/**
 * Pro Export state: feature gating, unlock status, and checkout kickoff.
 *
 * The license redirect-back is captured elsewhere (in Layout, a parent), so
 * its effect runs after this hook's first render — hence useSyncExternalStore
 * rather than a one-shot snapshot.
 */

import { useSyncExternalStore } from 'react';

import {
  buildCheckoutUrl,
  isExportFeatureEnabled,
  isExportUnlocked,
  subscribeUnlock,
} from '@/lib/export/unlock';
import { analytics } from '@/lib/stats';

export interface UseProExportResult {
  isEnabled: boolean;
  isUnlocked: boolean;
  /**
   * Both dimensions are supplied by the caller because this hook holds neither.
   * They ride on `checkout_start` so the paywall funnel can be split by locale
   * and by how much the reader was actually about to buy — see events.ts.
   */
  startCheckout: (locale: string, rowCount: number) => void;
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

  const startCheckout = (locale: string, rowCount: number): void => {
    const checkoutUrl = buildCheckoutUrl();
    if (!checkoutUrl) return;

    // After the guard, never before: an event reporting a checkout that never
    // started would inflate the only funnel step we can act on.
    analytics.checkoutStart(locale, rowCount);
    window.location.href = checkoutUrl;
  };

  return { isEnabled, isUnlocked, startCheckout };
}

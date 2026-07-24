/**
 * Pro Export state: feature gating, unlock status, and checkout kickoff.
 * Consumes the `?export=unlocked` redirect-back param on mount.
 */

import { analytics } from '@/lib/stats';
import {
  consumeUnlockParam,
  getCheckoutUrl,
  isExportFeatureEnabled,
  isExportUnlocked,
} from '@/lib/export/unlock';
import { useEffect, useState } from 'react';

export function useProExport() {
  const isEnabled = isExportFeatureEnabled();
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    if (!isEnabled) return;

    if (consumeUnlockParam()) {
      analytics.purchaseSuccess();
    }
    setIsUnlocked(isExportUnlocked());
  }, [isEnabled]);

  const startCheckout = (): void => {
    const checkoutUrl = getCheckoutUrl();
    if (!checkoutUrl) return;

    analytics.checkoutStart();
    window.location.href = checkoutUrl;
  };

  return { isEnabled, isUnlocked, startCheckout };
}

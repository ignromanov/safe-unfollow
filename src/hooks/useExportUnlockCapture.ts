/**
 * Captures the `?export=unlocked` redirect-back from checkout.
 *
 * Mounted in Layout rather than in the results view on purpose: the redirect
 * can land on any route, including one that renders no results at all (cleared
 * IndexedDB, a different browser, a receipt link opened days later). Capturing
 * it in a results-only component would silently drop a paid unlock.
 */

import { useEffect } from 'react';

import { consumeUnlockParam, isExportFeatureEnabled } from '@/lib/export/unlock';
import { analytics } from '@/lib/stats';

export function useExportUnlockCapture(): void {
  useEffect(() => {
    if (!isExportFeatureEnabled()) return;

    // consumeUnlockParam strips the param, so this reports at most once even if
    // the effect runs twice (StrictMode).
    if (consumeUnlockParam()) {
      analytics.purchaseSuccess();
    }
  }, []);
}

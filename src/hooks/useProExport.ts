/**
 * Pro Export state: feature gating, unlock status, and checkout kickoff.
 *
 * The license redirect-back is captured elsewhere (in Layout, a parent), so
 * its effect runs after this hook's first render — hence useSyncExternalStore
 * rather than a one-shot snapshot.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import {
  buildCheckoutUrl,
  isExportFeatureEnabled,
  isExportUnlocked,
  subscribeUnlock,
} from '@/lib/export/unlock';
import { analytics } from '@/lib/stats';

/**
 * What the checkout control is doing, as something it can be asked.
 *
 * There was no such question before: the press set `location.href` and the
 * button carried on looking pressable for however long the navigation took.
 * Two of the six real checkout sessions in the product's history tapped again
 * at 1.0-1.3s (GH#38) — too slow for a double-firing handler and too fast for
 * a considered retry, which is the signature of a control that acknowledges
 * nothing.
 */
export type CheckoutState = 'idle' | 'opening' | 'failed';

export interface UseProExportResult {
  isEnabled: boolean;
  isUnlocked: boolean;
  checkoutState: CheckoutState;
  /**
   * Both dimensions are supplied by the caller because this hook holds neither.
   * They ride on `checkout_start` so the paywall funnel can be split by locale
   * and by how much the reader was actually about to buy — see events.ts.
   */
  startCheckout: (locale: string, rowCount: number) => void;
  /** Returns the control to `idle` — for a modal that closed and may reopen. */
  resetCheckout: () => void;
}

/**
 * How long a redirect may take before the control comes back with a cause.
 *
 * Long enough that a slow redirect on a 3G connection is not called a failure,
 * short enough that a navigation which never happens does not leave a
 * permanently busy button. Never a silent return to `idle`: a control that
 * goes back to looking pressable without saying why teaches the reader to
 * press it again, which is the behaviour this whole state machine exists to
 * stop.
 */
const CHECKOUT_TIMEOUT_MS = 8_000;

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
  const [checkoutState, setCheckoutState] = useState<CheckoutState>('idle');
  const timeoutRef = useRef<number | null>(null);
  // A ref, not `checkoutState`: two presses in the same tick both read the
  // state from before the re-render and both start a checkout. The button is
  // disabled while opening, so React blocks the second press in practice — but
  // that makes the guard a property of how the consumer renders, and the count
  // this protects is the one funnel step we can act on. Same reason
  // ResultsExportControls guards its build with `isRunningRef`: state says what
  // to draw, a ref says what is already running.
  const isOpeningRef = useRef(false);

  const clearPendingTimeout = (): void => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // The timer outlives the component when the reader dismisses mid-redirect.
  useEffect(() => clearPendingTimeout, []);

  const startCheckout = (locale: string, rowCount: number): void => {
    if (isOpeningRef.current) return;

    // The same two dimensions `checkout_start` carries, handed to the processor
    // as metadata so a settled payment can be joined back to the paywall view
    // that produced it.
    const checkoutUrl = buildCheckoutUrl(locale, rowCount);
    if (!checkoutUrl) {
      // Unreachable from the UI, and still not a bare `return`. `getApiBase`
      // and `getCheckoutUrl` read the same VITE_DODO_CHECKOUT_URL
      // (license.ts:101, unlock.ts:118), so an unset value disables the feature
      // and the paywall never mounts (ResultsExportControls.tsx:81). The state
      // machine has no hole through which a press can produce nothing.
      setCheckoutState('failed');
      return;
    }

    isOpeningRef.current = true;
    setCheckoutState('opening');

    // After the guard, never before: an event reporting a checkout that never
    // started would inflate the only funnel step we can act on.
    analytics.checkoutStart(locale, rowCount);

    timeoutRef.current = window.setTimeout(() => {
      isOpeningRef.current = false;
      setCheckoutState('failed');
    }, CHECKOUT_TIMEOUT_MS);

    window.location.href = checkoutUrl;
  };

  const resetCheckout = (): void => {
    clearPendingTimeout();
    isOpeningRef.current = false;
    setCheckoutState('idle');
  };

  return { isEnabled, isUnlocked, checkoutState, startCheckout, resetCheckout };
}

import { useState, useCallback, useEffect } from 'react';

import type { UserSegment } from '@/lib/rescue-plan';

/**
 * Hook for managing rescue plan banner dismiss state with localStorage persistence.
 *
 * Features:
 * - 14-day TTL for dismiss state
 * - Segment change re-engagement (shows again if severity worsens)
 * - Stores segment info for analytics
 * - SSR-safe (checks window)
 */

const STORAGE_KEY = 'rescue_plan_dismissed';
const TTL_DAYS = 14;
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

/** Severity order for comparison (higher = worse) */
const SEVERITY_ORDER = {
  growth: 0,
  warning: 1,
  critical: 2,
} as const;

interface DismissState {
  dismissedAt: number;
  segment: string;
  severity: string;
}

/**
 * Check if dismiss state is still valid (within TTL and same/better severity)
 */
function getDismissState(currentSegment: UserSegment | null): {
  isDismissed: boolean;
  storedState: DismissState | null;
} {
  if (typeof window === 'undefined' || !currentSegment) {
    return { isDismissed: false, storedState: null };
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return { isDismissed: false, storedState: null };

  try {
    const state: DismissState = JSON.parse(stored);
    const now = Date.now();

    // Check TTL expiry
    if (now - state.dismissedAt > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return { isDismissed: false, storedState: null };
    }

    // Check if severity worsened (re-engage user)
    const storedSeverity = state.severity as keyof typeof SEVERITY_ORDER;
    const currentSeverity = currentSegment.severity;

    if (SEVERITY_ORDER[currentSeverity] > SEVERITY_ORDER[storedSeverity]) {
      // Severity worsened - show banner again (V9: re-engagement event removed)
      localStorage.removeItem(STORAGE_KEY);
      return { isDismissed: false, storedState: state };
    }

    return { isDismissed: true, storedState: state };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return { isDismissed: false, storedState: null };
  }
}

/**
 * Hook to manage rescue plan dismiss state
 *
 * @param segment - Current user segment for analytics and re-engagement detection
 * @returns isDismissed state and dismiss function
 */
export function useRescuePlanDismiss(segment: UserSegment | null) {
  // Initialize as false to avoid SSR hydration mismatch (localStorage not available during SSR)
  const [isDismissed, setIsDismissed] = useState(false);

  // Read localStorage client-side only, and re-check when segment changes (for re-engagement)
  useEffect(() => {
    if (!segment) return;

    const { isDismissed: newIsDismissed } = getDismissState(segment);
    setIsDismissed(newIsDismissed);
  }, [segment]);

  const dismiss = useCallback(() => {
    if (typeof window === 'undefined' || !segment) return;

    const state: DismissState = {
      dismissedAt: Date.now(),
      segment: `${segment.severity}_${segment.size}`,
      severity: segment.severity,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setIsDismissed(true);
  }, [segment]);

  return { isDismissed, dismiss };
}

/**
 * Clear dismiss state (for testing)
 */
export function clearRescuePlanDismiss(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

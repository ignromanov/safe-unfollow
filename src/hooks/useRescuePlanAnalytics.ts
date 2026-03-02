import { useCallback } from 'react';

import { analytics } from '@/lib/analytics';
import type { UserSegment, RescueTool } from '@/lib/rescue-plan';

/**
 * Hook for Rescue Plan Banner analytics tracking
 *
 * Consolidates all analytics logic:
 * - Impression tracking (once per session)
 * - Tool click tracking
 * - View time tracking (on unmount)
 * - Dismiss tracking
 */

interface UseRescuePlanAnalyticsOptions {
  segment: UserSegment;
  isVisible: boolean;
  isDevMode: boolean;
}

export function useRescuePlanAnalytics({
  segment,
  isVisible,
  isDevMode,
}: UseRescuePlanAnalyticsOptions) {
  // Handle tool click with analytics
  const handleToolClick = useCallback(
    (tool: RescueTool, e: React.MouseEvent) => {
      if (isDevMode) {
        e.preventDefault();
        return;
      }
      analytics.rescuePlanToolClick(tool.id, segment.severity, segment.size);
    },
    [segment, isDevMode]
  );

  // V9: rescuePlanDismiss event removed (low value). Dismiss still works via hook.
  const trackDismiss = useCallback(() => {
    // No-op: dismiss tracking removed in V9
  }, []);

  return {
    handleToolClick,
    trackDismiss,
  };
}

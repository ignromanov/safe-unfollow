import { useCallback, useEffect, useRef } from 'react';

import { analytics } from '@/lib/analytics';
import type { UserSegment, RescueTool } from '@/lib/rescue-plan';

/**
 * Hook for Rescue Plan Banner analytics tracking
 *
 * Consolidates all analytics logic:
 * - Impression tracking (once per session)
 * - Tool click tracking
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
  const impressionTrackedRef = useRef(false);

  // Track impression once per session
  useEffect(() => {
    if (!isDevMode && isVisible && !impressionTrackedRef.current) {
      impressionTrackedRef.current = true;
      analytics.rescuePlanImpression(
        segment.severity,
        segment.size,
        segment.totalAccounts,
        segment.unfollowedPercent
      );
    }
  }, [
    isVisible,
    isDevMode,
    segment.severity,
    segment.size,
    segment.totalAccounts,
    segment.unfollowedPercent,
  ]);

  // Handle tool click with analytics (includes position for slot analysis)
  const handleToolClick = useCallback(
    (tool: RescueTool, e: React.MouseEvent, position: number) => {
      if (isDevMode) {
        e.preventDefault();
        return;
      }
      analytics.rescuePlanToolClick(
        tool.id,
        position,
        segment.severity,
        segment.size,
        segment.totalAccounts
      );
    },
    [segment, isDevMode]
  );

  const trackDismiss = useCallback(() => {
    if (isDevMode) return;
    analytics.rescuePlanDismiss(segment.severity, segment.size, segment.totalAccounts);
  }, [segment, isDevMode]);

  return {
    handleToolClick,
    trackDismiss,
  };
}

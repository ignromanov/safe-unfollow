import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useRescuePlanDismiss } from '@/hooks/useRescuePlanDismiss';
import { useRescuePlanAnalytics } from '@/hooks/useRescuePlanAnalytics';
import {
  computeSegment,
  getToolsForSegment,
  SEVERITY_STYLES,
  SHOW_DELAY_BY_SEVERITY,
  type LossSeverity,
  type AccountSize,
  type UserSegment,
} from '@/lib/rescue-plan';

import { CollapsedBanner, ExpandedBanner, DevControls } from './rescue-plan';

/**
 * Rescue Plan Banner — Monetization Component
 *
 * Shows affiliate tool recommendations based on user segment.
 * Features:
 * - Tiered delayed show based on severity (15s/25s/40s)
 * - Segmentation by severity (critical/warning/growth) and size
 * - localStorage dismiss with 7-day TTL + segment change re-engagement
 * - Trust signals (badges, pricing, social proof)
 * - Analytics tracking (impression, click, dismiss, hover, view time)
 * - DEV: Test button to cycle through all severity/size combinations
 */

interface RescuePlanBannerProps {
  filterCounts: Record<string, number>;
  totalCount: number;
  /** Override delay (ms). If not provided, uses severity-based timing */
  showDelay?: number;
  /** Additional CSS classes for grid positioning */
  className?: string;
}

/** All severity/size combinations for DEV testing */
const ALL_SEVERITIES: LossSeverity[] = ['critical', 'warning', 'growth'];
const ALL_SIZES: AccountSize[] = ['influencer', 'power', 'regular', 'casual'];

export function RescuePlanBanner({
  filterCounts,
  totalCount,
  showDelay,
  className,
}: RescuePlanBannerProps) {
  const { t } = useTranslation('results');
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // DEV: Override segment for testing
  const [devOverride, setDevOverride] = useState<UserSegment | null>(null);
  const [devIndex, setDevIndex] = useState(0);

  // Compute user segment
  const realSegment = useMemo(
    () => computeSegment(filterCounts, totalCount),
    [filterCounts, totalCount]
  );

  // Use override in dev mode, otherwise real segment
  const segment = devOverride ?? realSegment;
  const isDevMode = devOverride !== null;

  // Get dismiss state from localStorage
  const { isDismissed, dismiss } = useRescuePlanDismiss(segment);

  // Get tools for this segment
  const tools = useMemo(() => getToolsForSegment(segment), [segment]);

  // Get styling for severity
  const style = SEVERITY_STYLES[segment.severity];

  // Use tiered delay based on severity, or override if provided
  const effectiveDelay = showDelay ?? SHOW_DELAY_BY_SEVERITY[segment.severity];

  // Check if no data available
  const unfollowedCount = filterCounts.unfollowed ?? 0;
  const hasNoData = !devOverride && (totalCount === 0 || unfollowedCount === 0);

  // Analytics tracking
  const { handleToolClick, trackDismiss } = useRescuePlanAnalytics({
    segment,
    isVisible,
    isDevMode,
  });

  // DEV: Cycle through all combinations
  const handleDevCycle = useCallback(() => {
    const totalCombinations = ALL_SEVERITIES.length * ALL_SIZES.length;
    const nextIndex = (devIndex + 1) % totalCombinations;
    setDevIndex(nextIndex);

    const severityIdx = Math.floor(nextIndex / ALL_SIZES.length);
    const sizeIdx = nextIndex % ALL_SIZES.length;

    const severity = ALL_SEVERITIES[severityIdx] ?? 'growth';
    const size = ALL_SIZES[sizeIdx] ?? 'casual';

    // Create mock segment
    const mockPercent = severity === 'critical' ? 15 : severity === 'warning' ? 5 : 1;
    const mockTotal =
      size === 'influencer' ? 15000 : size === 'power' ? 5000 : size === 'regular' ? 1000 : 200;

    setDevOverride({
      severity,
      size,
      unfollowedPercent: mockPercent,
      totalAccounts: mockTotal,
    });
  }, [devIndex]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
      }
    };
  }, []);

  // Show banner immediately, then expand after delay (desktop only)
  useEffect(() => {
    setIsVisible(true);

    // If dismissed, don't auto-expand
    if (isDismissed && !devOverride) return;

    // In dev mode with override, expand immediately
    if (devOverride) {
      setIsExpanded(true);
      return;
    }

    // Don't auto-expand on mobile — keep collapsed, let user tap to expand
    const isMobile =
      typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) return;

    // Auto-expand after delay (desktop only)
    showTimerRef.current = setTimeout(() => {
      setIsExpanded(true);
    }, effectiveDelay);

    return () => {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
      }
    };
  }, [isDismissed, effectiveDelay, devOverride]);

  // Handle dismiss (collapses instead of hiding)
  const handleDismiss = useCallback(() => {
    if (devOverride) {
      setDevOverride(null);
      setDevIndex(0);
      return;
    }
    trackDismiss();
    dismiss();
    setIsExpanded(false);
  }, [dismiss, devOverride, trackDismiss]);

  // Handle expand
  const handleExpand = useCallback(() => {
    setIsExpanded(true);
  }, []);

  // Don't render if no data OR not yet visible (unless dev override)
  if (hasNoData || (!isVisible && !devOverride)) return null;

  return (
    <div
      className={`relative bg-gradient-to-r ${style.gradientClass} border-2 ${style.borderClass} rounded-3xl shadow-xl animate-in fade-in slide-in-from-top-4 duration-300 transition-all ${className ?? ''}`}
      role="complementary"
      aria-label={t('rescue.ariaLabel')}
    >
      {/* DEV: Test controls */}
      <DevControls segment={segment} onCycle={handleDevCycle} />

      {isExpanded ? (
        <ExpandedBanner
          style={style}
          segment={segment}
          tools={tools}
          onDismiss={handleDismiss}
          onToolClick={handleToolClick}
        />
      ) : (
        <CollapsedBanner
          style={style}
          severity={segment.severity}
          unfollowedPercent={segment.unfollowedPercent}
          onExpand={handleExpand}
        />
      )}
    </div>
  );
}

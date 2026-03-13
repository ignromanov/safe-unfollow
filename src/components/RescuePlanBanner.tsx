import { useState, useCallback, useEffect, useMemo } from 'react';
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

import { ExpandedBanner, DevControls, EmpathyCard } from './rescue-plan';

/**
 * Rescue Plan Banner — Monetization Component
 *
 * Shows affiliate tool recommendations based on user segment.
 * Always expanded — dismiss hides completely for 7 days.
 * Features:
 * - Segmentation by severity (critical/warning/growth) and size
 * - localStorage dismiss with 7-day TTL + segment change re-engagement
 * - Trust signals (badges, pricing, social proof)
 * - Analytics tracking (impression, click, dismiss, hover, view time)
 * - DEV: Test button to cycle through all severity/size combinations
 */

interface RescuePlanBannerProps {
  filterCounts: Record<string, number>;
  totalCount: number;
  /** Additional CSS classes for grid positioning */
  className?: string;
}

/** All severity/size combinations for DEV testing */
const ALL_SEVERITIES: LossSeverity[] = ['critical', 'warning', 'growth'];
const ALL_SIZES: AccountSize[] = ['influencer', 'power', 'regular', 'casual'];

export function RescuePlanBanner({ filterCounts, totalCount, className }: RescuePlanBannerProps) {
  const { t } = useTranslation('results');

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

  // Delay banner appearance based on severity (let users explore first)
  const [isDelayComplete, setIsDelayComplete] = useState(false);
  useEffect(() => {
    if (devOverride) {
      setIsDelayComplete(true);
      return;
    }
    const delay = SHOW_DELAY_BY_SEVERITY[segment.severity];
    const timer = setTimeout(() => setIsDelayComplete(true), delay);
    return () => clearTimeout(timer);
  }, [segment.severity, devOverride]);

  // Check if no data available
  const unfollowedCount = filterCounts.unfollowed ?? 0;
  const hasNoData = !devOverride && (totalCount === 0 || unfollowedCount === 0);

  // Analytics tracking
  const { handleToolClick, trackDismiss } = useRescuePlanAnalytics({
    segment,
    isVisible: isDelayComplete && (!isDismissed || isDevMode),
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

  // Handle dismiss — hide completely
  const handleDismiss = useCallback(() => {
    if (devOverride) {
      setDevOverride(null);
      setDevIndex(0);
      return;
    }
    trackDismiss();
    dismiss();
  }, [dismiss, devOverride, trackDismiss]);

  // Don't render if no data, dismissed, or delay not complete
  if (hasNoData) return null;
  if (isDismissed && !devOverride) return null;
  if (!isDelayComplete) return null;

  return (
    <>
      <div
        className={`relative bg-gradient-to-r ${style.gradientClass} border-2 ${style.borderClass} rounded-3xl shadow-xl animate-in fade-in slide-in-from-top-4 duration-300 transition-all ${className ?? ''}`}
        role="complementary"
        aria-label={t('rescue.ariaLabel')}
      >
        {/* DEV: Test controls */}
        <DevControls segment={segment} onCycle={handleDevCycle} />

        <ExpandedBanner
          style={style}
          segment={segment}
          tools={tools}
          onDismiss={handleDismiss}
          onToolClick={handleToolClick}
        />
      </div>

      <EmpathyCard segment={segment} />
    </>
  );
}

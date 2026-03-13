import type { LucideIcon } from 'lucide-react';

/**
 * Rescue Plan Types
 *
 * Defines user segmentation and tool configuration for monetization banners.
 */

/** Severity based on unfollowed percentage */
export type LossSeverity = 'critical' | 'warning' | 'growth';

/** Account size tiers based on total accounts */
export type AccountSize = 'casual' | 'regular' | 'power' | 'influencer';

/** Tool category for grouping */
export type ToolCategory =
  | 'content'
  | 'engagement'
  | 'analytics'
  | 'design'
  | 'scheduling'
  | 'privacy'
  | 'productivity'
  | 'wellness';

/** Combined user segment (12 combinations) */
export interface UserSegment {
  severity: LossSeverity;
  size: AccountSize;
  unfollowedPercent: number;
  totalAccounts: number;
}

/** Pricing model for trust display */
export type ToolPricing = 'free' | 'freemium' | 'trial' | 'paid';

/** Badge type for visual hierarchy */
export type ToolBadge = 'popular' | 'trial' | 'new';

/** Tool definition for affiliate links */
export interface RescueTool {
  id: string;
  name: string;
  descKey: string;
  icon: LucideIcon;
  url: string;
  color: string;
  category: ToolCategory;
  /** Pricing model */
  pricing: ToolPricing;
  /** i18n key for pricing label (e.g., "rescue.price.freeTrial7") */
  priceKey: string;
  /** i18n key for social proof (e.g., "rescue.social.creators50k") */
  socialKey: string;
  /** Optional badge for visual hierarchy */
  badge?: ToolBadge;
}

/** Segment key for tool matrix lookup */
export type SegmentKey = `${LossSeverity}_${AccountSize}`;

/** Styling config for severity levels */
export interface SeverityStyle {
  iconType: 'alert' | 'warning' | 'growth';
  gradientClass: string;
  borderClass: string;
  iconColorClass: string;
  bgLightClass: string;
}

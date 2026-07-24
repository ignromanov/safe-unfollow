import { CalendarDays, BarChart3, Palette, Sparkles } from 'lucide-react';

import { AFFILIATE_LINKS } from '@/config/affiliate-links';
import type { RescueTool, UserSegment, SegmentKey } from './types';
import { getSegmentKey } from './segmentation';

/**
 * Tool Definitions and Selection Matrix
 *
 * Configures affiliate tools and maps user segments to recommended tools.
 */

/** All available rescue tools */
export const RESCUE_TOOLS: Record<string, RescueTool> = {
  publer: {
    id: 'publer',
    name: 'Publer',
    descKey: 'rescue.tools.publer',
    icon: CalendarDays,
    url: AFFILIATE_LINKS.publer,
    color: 'text-indigo-500',
    category: 'scheduling',
    pricing: 'freemium',
    priceKey: 'rescue.price.freePlan',
    socialKey: 'rescue.social.usersPubler',
    badge: 'new',
  },
  metricool: {
    id: 'metricool',
    name: 'Metricool',
    descKey: 'rescue.tools.metricool',
    icon: BarChart3,
    url: AFFILIATE_LINKS.metricool,
    color: 'text-orange-500',
    category: 'analytics',
    pricing: 'freemium',
    priceKey: 'rescue.price.freePlan',
    socialKey: 'rescue.social.usersMetricool',
  },
  vistacreate: {
    id: 'vistacreate',
    name: 'VistaCreate',
    descKey: 'rescue.tools.vistacreate',
    icon: Palette,
    url: AFFILIATE_LINKS.vistacreate,
    color: 'text-cyan-500',
    category: 'design',
    pricing: 'freemium',
    priceKey: 'rescue.price.freeForever',
    socialKey: 'rescue.social.designs10m',
  },
  predis: {
    id: 'predis',
    name: 'Predis.ai',
    descKey: 'rescue.tools.predis',
    icon: Sparkles,
    url: AFFILIATE_LINKS.predis,
    color: 'text-blue-500',
    category: 'content',
    pricing: 'freemium',
    priceKey: 'rescue.price.freePlan',
    socialKey: 'rescue.social.adsPredis',
    badge: 'popular',
  },
};

/**
 * Tool selection matrix: maps segment to recommended tools (ordered by priority)
 *
 * Revenue-optimized (Mar 2026):
 * - Predis.ai #1 most segments: highest CTR (55.8%) + highest LTV ($34-68)
 * - Metricool #1 for warning: rational "analyze what works" matches mindset
 * - Publer for casual/regular/power: best Trustpilot (4.8), high commission (50%+20%)
 * - Buffer/SocialPilot/VistaCreate removed (0 clicks, Jul 2026)
 *
 * Revenue LTV: Predis $34-68 > Metricool $50 > Publer $15-30
 */
const TOOL_MATRIX: Record<SegmentKey, string[]> = {
  // Critical - AI content first (emotional "fix it" impulse)
  critical_influencer: ['predis', 'metricool', 'publer'],
  critical_power: ['predis', 'metricool', 'publer'],
  critical_regular: ['predis', 'publer', 'metricool'],
  critical_casual: ['predis', 'publer', 'metricool'],

  // Warning - analytics first (rational "analyze what works")
  warning_influencer: ['metricool', 'predis', 'publer'],
  warning_power: ['metricool', 'predis', 'publer'],
  warning_regular: ['predis', 'metricool', 'publer'],
  warning_casual: ['publer', 'predis', 'metricool'],

  // Growth - scaling focus (consistency + AI content)
  growth_influencer: ['metricool', 'predis', 'publer'],
  growth_power: ['predis', 'metricool', 'publer'],
  growth_regular: ['predis', 'publer', 'metricool'],
  growth_casual: ['publer', 'predis', 'metricool'],
};

/** Default tools if segment not found */
const DEFAULT_TOOLS = ['predis', 'publer', 'metricool'];

/**
 * Get recommended tools for a user segment
 */
export function getToolsForSegment(segment: UserSegment): RescueTool[] {
  const key = getSegmentKey(segment);
  const toolIds = TOOL_MATRIX[key] ?? DEFAULT_TOOLS;
  return toolIds
    .map(id => RESCUE_TOOLS[id])
    .filter((tool): tool is RescueTool => tool !== undefined);
}

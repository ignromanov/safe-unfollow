import { CalendarDays, BarChart3, Sparkles } from 'lucide-react';
import { ExpandedBanner } from 'safe-unfollow';

// Real severity tokens from src/lib/rescue-plan/segmentation.ts
// (SEVERITY_STYLES) — hand-copied, not imported: previews only resolve
// 'safe-unfollow' and node_modules, not the app's internal @/lib/* aliases.
const CRITICAL_STYLE = {
  iconType: 'alert' as const,
  gradientClass: 'from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30',
  borderClass: 'border-red-200 dark:border-red-900',
  iconColorClass: 'text-red-500',
  bgLightClass: 'bg-red-100 dark:bg-red-900/50',
};
const WARNING_STYLE = {
  iconType: 'warning' as const,
  gradientClass: 'from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30',
  borderClass: 'border-amber-200 dark:border-amber-900',
  iconColorClass: 'text-amber-500',
  bgLightClass: 'bg-amber-100 dark:bg-amber-900/50',
};
const GROWTH_STYLE = {
  iconType: 'growth' as const,
  gradientClass: 'from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30',
  borderClass: 'border-emerald-200 dark:border-emerald-900',
  iconColorClass: 'text-emerald-500',
  bgLightClass: 'bg-emerald-100 dark:bg-emerald-900/50',
};

// Real tool entries from src/lib/rescue-plan/tools.ts (RESCUE_TOOLS).
// Affiliate URLs stand in for the real ones, which live in
// config/affiliate-links.ts and aren't reachable from a preview.
const PUBLER = {
  id: 'publer',
  name: 'Publer',
  descKey: 'rescue.tools.publer',
  icon: CalendarDays,
  url: 'https://publer.io',
  color: 'text-indigo-500',
  category: 'scheduling' as const,
  pricing: 'freemium' as const,
  priceKey: 'rescue.price.freePlan',
  socialKey: 'rescue.social.usersPubler',
  badge: 'new' as const,
};
const METRICOOL = {
  id: 'metricool',
  name: 'Metricool',
  descKey: 'rescue.tools.metricool',
  icon: BarChart3,
  url: 'https://metricool.com',
  color: 'text-orange-500',
  category: 'analytics' as const,
  pricing: 'freemium' as const,
  priceKey: 'rescue.price.freePlan',
  socialKey: 'rescue.social.usersMetricool',
};
const PREDIS = {
  id: 'predis',
  name: 'Predis.ai',
  descKey: 'rescue.tools.predis',
  icon: Sparkles,
  url: 'https://predis.ai',
  color: 'text-blue-500',
  category: 'content' as const,
  pricing: 'freemium' as const,
  priceKey: 'rescue.price.freePlan',
  socialKey: 'rescue.social.adsPredis',
  badge: 'popular' as const,
};

// Wrapper replicates the gradient/border card RescuePlanBanner.tsx mounts
// this inside — ExpandedBanner itself only owns the inner padding, not the
// chrome. RescuePlanBanner is NOT previewed here; see learnings.

// Tool order follows TOOL_MATRIX['critical_regular'] in tools.ts.
export function CriticalRegular() {
  return (
    <div
      className={`relative bg-gradient-to-r ${CRITICAL_STYLE.gradientClass} border-2 ${CRITICAL_STYLE.borderClass} rounded-3xl shadow-xl`}
    >
      <ExpandedBanner
        style={CRITICAL_STYLE}
        segment={{
          severity: 'critical',
          size: 'regular',
          unfollowedPercent: 14.3,
          totalAccounts: 1240,
        }}
        tools={[PREDIS, PUBLER, METRICOOL]}
        onDismiss={() => {}}
        onToolClick={() => {}}
      />
    </div>
  );
}

// Tool order follows TOOL_MATRIX['warning_power'].
export function WarningPower() {
  return (
    <div
      className={`relative bg-gradient-to-r ${WARNING_STYLE.gradientClass} border-2 ${WARNING_STYLE.borderClass} rounded-3xl shadow-xl`}
    >
      <ExpandedBanner
        style={WARNING_STYLE}
        segment={{
          severity: 'warning',
          size: 'power',
          unfollowedPercent: 6.2,
          totalAccounts: 4800,
        }}
        tools={[METRICOOL, PREDIS, PUBLER]}
        onDismiss={() => {}}
        onToolClick={() => {}}
      />
    </div>
  );
}

// Tool order follows TOOL_MATRIX['growth_casual']. Growth is the only
// severity with no urgency strip (that block only renders for critical/warning).
export function GrowthCasual() {
  return (
    <div
      className={`relative bg-gradient-to-r ${GROWTH_STYLE.gradientClass} border-2 ${GROWTH_STYLE.borderClass} rounded-3xl shadow-xl`}
    >
      <ExpandedBanner
        style={GROWTH_STYLE}
        segment={{ severity: 'growth', size: 'casual', unfollowedPercent: 1.1, totalAccounts: 320 }}
        tools={[PUBLER, PREDIS, METRICOOL]}
        onDismiss={() => {}}
        onToolClick={() => {}}
      />
    </div>
  );
}

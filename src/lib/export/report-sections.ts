import { BADGE_ORDER } from '@/core/badges';
import type { BadgeKey, BadgeMap } from '@/core/types';

export const REPORT_SECTIONS = ['notFollowingBack', 'notFollowedBack', 'mutuals', 'other'] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];

export const HTML_REPORT_MAX_ROWS = 50_000;

// Badge values are `true` or a follow timestamp; any truthy value means present.
// The three relationship badges are disjoint but do not cover following ∪ followers,
// so "other" is the remainder rather than a badge of its own.
export function reportSection(badges: BadgeMap): ReportSection {
  for (const section of REPORT_SECTIONS) {
    if (section !== 'other' && badges[section]) return section;
  }
  return 'other';
}

// Already implied by the section heading or by the report as a whole, so a row repeating them is noise.
const IMPLIED_LABELS: ReadonlySet<BadgeKey> = new Set<BadgeKey>([
  'following',
  'followers',
  'unfollowed',
]);

export function rowLabels(badges: BadgeMap, section: ReportSection): BadgeKey[] {
  return BADGE_ORDER.filter(key => badges[key] && key !== section && !IMPLIED_LABELS.has(key));
}

export type SectionCounts = Record<ReportSection, number>;

export interface SectionPlan {
  section: ReportSection;
  total: number;
  rendered: number;
}

export interface ReportPlan {
  sections: SectionPlan[];
  firstSectionTruncated: boolean;
}

export function planReport(
  counts: SectionCounts,
  limit: { maxRows: number; sampleLimit: number | null }
): ReportPlan {
  const present = REPORT_SECTIONS.filter(section => counts[section] > 0);
  const sections: SectionPlan[] = [];
  let used = 0;
  let stopped = false;

  for (const [index, section] of present.entries()) {
    const total = counts[section];
    let rendered: number;
    if (limit.sampleLimit !== null) {
      // A sample is the first N rows in report order, so a section may be cut part-way.
      rendered = Math.min(total, limit.sampleLimit - used);
    } else if (index === 0) {
      rendered = Math.min(total, limit.maxRows);
    } else if (!stopped && used + total <= limit.maxRows) {
      rendered = total;
    } else {
      // Once a section does not fit, later smaller ones must not jump ahead of it.
      stopped = true;
      rendered = 0;
    }
    used += rendered;
    sections.push({ section, total, rendered });
  }

  const first = sections[0];
  return {
    sections,
    firstSectionTruncated:
      limit.sampleLimit === null && first !== undefined && first.rendered < first.total,
  };
}

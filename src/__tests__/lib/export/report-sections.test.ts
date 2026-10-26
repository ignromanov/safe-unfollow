import { describe, expect, it } from 'vitest';

import {
  HTML_REPORT_MAX_ROWS,
  planReport,
  REPORT_SECTIONS,
  reportSection,
  rowLabels,
  type SectionCounts,
} from '@/lib/export/report-sections';

const counts = (c: Partial<SectionCounts>): SectionCounts => ({
  notFollowingBack: 0,
  notFollowedBack: 0,
  mutuals: 0,
  other: 0,
  ...c,
});

const rendered = (c: SectionCounts, limit: { maxRows: number; sampleLimit: number | null }) =>
  planReport(c, limit).sections.map(s => s.rendered);

describe('reportSection', () => {
  it('has a fixed section order and ceiling', () => {
    expect(REPORT_SECTIONS).toEqual(['notFollowingBack', 'notFollowedBack', 'mutuals', 'other']);
    expect(HTML_REPORT_MAX_ROWS).toBe(50_000);
  });

  it('returns the first match in section order', () => {
    expect(reportSection({ notFollowingBack: true, mutuals: true })).toBe('notFollowingBack');
    expect(reportSection({ notFollowedBack: 5, mutuals: true })).toBe('notFollowedBack');
    expect(reportSection({ mutuals: true })).toBe('mutuals');
  });

  it('puts an account in none of the three into other', () => {
    expect(reportSection({ following: 1, pending: true })).toBe('other');
    expect(reportSection({})).toBe('other');
  });
});

describe('rowLabels', () => {
  it('drops relationship badges, unfollowed and the section own badge, in BADGE_ORDER', () => {
    const badges = {
      close: true as const,
      restricted: true as const,
      unfollowed: true as const,
      mutuals: true as const,
      followers: 1,
      following: 1,
    };
    expect(rowLabels(badges, 'mutuals')).toEqual(['restricted', 'close']);
  });

  it('keeps every secondary badge in other', () => {
    expect(rowLabels({ following: 1, pending: true, dismissed: true }, 'other')).toEqual([
      'pending',
      'dismissed',
    ]);
  });
});

describe('planReport', () => {
  it('renders everything under the ceiling', () => {
    const plan = planReport(counts({ notFollowingBack: 3, mutuals: 2 }), {
      maxRows: 100,
      sampleLimit: null,
    });
    expect(plan.sections).toEqual([
      { section: 'notFollowingBack', total: 3, rendered: 3 },
      { section: 'mutuals', total: 2, rendered: 2 },
    ]);
    expect(plan.firstSectionTruncated).toBe(false);
  });

  it('stops at the first section that does not fit, without pulling later ones forward', () => {
    const plan = planReport(
      counts({ notFollowingBack: 30_000, notFollowedBack: 25_000, mutuals: 5_000 }),
      { maxRows: 50_000, sampleLimit: null }
    );
    expect(plan.sections.map(s => s.rendered)).toEqual([30_000, 0, 0]);
    expect(plan.firstSectionTruncated).toBe(false);
  });

  it('truncates the first section when it alone exceeds the ceiling', () => {
    const plan = planReport(counts({ notFollowingBack: 60_000, notFollowedBack: 10 }), {
      maxRows: 50_000,
      sampleLimit: null,
    });
    expect(plan.sections.map(s => s.rendered)).toEqual([50_000, 0]);
    expect(plan.firstSectionTruncated).toBe(true);
  });

  it('fills a sample greedily across sections, allowing a partial one', () => {
    const plan = planReport(counts({ notFollowingBack: 4, notFollowedBack: 20, mutuals: 100 }), {
      maxRows: 50_000,
      sampleLimit: 10,
    });
    expect(plan.sections.map(s => s.rendered)).toEqual([4, 6, 0]);
    expect(plan.firstSectionTruncated).toBe(false);
  });

  it('returns no sections for an empty view', () => {
    expect(rendered(counts({}), { maxRows: 50_000, sampleLimit: null })).toEqual([]);
  });
});

describe('planReport exact fit', () => {
  it('renders everything and truncates nothing when used + total equals the ceiling', () => {
    const plan = planReport(counts({ notFollowingBack: 30, mutuals: 20 }), {
      maxRows: 50,
      sampleLimit: null,
    });
    expect(plan.sections.map(s => [s.rendered, s.total])).toEqual([
      [30, 30],
      [20, 20],
    ]);
    expect(plan.firstSectionTruncated).toBe(false);
  });
});

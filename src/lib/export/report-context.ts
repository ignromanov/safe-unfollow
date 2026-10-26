import type { TFunction } from 'i18next';
import { BADGE_ORDER } from '@/core/badges';
import type { BadgeKey } from '@/core/types';
import { RTL_LANGUAGES, type SupportedLanguage } from '@/config/languages';
import type { DateLineKey } from '@/lib/follow-dates';
import { REPORT_SECTIONS, type ReportSection } from './report-sections';

// Private-use character: survives i18next interpolation escaping and never occurs in real copy.
// The worker replaces it with a value only it knows (a date, a row count).
export const SLOT = '\uE000';

export interface ReportStrings {
  title: string;
  madeOn: string;
  uploadedOn: string;
  scope: string;
  searchNarrowed: string | null;
  sampleLine: string | null;
  sectionHeadings: Record<ReportSection, string>;
  labels: Partial<Record<BadgeKey, string>>;
  dateLines: Record<DateLineKey, string>;
  caveats: {
    followRequests: string;
    truncatedFollowers: string;
    truncatedFollowing: string;
    datesStale: string;
  };
  ceilingTop: string;
  ceilingSection: string;
  footer: string;
}

export interface ReportContext {
  lang: string;
  dir: 'ltr' | 'rtl';
  strings: ReportStrings;
  sampleLimit: number | null;
}

// Deliberately has no query or file-name field: the report must not be able to carry either.
export interface ReportContextOptions {
  lang: string;
  filters: BadgeKey[];
  searchApplied: boolean;
  rowCount: number;
  totalCount: number;
  sampleLimit: number | null;
}

const DATE_LINE_KEYS: readonly DateLineKey[] = ['following', 'followers', 'mutual', 'requested'];

export function buildReportContext(
  t: TFunction<'results'>,
  o: ReportContextOptions
): ReportContext {
  const num = new Intl.NumberFormat(o.lang);
  // Keys are composed at runtime from closed unions, which the typed `t` cannot follow.
  const tr = t as unknown as (key: string, opts?: Record<string, unknown>) => string;

  const labels: Partial<Record<BadgeKey, string>> = {};
  for (const key of BADGE_ORDER) labels[key] = tr(`badges.${key}`);

  const sectionHeadings = Object.fromEntries(
    REPORT_SECTIONS.map(s => [s, tr(s === 'other' ? 'export.report.other' : `badges.${s}`)])
  ) as Record<ReportSection, string>;

  const dateLines = Object.fromEntries(
    DATE_LINE_KEYS.map(k => [k, tr(`dates.${k}`, { date: SLOT })])
  ) as Record<DateLineKey, string>;

  const counts = { count: num.format(o.rowCount), total: num.format(o.totalCount) };
  const scope =
    o.filters.length > 0
      ? tr('export.report.scopeFiltered', {
          // Filters are OR'd: a disjunction in the report's language says so ("A or B").
          filters: new Intl.ListFormat(o.lang, { type: 'disjunction' }).format(
            o.filters.map(f => labels[f] ?? f)
          ),
          ...counts,
        })
      : o.searchApplied
        ? tr('export.report.scopeSearched', counts)
        : tr('export.report.scopeAll', { total: counts.total });

  return {
    lang: o.lang,
    dir: RTL_LANGUAGES.includes(o.lang as SupportedLanguage) ? 'rtl' : 'ltr',
    sampleLimit: o.sampleLimit,
    strings: {
      title: tr('export.report.title'),
      madeOn: tr('export.report.madeOn', { date: SLOT }),
      uploadedOn: tr('export.report.uploadedOn', { date: SLOT }),
      scope,
      searchNarrowed: o.searchApplied ? tr('export.report.searchNarrowed') : null,
      sampleLine:
        o.sampleLimit === null
          ? null
          : tr('export.report.sampleLine', {
              shown: num.format(o.sampleLimit),
              total: num.format(o.rowCount),
            }),
      sectionHeadings,
      labels,
      dateLines,
      caveats: {
        followRequests: tr('export.report.caveat.followRequests'),
        truncatedFollowers: tr('export.report.caveat.truncatedFollowers'),
        truncatedFollowing: tr('export.report.caveat.truncatedFollowing'),
        datesStale: tr('export.report.caveat.datesStale'),
      },
      ceilingTop: tr('export.report.ceilingTop', { max: SLOT }),
      ceilingSection: tr('export.report.ceilingSection', { count: SLOT }),
      footer: tr('export.report.footer'),
    },
  };
}

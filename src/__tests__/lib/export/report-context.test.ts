import { describe, expect, it } from 'vitest';
import i18next, { type TFunction } from 'i18next';
import { buildReportContext, SLOT, type ReportContext } from '@/lib/export/report-context';
import { REPORT_SECTIONS } from '@/lib/export/report-sections';
import enResults from '../../../locales/en/results.json';

const t = ((k: string, o?: Record<string, unknown>) =>
  k + JSON.stringify(o ?? {})) as unknown as TFunction<'results'>;

const base = {
  lang: 'en',
  filters: [] as never[],
  searchApplied: false,
  rowCount: 5,
  totalCount: 5,
  sampleLimit: null,
};

describe('buildReportContext', () => {
  it('puts the worker slot exactly once in every date line', () => {
    const { strings } = buildReportContext(t, base);
    for (const line of Object.values(strings.dateLines)) {
      expect(line.split(SLOT).length - 1).toBe(1);
    }
  });

  it('derives direction from the language', () => {
    expect(buildReportContext(t, { ...base, lang: 'ar' }).dir).toBe('rtl');
    expect(buildReportContext(t, base).dir).toBe('ltr');
  });

  it('selects the all-accounts scope when nothing is filtered', () => {
    expect(buildReportContext(t, base).strings.scope).toContain('export.report.scopeAll');
  });

  it('does not say "all accounts" when only a search narrowed the view', () => {
    const { scope } = buildReportContext(t, {
      ...base,
      searchApplied: true,
      rowCount: 3,
      totalCount: 5000,
    }).strings;
    expect(scope).toContain('export.report.scopeSearched');
    expect(scope).not.toContain('scopeAll');
    expect(scope).toContain('"count":"3"');
    expect(scope).toContain('"total":"5,000"');
  });

  it('states a zero count under a search that matched nothing', () => {
    const { scope } = buildReportContext(t, {
      ...base,
      searchApplied: true,
      rowCount: 0,
      totalCount: 5000,
    }).strings;
    expect(scope).toContain('"count":"0"');
  });

  it('keeps the filtered scope when a filter and a search are both applied', () => {
    const { scope } = buildReportContext(t, {
      ...base,
      filters: ['close'],
      searchApplied: true,
      rowCount: 1,
    }).strings;
    expect(scope).toContain('export.report.scopeFiltered');
  });

  it('passes both localized badge names into the filtered scope', () => {
    const { scope } = buildReportContext(t, {
      ...base,
      filters: ['restricted', 'close'],
      rowCount: 2,
    }).strings;
    expect(scope).toContain('export.report.scopeFiltered');
    expect(scope).toContain('badges.restricted');
    expect(scope).toContain('badges.close');
  });

  // Filters are OR'd, so the list must read as a disjunction in the report's language.
  it.each([
    ['en', ' or '],
    ['id', ' atau '],
    ['ar', ' أو '],
  ])('joins filter names as a disjunction in %s', (lang, joiner) => {
    const { scope } = buildReportContext(t, {
      ...base,
      lang,
      filters: ['restricted', 'close'],
      rowCount: 2,
    }).strings;
    expect(scope).toContain(`badges.restricted{}${joiner}badges.close{}`);
  });

  it('marks a narrowing search only when one was applied', () => {
    expect(buildReportContext(t, base).strings.searchNarrowed).toBeNull();
    expect(
      buildReportContext(t, { ...base, searchApplied: true }).strings.searchNarrowed
    ).toContain('export.report.searchNarrowed');
  });

  it('has a sample block only for a capped export', () => {
    expect(buildReportContext(t, base).strings.sample).toBeNull();
    const capped = buildReportContext(t, { ...base, sampleLimit: 10 });
    expect(capped.sampleLimit).toBe(10);
    expect(capped.strings.sample?.body).toContain('export.report.sample.body');
  });

  it('reads the report-specific caveat keys, the stale one included', () => {
    const { caveats } = buildReportContext(t, base).strings;
    expect(caveats.followRequests).toContain('export.report.caveat.followRequests');
    expect(caveats.truncatedFollowers).toContain('export.report.caveat.truncatedFollowers');
    expect(caveats.truncatedFollowing).toContain('export.report.caveat.truncatedFollowing');
    expect(caveats.datesStale).toContain('export.report.caveat.datesStale');
  });

  it('carries no query text: the options have nowhere to put one', () => {
    const ctx = buildReportContext(t, { ...base, searchApplied: true });
    expect(JSON.stringify(ctx)).not.toContain('needle');
    buildReportContext(t, {
      ...base,
      // @ts-expect-error there is deliberately no query field
      query: 'needle',
    });
  });
});

describe('buildReportContext against the real English bundle', () => {
  const collect = (v: unknown, out: string[] = []): string[] => {
    if (typeof v === 'string') out.push(v);
    else if (v && typeof v === 'object') Object.values(v).forEach(x => collect(x, out));
    return out;
  };

  const build = async (): Promise<ReportContext> => {
    const i18n = i18next.createInstance();
    await i18n.init({
      lng: 'en',
      ns: ['results'],
      defaultNS: 'results',
      resources: { en: { results: enResults } },
      interpolation: { escapeValue: false },
    });
    return buildReportContext(i18n.getFixedT('en', 'results'), {
      lang: 'en',
      filters: ['restricted', 'close'],
      searchApplied: true,
      rowCount: 1930,
      totalCount: 5000,
      sampleLimit: 10,
    });
  };

  it('resolves every string: no raw key reaches the file', async () => {
    const { strings } = await build();
    for (const s of collect(strings)) {
      expect(s).not.toMatch(/^(export\.report|badges|caveat|dates)\./);
    }
  });

  it('puts the slot exactly once in each worker-filled string', async () => {
    const { strings } = await build();
    const filled = [
      strings.madeOn,
      strings.uploadedOn,
      strings.ceilingTop,
      strings.ceilingSection,
      ...Object.values(strings.dateLines),
    ];
    for (const s of filled) expect(s.split(SLOT).length - 1).toBe(1);
  });

  it('does not point at marks the report does not have', async () => {
    const { caveats } = (await build()).strings;
    expect(caveats.truncatedFollowers).not.toContain('marked below');
    expect(caveats.truncatedFollowing).not.toContain('marked below');
    expect(caveats.followRequests).not.toContain('pending-request counts');
  });

  it('resolves the searched scope line', async () => {
    const i18n = i18next.createInstance();
    await i18n.init({
      lng: 'en',
      ns: ['results'],
      defaultNS: 'results',
      resources: { en: { results: enResults } },
      interpolation: { escapeValue: false },
    });
    const { scope } = buildReportContext(i18n.getFixedT('en', 'results'), {
      lang: 'en',
      filters: [],
      searchApplied: true,
      rowCount: 0,
      totalCount: 5000,
      sampleLimit: null,
    }).strings;
    expect(scope).toBe('0 of 5,000 accounts');
  });

  it('names every report section', async () => {
    const { strings } = await build();
    for (const s of REPORT_SECTIONS) expect(strings.sectionHeadings[s]).toMatch(/\S/);
  });
});

describe('report strings against the real English bundle', () => {
  const collect = (v: unknown, out: string[] = []): string[] => {
    if (typeof v === 'string') out.push(v);
    else if (v && typeof v === 'object') Object.values(v).forEach(x => collect(x, out));
    return out;
  };

  const build = async (sampleLimit: number | null, rowCount = 3000) => {
    const i18n = i18next.createInstance();
    await i18n.init({
      lng: 'en',
      ns: ['results'],
      defaultNS: 'results',
      resources: { en: { results: enResults } },
      interpolation: { escapeValue: false },
    });
    return buildReportContext(i18n.getFixedT('en', 'results'), {
      lang: 'en',
      filters: [],
      searchApplied: false,
      rowCount,
      totalCount: rowCount,
      sampleLimit,
    }).strings;
  };

  it('builds no sample block when sampleLimit is null', async () => {
    expect((await build(null)).sample).toBeNull();
  });

  it('fills the sample body with formatted numbers', async () => {
    expect((await build(10)).sample?.body).toBe(
      'This file lists 10 of 3,000 accounts. The full export lists all of them.'
    );
  });

  it('keeps the slot in sample.more for the worker', async () => {
    expect((await build(10)).sample?.more).toBe(`+${SLOT} more in the full export`);
  });

  it('has an explainer for every report section', async () => {
    const { explain } = await build(null);
    expect(REPORT_SECTIONS.every(s => explain[s].length > 0)).toBe(true);
  });

  it('prints the privacy line velum-cdpo approved, verbatim', async () => {
    expect((await build(null)).privacyLine).toBe(
      'SafeUnfollow made this report in a browser and never sent the Instagram export behind it anywhere.'
    );
  });

  it('no report string says "full report"', () => {
    const report = (enResults as { export: { report: unknown } }).export.report;
    for (const s of collect(report)) expect(s).not.toMatch(/full report/i);
  });
});

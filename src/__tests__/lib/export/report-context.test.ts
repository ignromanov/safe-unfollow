import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { buildReportContext, SLOT } from '@/lib/export/report-context';

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

  it('marks a narrowing search only when one was applied', () => {
    expect(buildReportContext(t, base).strings.searchNarrowed).toBeNull();
    expect(
      buildReportContext(t, { ...base, searchApplied: true }).strings.searchNarrowed
    ).toContain('export.report.searchNarrowed');
  });

  it('has a sample line only for a capped export', () => {
    expect(buildReportContext(t, base).strings.sampleLine).toBeNull();
    const capped = buildReportContext(t, { ...base, sampleLimit: 10 });
    expect(capped.sampleLimit).toBe(10);
    expect(capped.strings.sampleLine).toContain('export.report.sampleLine');
  });

  it('joins caveat titles to their bodies and leaves the stale hint alone', () => {
    const { caveats } = buildReportContext(t, base).strings;
    expect(caveats.followRequests).toContain('caveat.followRequests.title');
    expect(caveats.followRequests).toContain('caveat.followRequests.body');
    expect(caveats.truncatedFollowers).toContain('caveat.truncated.followers.body');
    expect(caveats.datesStale).toContain('dates.staleHint');
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

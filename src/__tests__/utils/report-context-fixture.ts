import { REPORT_SECTIONS } from '@/lib/export/report-sections';
import { SLOT, type ReportContext } from '@/lib/export/report-context';
import type { DateLineKey } from '@/lib/follow-dates';

const DATE_LINE_KEYS: DateLineKey[] = ['following', 'followers', 'mutual', 'requested'];

/** Distinct, greppable strings so a test can tell which one reached the file. */
export function makeReport(overrides: Partial<ReportContext> = {}): ReportContext {
  return {
    lang: 'en',
    dir: 'ltr',
    sampleLimit: null,
    strings: {
      title: 'REPORT_TITLE',
      madeOn: `MADE_ON ${SLOT}`,
      uploadedOn: `UPLOADED_ON ${SLOT}`,
      scope: 'SCOPE_LINE',
      searchNarrowed: null,
      sectionHeadings: Object.fromEntries(
        REPORT_SECTIONS.map(s => [s, `HEADING_${s}`])
      ) as ReportContext['strings']['sectionHeadings'],
      explain: Object.fromEntries(
        REPORT_SECTIONS.map(s => [s, `EXPLAIN_${s}`])
      ) as ReportContext['strings']['explain'],
      sample: null,
      labels: { pending: 'LBL_PENDING', close: 'LBL_CLOSE' },
      dateLines: Object.fromEntries(
        DATE_LINE_KEYS.map(k => [k, `DATE_${k} ${SLOT}`])
      ) as ReportContext['strings']['dateLines'],
      caveats: {
        followRequests: 'CAVEAT_FOLLOW_REQUESTS',
        truncatedFollowers: 'CAVEAT_TRUNCATED_FOLLOWERS',
        truncatedFollowing: 'CAVEAT_TRUNCATED_FOLLOWING',
        datesStale: 'CAVEAT_DATES_STALE',
      },
      ceilingTop: `CEILING_TOP ${SLOT}`,
      ceilingSection: `CEILING_SECTION ${SLOT}`,
      footer: 'FOOTER_TEXT',
      privacyLine: 'PRIVACY_LINE',
    },
    ...overrides,
  };
}

// jsdom's Blob does not implement .text()/.arrayBuffer() — read via FileReader instead.
export function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

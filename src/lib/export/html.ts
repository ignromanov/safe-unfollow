/**
 * HTML report builder — one self-contained, script-free file from the reader's
 * current view. Runs in the export worker, so it uses string templates only.
 *
 * Memory contract: output is accumulated as one string per chunk per section
 * and handed to Blob as parts, never one string per row and never joined.
 * Two passes over the rows: the first only counts (so the section partition and
 * the ceiling are known), the second renders within each section's budget.
 */

import { namesTruncatedFile, type BadgeMap, type DateZones } from '@/core/types';
import type { FileMetadataRecord } from '@/lib/indexeddb/indexeddb-schema';
import { indexedDBService } from '@/lib/indexeddb/indexeddb-service';
import { createFollowDateFormatter, datesStale, pickDateLine } from '@/lib/follow-dates';
import { getExportRowCount, iterateAccountsForExport } from './data';
import { toIsoDay } from './dates';
import {
  escapeHtml,
  renderCallout,
  renderFooter,
  renderHead,
  renderMore,
  renderRow,
  renderSample,
  renderSectionOpen,
  renderTiles,
  renderTitle,
  SECTION_CLOSE,
} from './report-markup';
import { SLOT, type ReportContext } from './report-context';
import {
  HTML_REPORT_MAX_ROWS,
  planReport,
  REPORT_SECTIONS,
  reportSection,
  rowLabels,
  type ReportSection,
  type ReportPlan,
  type SectionCounts,
  type SectionPlan,
} from './report-sections';
import type { ExportProgressCallback } from './types';

type Record_ = FileMetadataRecord | null;

const fill = (template: string, value: string): string => template.replace(SLOT, () => value);

const paragraph = (text: string, cls: string): string =>
  `<p class="${cls}">${escapeHtml(text)}</p>`;

function countSections(counts: SectionCounts, badges: BadgeMap): void {
  counts[reportSection(badges)] += 1;
}

function renderBadgeRow(
  username: string,
  badges: BadgeMap,
  section: ReportSection,
  report: ReportContext,
  zones: DateZones | null,
  format: ReturnType<typeof createFollowDateFormatter>
): string {
  // Guards a key missing from the strings object. An unresolved i18n key is caught by the real-bundle test in report-context.test.ts, not here.
  const labels = rowLabels(badges, section).flatMap(key => report.strings.labels[key] ?? []);
  const line = zones ? pickDateLine(badges, zones) : null;
  return renderRow({
    username,
    labels,
    dateText: line
      ? fill(report.strings.dateLines[line.key], format(line.seconds, line.zone))
      : null,
    isoDay: line ? toIsoDay(line.seconds, line.zone) : null,
  });
}

function renderCaveats(record: Record_, report: ReportContext): string {
  const { caveats } = report.strings;
  let out = '';
  if (record?.followRequestsUnreadable) out += renderCallout(caveats.followRequests);
  if (record && namesTruncatedFile(record.truncatedRelationshipFile ?? 'not-applicable')) {
    out += renderCallout(
      record.truncatedRelationshipFile === 'followers'
        ? caveats.truncatedFollowers
        : caveats.truncatedFollowing
    );
  }
  if (datesStale(record)) out += renderCallout(caveats.datesStale);
  return out;
}

function renderHeader(
  record: Record_,
  report: ReportContext,
  plan: ReportPlan,
  now: number
): string {
  const { strings, lang } = report;
  const num = new Intl.NumberFormat(lang);
  const format = createFollowDateFormatter(lang);
  const day = (ms: number): string => format(ms / 1000, 'local');

  const meta = [fill(strings.madeOn, day(now))];
  const uploaded = record ? new Date(record.uploadDate).getTime() : NaN;
  if (
    Number.isFinite(uploaded) &&
    toIsoDay(uploaded / 1000, 'local') !== toIsoDay(now / 1000, 'local')
  ) {
    meta.push(fill(strings.uploadedOn, day(uploaded)));
  }
  let out = renderTitle(strings.title);
  out += paragraph(meta.join(' · '), 'meta');
  out += paragraph(strings.scope, 'meta');
  if (strings.searchNarrowed !== null) out += paragraph(strings.searchNarrowed, 'meta');
  out += renderTiles(
    plan.sections.map(s => ({
      section: s.section,
      count: num.format(s.total),
      label: strings.sectionHeadings[s.section],
      explain: strings.explain[s.section],
    }))
  );
  if (strings.sample !== null && plan.sections.some(s => s.rendered < s.total)) {
    const shown = plan.sections.reduce((sum, s) => sum + s.rendered, 0);
    const total = plan.sections.reduce((sum, s) => sum + s.total, 0);
    out += renderSample({
      head: strings.sample.head,
      body: strings.sample.body,
      shown,
      total,
      barLabel: `${num.format(shown)} / ${num.format(total)}`,
      cta: strings.sample.cta,
      ctaSub: strings.sample.ctaSub,
    });
  }
  out += renderCaveats(record, report);
  if (plan.firstSectionTruncated) {
    out += renderCallout(fill(strings.ceilingTop, num.format(HTML_REPORT_MAX_ROWS)));
  }
  return out;
}

function sectionNote(plan: SectionPlan, report: ReportContext): string | null {
  // Under a sample the sample line already says rows were left out.
  if (report.sampleLimit !== null || plan.rendered >= plan.total) return null;
  return fill(report.strings.ceilingSection, new Intl.NumberFormat(report.lang).format(plan.total));
}

function sectionParts(s: SectionPlan, report: ReportContext, rows: string[]): string[] {
  const num = new Intl.NumberFormat(report.lang);
  const { sample } = report.strings;
  const open = renderSectionOpen({
    id: s.section,
    heading: report.strings.sectionHeadings[s.section],
    count: num.format(s.total),
    explain: report.strings.explain[s.section],
    note: sectionNote(s, report),
  });
  const more =
    sample !== null && s.rendered < s.total
      ? [renderMore(fill(sample.more, num.format(s.total - s.rendered)))]
      : [];
  return [open, ...rows, ...more, SECTION_CLOSE];
}

export async function buildExportHtml(
  fileHash: string,
  indices: number[] | null,
  totalCount: number,
  report: ReportContext,
  onProgress?: ExportProgressCallback
): Promise<Blob> {
  const record = (await indexedDBService.getFileMetadata(fileHash)) ?? null;
  const zones = record?.dateZones ?? null;
  const total = getExportRowCount(indices, totalCount);

  // Pass 1: counts only, so the ceiling and the sample cut are decided before any markup.
  const counts: SectionCounts = { notFollowingBack: 0, notFollowedBack: 0, mutuals: 0, other: 0 };
  // Progress is one monotone scale over both passes: pass 1 fills the first half, pass 2 the second.
  let seen = 0;
  for await (const chunk of iterateAccountsForExport(fileHash, indices, totalCount)) {
    for (const { account } of chunk) countSections(counts, account.badges);
    seen += chunk.length;
    onProgress?.({ processed: Math.floor(Math.min(seen, total) / 2), total });
  }
  const plan = planReport(counts, {
    maxRows: HTML_REPORT_MAX_ROWS,
    sampleLimit: report.sampleLimit,
  });

  // Pass 2: render each row into its section while that section's budget lasts.
  const budget = new Map(plan.sections.map(s => [s.section, s.rendered]));
  const rowParts = new Map<ReportSection, string[]>(REPORT_SECTIONS.map(s => [s, []]));
  const format = createFollowDateFormatter(report.lang);
  let processed = 0;
  let remaining = plan.sections.reduce((sum, s) => sum + s.rendered, 0);

  for await (const chunk of iterateAccountsForExport(fileHash, indices, totalCount)) {
    if (remaining === 0) break;
    const buffers: Partial<Record<ReportSection, string>> = {};
    for (const { account } of chunk) {
      const section = reportSection(account.badges);
      const left = budget.get(section) ?? 0;
      if (left === 0) continue;
      budget.set(section, left - 1);
      remaining -= 1;
      buffers[section] =
        (buffers[section] ?? '') +
        renderBadgeRow(account.username, account.badges, section, report, zones, format);
    }
    for (const section of REPORT_SECTIONS) {
      const buffer = buffers[section];
      if (buffer) rowParts.get(section)?.push(buffer);
    }
    processed += chunk.length;
    onProgress?.({
      processed: Math.floor(total / 2) + Math.floor(Math.min(processed, total) / 2),
      total,
    });
  }
  // Pass 2 stops once every budget is spent; the export is still complete.
  onProgress?.({ processed: total, total });

  const now = Date.now();
  const madeDate = format(now / 1000, 'local');
  const parts: string[] = [
    renderHead({
      lang: report.lang,
      dir: report.dir,
      title: `${report.strings.title} · ${madeDate}`,
    }) + '</head><body><main>',
    renderHeader(record, report, plan, now),
  ];
  for (const s of plan.sections) {
    parts.push(...sectionParts(s, report, rowParts.get(s.section) ?? []));
  }
  parts.push(
    renderFooter(report.strings.footer, report.strings.privacyLine),
    '</main></body></html>'
  );
  return new Blob(parts, { type: 'text/html;charset=utf-8' });
}

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
  renderFooter,
  renderHead,
  renderRow,
  renderSectionOpen,
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
  // A badge with no resolved string is dropped: printing the internal key would put an English identifier in the reader's file.
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
  if (record?.followRequestsUnreadable) out += paragraph(caveats.followRequests, 'note');
  if (record && namesTruncatedFile(record.truncatedRelationshipFile ?? 'not-applicable')) {
    out += paragraph(
      record.truncatedRelationshipFile === 'followers'
        ? caveats.truncatedFollowers
        : caveats.truncatedFollowing,
      'note'
    );
  }
  if (datesStale(record)) out += paragraph(caveats.datesStale, 'note');
  return out;
}

function renderHeader(
  record: Record_,
  report: ReportContext,
  sections: SectionPlan[],
  firstSectionTruncated: boolean,
  now: number
): string {
  const { strings, lang } = report;
  const num = new Intl.NumberFormat(lang);
  const format = createFollowDateFormatter(lang);
  const day = (ms: number): string => format(ms / 1000, 'local');

  let out = `<h1>${escapeHtml(strings.title)}</h1>`;
  out += paragraph(fill(strings.madeOn, day(now)), 'meta');
  const uploaded = record ? new Date(record.uploadDate).getTime() : null;
  if (uploaded !== null && toIsoDay(uploaded / 1000, 'local') !== toIsoDay(now / 1000, 'local')) {
    out += paragraph(fill(strings.uploadedOn, day(uploaded)), 'meta');
  }
  out += paragraph(strings.scope, 'meta');
  if (strings.searchNarrowed !== null) out += paragraph(strings.searchNarrowed, 'meta');
  if (strings.sampleLine !== null) out += paragraph(strings.sampleLine, 'meta');
  if (sections.length > 0) {
    const summary = sections
      .map(s => `${strings.sectionHeadings[s.section]}: ${num.format(s.total)}`)
      .join(' · ');
    out += paragraph(summary, 'meta');
  }
  out += renderCaveats(record, report);
  if (firstSectionTruncated) {
    out += paragraph(fill(strings.ceilingTop, num.format(HTML_REPORT_MAX_ROWS)), 'note');
  }
  return out;
}

function sectionNote(plan: SectionPlan, report: ReportContext): string | null {
  // Under a sample the sample line already says rows were left out.
  if (report.sampleLimit !== null || plan.rendered >= plan.total) return null;
  return fill(report.strings.ceilingSection, new Intl.NumberFormat(report.lang).format(plan.total));
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
  for await (const chunk of iterateAccountsForExport(fileHash, indices, totalCount)) {
    for (const { account } of chunk) countSections(counts, account.badges);
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
    onProgress?.({ processed: Math.min(processed, total), total });
  }
  // Pass 2 stops once every budget is spent; the export is still complete.
  onProgress?.({ processed: total, total });

  const num = new Intl.NumberFormat(report.lang);
  const now = Date.now();
  const madeDate = format(now / 1000, 'local');
  const parts: string[] = [
    renderHead({
      lang: report.lang,
      dir: report.dir,
      title: `${report.strings.title} · ${madeDate}`,
    }) + '</head><body><main>',
    renderHeader(record, report, plan.sections, plan.firstSectionTruncated, now),
  ];
  for (const s of plan.sections) {
    parts.push(
      renderSectionOpen({
        id: s.section,
        heading: report.strings.sectionHeadings[s.section],
        count: num.format(s.total),
        note: sectionNote(s, report),
      }),
      ...(rowParts.get(s.section) ?? []),
      SECTION_CLOSE
    );
  }
  parts.push(renderFooter(report.strings.footer), '</main></body></html>');
  return new Blob(parts, { type: 'text/html;charset=utf-8' });
}

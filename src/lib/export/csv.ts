/**
 * CSV export builder — respects active filters/search and accumulates one
 * string per chunk (not per row), so a 1M-row export never holds a second
 * full copy of the output in memory.
 */

import type { BadgeKey, BadgeMap, DateZone, DateZones } from '@/core/types';
import { datedSeconds } from '@/lib/follow-dates';
import { indexedDBService } from '@/lib/indexeddb/indexeddb-service';
import { getExportRowCount, iterateAccountsForExport } from './data';
import { EXPORT_DATE_BADGES, toIsoDay } from './dates';
import type { ExportProgressCallback } from './types';

export const CSV_BADGE_COLUMNS: BadgeKey[] = [
  'following',
  'followers',
  'mutuals',
  'notFollowingBack',
  'notFollowedBack',
  'unfollowed',
  'pending',
  'permanent',
  'restricted',
  'close',
  'dismissed',
];

/**
 * Escapes a CSV field per RFC 4180: wraps in quotes and doubles any
 * embedded quotes if the value contains a comma, quote, or newline.
 */
export function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// No formula-injection guard needed: usernames are validated against
// /^[a-zA-Z0-9._]{1,30}$/ at parse time (see core/parsers), so they can never
// start with =, +, -, or @, and href is always a fixed https://instagram.com/
// prefix around that validated username.
function buildCsvRow(username: string, badges: BadgeMap, zones: DateZones | null): string {
  // Plain concatenation instead of map()+spread+join(): one row of a 1M-row
  // export would otherwise allocate two throwaway arrays.
  let row = escapeCsvField(username);
  row += `,${escapeCsvField(`https://instagram.com/${username}`)}`;
  for (const key of CSV_BADGE_COLUMNS) {
    row += badges[key] ? ',1' : ',0';
  }
  // Same predicate as `exportDates`, inlined so a row allocates no object. An
  // empty cell is "no date found"; the boolean column beside it says whether
  // the badge itself is present.
  for (const key of EXPORT_DATE_BADGES) {
    const seconds = zones ? datedSeconds(badges, zones, key) : null;
    row += seconds === null ? ',' : `,${toIsoDay(seconds, zones?.[key] as DateZone)}`;
  }
  return row;
}

/**
 * Builds a CSV Blob for the given (already filtered) account indices.
 * `indices === null` means "export all accounts".
 */
export async function buildExportCsv(
  fileHash: string,
  indices: number[] | null,
  totalCount: number,
  onProgress?: ExportProgressCallback
): Promise<Blob> {
  const header = [
    'username',
    'href',
    ...CSV_BADGE_COLUMNS,
    ...EXPORT_DATE_BADGES.map(key => `${key}Date`),
  ].join(',');
  // Absent on a file stored before #288: such a file has no displayable date.
  const zones = (await indexedDBService.getFileMetadata(fileHash))?.dateZones ?? null;
  // One Blob part per chunk. Blob accepts the parts array directly, so the
  // output is never materialized as a single joined string.
  const parts: string[] = [`${header}\n`];
  const total = getExportRowCount(indices, totalCount);
  let processed = 0;

  for await (const chunk of iterateAccountsForExport(fileHash, indices, totalCount)) {
    let buffer = '';
    for (const { account } of chunk) {
      buffer += `${buildCsvRow(account.username, account.badges, zones)}\n`;
    }
    if (buffer) parts.push(buffer);

    processed += chunk.length;
    onProgress?.({ processed, total });
  }

  return new Blob(parts, { type: 'text/csv;charset=utf-8' });
}

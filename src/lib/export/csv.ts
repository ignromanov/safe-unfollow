/**
 * CSV export builder — respects active filters/search and streams accounts
 * in chunks so a 1M-row export never holds the full account list in memory.
 */

import type { BadgeKey } from '@/core/types';
import { iterateAccountsForExport } from './data';

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
function buildCsvRow(username: string, badges: Record<string, unknown>): string {
  const href = `https://instagram.com/${username}`;
  const flags = CSV_BADGE_COLUMNS.map(key => (badges[key] ? '1' : '0'));
  return [escapeCsvField(username), escapeCsvField(href), ...flags].join(',');
}

/**
 * Builds a CSV Blob for the given (already filtered) account indices.
 * `indices === null` means "export all accounts".
 */
export async function buildExportCsv(
  fileHash: string,
  indices: number[] | null,
  totalCount: number
): Promise<Blob> {
  const header = ['username', 'href', ...CSV_BADGE_COLUMNS].join(',');
  const lines: string[] = [header];

  for await (const chunk of iterateAccountsForExport(fileHash, indices, totalCount)) {
    for (const { account } of chunk) {
      lines.push(buildCsvRow(account.username, account.badges));
    }
  }

  return new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
}

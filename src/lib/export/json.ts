/**
 * JSON export builder — respects active filters/search and streams accounts
 * in chunks so a 1M-row export never holds the full account list in memory.
 */

import { iterateAccountsForExport } from './data';

/**
 * Builds a JSON Blob for the given (already filtered) account indices.
 * `indices === null` means "export all accounts".
 */
export async function buildExportJson(
  fileHash: string,
  indices: number[] | null,
  totalCount: number
): Promise<Blob> {
  const parts: string[] = ['['];
  let isFirst = true;

  for await (const chunk of iterateAccountsForExport(fileHash, indices, totalCount)) {
    for (const { account } of chunk) {
      const entry = JSON.stringify({
        username: account.username,
        href: `https://instagram.com/${account.username}`,
        badges: account.badges,
      });
      parts.push(isFirst ? entry : `,${entry}`);
      isFirst = false;
    }
  }

  parts.push(']');
  return new Blob([parts.join('')], { type: 'application/json;charset=utf-8' });
}

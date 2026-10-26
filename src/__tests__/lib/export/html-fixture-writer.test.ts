/**
 * Writes synthetic HTML reports for the owner-device check (GH#286, Task 09).
 * Skipped unless WRITE_REPORT_FIXTURES names an output directory:
 *   WRITE_REPORT_FIXTURES=/tmp/su-report npm run test -- --run src/__tests__/lib/export/html-fixture-writer.test.ts
 * Usernames are synthetic (user_00001…); no real export is read.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import i18next from 'i18next';
import type { AccountBadges } from '@/core/types';
import { buildReportContext } from '@/lib/export/report-context';
import { readBlobText } from '../../utils/report-context-fixture';
import enResults from '../../../locales/en/results.json';
import arResults from '../../../locales/ar/results.json';

const { getAccountsByRange, getFileMetadata } = vi.hoisted(() => ({
  getAccountsByRange: vi.fn(),
  getFileMetadata: vi.fn(),
}));

vi.mock('@/lib/indexeddb/indexeddb-service', () => ({
  indexedDBService: { getAccountsByRange, getFileMetadata },
}));

const { buildExportHtml } = await import('@/lib/export/html');

const OUT = process.env.WRITE_REPORT_FIXTURES;
const DAY = 86_400;
const START = 1_609_459_200; // 2021-01-01T00:00:00Z

/** A mix close to a real account: 30% not following back, 20% not followed back, 40% mutual, 10% other. */
function at(i: number): AccountBadges {
  const username = `user_${String(i + 1).padStart(5, '0')}`;
  const since = START + (i % 1500) * DAY;
  const kind = i % 10;
  if (kind < 3) return { username, badges: { following: since, notFollowingBack: true } };
  if (kind < 5) return { username, badges: { followers: since, notFollowedBack: true } };
  if (kind < 9) {
    return {
      username,
      badges: {
        following: since,
        followers: since + DAY,
        mutuals: true,
        ...(kind === 8 ? { close: true } : {}),
      },
    };
  }
  return { username, badges: { following: since, pending: true } };
}

async function write(
  name: string,
  n: number,
  lang: 'en' | 'ar',
  resources: object
): Promise<number> {
  getAccountsByRange.mockImplementation((_h: string, start: number, end: number) =>
    Promise.resolve(Array.from({ length: Math.min(end, n) - start }, (_, k) => at(start + k)))
  );
  getFileMetadata.mockResolvedValue({
    fileName: 'synthetic.zip',
    uploadDate: new Date(2026, 9, 20, 9, 0, 0),
    dateZones: { following: 'utc', followers: 'utc' },
  });
  const i18n = i18next.createInstance();
  await i18n.init({
    lng: lang,
    ns: ['results'],
    defaultNS: 'results',
    resources: { [lang]: { results: resources } },
    interpolation: { escapeValue: false },
  });
  const report = buildReportContext(i18n.getFixedT(lang, 'results'), {
    lang,
    filters: [],
    searchApplied: false,
    rowCount: n,
    totalCount: n,
    sampleLimit: null,
  });
  const html = await readBlobText(await buildExportHtml('synthetic', null, n, report));
  const bytes = Buffer.byteLength(html, 'utf8');
  writeFileSync(join(OUT as string, name), html);
  return bytes;
}

describe.skipIf(!OUT)('report fixtures for the owner-device check', () => {
  it('writes report-3k-en, report-50k-en and report-3k-ar', async () => {
    mkdirSync(OUT as string, { recursive: true });
    const sizes = {
      'report-3k-en.html': await write('report-3k-en.html', 3_000, 'en', enResults),
      'report-50k-en.html': await write('report-50k-en.html', 50_000, 'en', enResults),
      'report-3k-ar.html': await write('report-3k-ar.html', 3_000, 'ar', arResults),
    };
    process.stdout.write(`report fixture sizes (bytes): ${JSON.stringify(sizes)}\n`);
    for (const bytes of Object.values(sizes)) expect(bytes).toBeGreaterThan(0);
  }, 120_000);
});

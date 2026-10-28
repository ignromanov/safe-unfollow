import { describe, expect, it, vi } from 'vitest';
import i18next from 'i18next';
import { buildReportContext } from '@/lib/export/report-context';
import { fixtureRow } from '../../utils/report-fixture-rows';
import { readBlobText } from '../../utils/report-context-fixture';
import enResults from '../../../locales/en/results.json';

const { getAccountsByRange, getFileMetadata } = vi.hoisted(() => ({
  getAccountsByRange: vi.fn(),
  getFileMetadata: vi.fn(),
}));

vi.mock('@/lib/indexeddb/indexeddb-service', () => ({
  indexedDBService: { getAccountsByRange, getFileMetadata },
}));

const { buildExportHtml } = await import('@/lib/export/html');

const BASELINE_50K_EN = 9_612_812; // html-fixture-writer, main @ 3476598, 2026-10-27
const N = 50_000;

describe('report byte budget', () => {
  it('a 50 000-row English report grows at most 5% over the pre-redesign file', async () => {
    getAccountsByRange.mockImplementation((_h: string, start: number, end: number) =>
      Promise.resolve(
        Array.from({ length: Math.min(end, N) - start }, (_, k) => fixtureRow(start + k))
      )
    );
    getFileMetadata.mockResolvedValue({
      fileName: 'synthetic.zip',
      uploadDate: new Date(2026, 9, 20, 9, 0, 0),
      dateZones: { following: 'utc', followers: 'utc' },
    });
    const i18n = i18next.createInstance();
    await i18n.init({
      lng: 'en',
      ns: ['results'],
      defaultNS: 'results',
      resources: { en: { results: enResults } },
      interpolation: { escapeValue: false },
    });
    const report = buildReportContext(i18n.getFixedT('en', 'results'), {
      lang: 'en',
      filters: [],
      searchApplied: false,
      rowCount: N,
      totalCount: N,
      sampleLimit: null,
    });
    const html = await readBlobText(await buildExportHtml('synthetic', null, N, report));
    const bytes = Buffer.byteLength(html, 'utf8');
    process.stdout.write(`50k bytes: ${bytes} ratio ${(bytes / BASELINE_50K_EN).toFixed(4)}\n`);
    // control: the fixture is still the 50k file
    expect(bytes).toBeGreaterThan(BASELINE_50K_EN * 0.9);
    expect(bytes).toBeLessThanOrEqual(Math.floor(BASELINE_50K_EN * 1.05));
  }, 120_000);
});

import { describe, expect, it } from 'vitest';
import { SUPPORTED_LANGUAGES } from '@/config/languages';
import en from '../../locales/en/results.json';

type Report = Record<string, string>;

const loadReport = async (lang: string): Promise<Report> =>
  (await import(`../../locales/${lang}/results.json`)).default.export.report;

const placeholders = (s: string): string[] => (s.match(/\{\{\s*\w+\s*\}\}/g) ?? []).sort();

// Derived from en so a key added there is gated everywhere without editing this file.
const KEYS = Object.keys((en as { export: { report: Report } }).export.report);

describe('export.report copy', () => {
  it('en defines keys at all', () => {
    expect(KEYS.length).toBeGreaterThan(0);
  });

  it.each(SUPPORTED_LANGUAGES)('%s has every key, non-empty, with en placeholders', async lang => {
    const report = await loadReport(lang);
    const enReport = await loadReport('en');
    for (const k of KEYS) {
      expect(report?.[k], `${lang} export.report.${k}`).toMatch(/\S/);
      expect(placeholders(report[k]), `${lang} export.report.${k}`).toEqual(
        placeholders(enReport[k])
      );
    }
  });
});

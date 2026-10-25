import { describe, expect, it } from 'vitest';
import { exportFilename } from '@/lib/export/filename';

describe('exportFilename', () => {
  it('should name the file by local download day', () => {
    const now = new Date(2026, 0, 5, 23, 59);
    expect(exportFilename('csv', { sample: false, now })).toBe('safeunfollow-2026-01-05.csv');
  });

  it('should mark a sample', () => {
    expect(exportFilename('csv', { sample: true, now: new Date(2026, 9, 25) })).toBe(
      'safeunfollow-2026-10-25-sample.csv'
    );
  });

  it('should carry the requested extension', () => {
    const now = new Date(2026, 9, 25);
    expect(exportFilename('json', { sample: false, now })).toBe('safeunfollow-2026-10-25.json');
    expect(exportFilename('html', { sample: false, now })).toBe('safeunfollow-2026-10-25.html');
  });
});

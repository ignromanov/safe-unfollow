import { describe, expect, it } from 'vitest';

import type { BadgeMap, DateZone, DateZones } from '@/core/types';
import { CSV_BADGE_COLUMNS } from '@/lib/export/csv';
import { EXPORT_DATE_BADGES, exportDates, toIsoDay } from '@/lib/export/dates';
import { TIME_BASED_BADGES } from '@/lib/indexeddb/indexeddb-schema';

const SEP30 = 1727654400; // 2024-09-30 00:00:00 UTC

describe('EXPORT_DATE_BADGES', () => {
  it('is every time-based badge except unfollowed, in CSV column order (GH#34)', () => {
    const expected = CSV_BADGE_COLUMNS.filter(
      key => TIME_BASED_BADGES.includes(key) && key !== 'unfollowed'
    );
    expect(expected.length).toBeGreaterThan(0);
    expect(EXPORT_DATE_BADGES).toEqual(expected);
  });
});

describe('toIsoDay', () => {
  it('reads a utc date from its UTC calendar day', () => {
    expect(toIsoDay(SEP30, 'utc')).toBe('2024-09-30');
    expect(toIsoDay(SEP30 + 86399, 'utc')).toBe('2024-09-30');
    expect(toIsoDay(SEP30 - 1, 'utc')).toBe('2024-09-29');
  });

  it('zero-pads month and day', () => {
    expect(toIsoDay(Date.UTC(2021, 0, 5) / 1000, 'utc')).toBe('2021-01-05');
  });

  // The file promises the reader the same calendar day the row shows. The row
  // formats with Intl, `timeZone: 'UTC'` for utc and the default zone for local
  // (`createFollowDateFormatter`); the export uses Date getters (25x faster at 1M,
  // plan E3). A 48 h sweep in 15-minute steps crosses a day boundary in every
  // zone the process can run in, including the :45 offsets.
  it.each<DateZone>(['utc', 'local'])(
    'gives the same calendar day as the on-screen formatter for %s dates',
    zone => {
      const parts = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: zone === 'utc' ? 'UTC' : undefined,
      });
      let compared = 0;
      for (let s = SEP30 - 86400; s <= SEP30 + 86400; s += 900) {
        const p = Object.fromEntries(parts.formatToParts(s * 1000).map(x => [x.type, x.value]));
        expect(toIsoDay(s, zone)).toBe(`${p.year}-${p.month}-${p.day}`);
        compared += 1;
      }
      expect(compared).toBe(193);
    }
  );
});

describe('exportDates', () => {
  const ZONES: DateZones = { following: 'utc', followers: 'local', unfollowed: 'utc' };

  it('keeps a dated badge as its ISO day', () => {
    expect(exportDates({ following: SEP30 }, ZONES)).toEqual({ following: '2024-09-30' });
  });

  it('drops every value that is not a storable date', () => {
    const badges = {
      following: true,
      followers: 0,
      pending: -5,
      permanent: 1.5,
    } as unknown as BadgeMap;
    const zones: DateZones = {
      following: 'utc',
      followers: 'utc',
      pending: 'utc',
      permanent: 'utc',
    };
    expect(exportDates(badges, zones)).toEqual({});
  });

  it('drops a date whose badge has no zone, as the row does', () => {
    expect(exportDates({ pending: SEP30 }, ZONES)).toEqual({});
  });

  it('never exports unfollowed, even dated and zoned', () => {
    expect(exportDates({ unfollowed: SEP30 }, ZONES)).toEqual({});
  });

  it('exports nothing for a file stored before date zones existed', () => {
    expect(exportDates({ following: SEP30 }, null)).toEqual({});
  });
});

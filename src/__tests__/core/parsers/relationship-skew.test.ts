import { describe, expect, it } from 'vitest';
import {
  MIN_TIMESTAMPS_FOR_SKEW,
  SKEW_THRESHOLD_DAYS,
  detectRelationshipSkew,
} from '@/core/parsers/relationship-skew';

const DAY = 86_400;

/**
 * A timestamp map with a known oldest entry and a known size.
 *
 * Only the oldest value and the count matter to the detector, so the rest are
 * spread forward a day at a time. Usernames are synthetic — the real exports
 * this fixture is derived from live in the gitignored `raw/` and carry real
 * people's handles, which must never reach a committed file.
 */
const mapWithOldest = (oldest: number, count: number, prefix = 'u'): Map<string, number> => {
  const entries = new Map<string, number>();
  for (let i = 0; i < count; i++) entries.set(`${prefix}${i}`, oldest + i * DAY);
  return entries;
};

describe('detectRelationshipSkew', () => {
  /**
   * Seven real exports of one account across a year, reduced to the only two
   * numbers per file the detector reads. Six were requested without a date
   * range; the seventh was requested with Meta's "Last year" preset and lost
   * two thirds of its followers.
   *
   * The six negatives are two numbers repeated, not six independent
   * observations — both oldest timestamps are fixed points of the account's
   * history and do not move between exports. That stability is exactly the
   * claim being pinned: a shift in one of them is the signal.
   *
   * `followersOldest - followingOldest` is -60 days in every healthy export,
   * to the second, and +4071 in the truncated one.
   */
  const REAL_EXPORTS = [
    {
      label: '2025-08-31',
      following: 328,
      followers: 294,
      fgOldest: 1403384748,
      frOldest: 1398234904,
      expected: 'no-skew',
    },
    {
      label: '2025-09-04',
      following: 313,
      followers: 284,
      fgOldest: 1403384748,
      frOldest: 1398234904,
      expected: 'no-skew',
    },
    {
      label: '2025-09-18',
      following: 315,
      followers: 290,
      fgOldest: 1403384748,
      frOldest: 1398234904,
      expected: 'no-skew',
    },
    {
      label: '2026-01-08',
      following: 353,
      followers: 324,
      fgOldest: 1403384748,
      frOldest: 1398234904,
      expected: 'no-skew',
    },
    {
      label: '2026-08-11-en',
      following: 413,
      followers: 364,
      fgOldest: 1403384748,
      frOldest: 1398234904,
      expected: 'no-skew',
    },
    {
      label: '2026-08-11-ru',
      following: 393,
      followers: 364,
      fgOldest: 1403384748,
      frOldest: 1398234904,
      expected: 'no-skew',
    },
    {
      label: '2026-08-13-ru',
      following: 393,
      followers: 118,
      fgOldest: 1403384748,
      frOldest: 1755143739,
      expected: 'followers',
    },
  ] as const;

  it.each(REAL_EXPORTS)(
    'reads $label as $expected',
    ({ following, followers, fgOldest, frOldest, expected }) => {
      expect(
        detectRelationshipSkew({
          following: mapWithOldest(fgOldest, following, 'fg'),
          followers: mapWithOldest(frOldest, followers, 'fr'),
        })
      ).toBe(expected);
    }
  );

  describe('threshold', () => {
    const base = 1_600_000_000;
    const at = (skewDays: number) =>
      detectRelationshipSkew({
        following: mapWithOldest(base, 50, 'fg'),
        followers: mapWithOldest(base + skewDays * DAY, 50, 'fr'),
      });

    it('does not fire one day below the threshold', () => {
      expect(at(SKEW_THRESHOLD_DAYS - 1)).toBe('no-skew');
    });

    it('fires exactly at the threshold', () => {
      expect(at(SKEW_THRESHOLD_DAYS)).toBe('followers');
    });

    // Direction is not assumed. Only the followers-short case has been observed
    // in the wild, from a single export; concluding from that one observation
    // that Meta always truncates followers would bake an untested guess into
    // the answer. The mirror image costs one sign and inflates `notFollowedBack`
    // instead.
    it('names following when following is the short list', () => {
      expect(at(-SKEW_THRESHOLD_DAYS)).toBe('following');
    });

    it('does not fire one day below the threshold in the mirror direction', () => {
      expect(at(-(SKEW_THRESHOLD_DAYS - 1))).toBe('no-skew');
    });
  });

  describe('guards', () => {
    const base = 1_600_000_000;
    const far = base + 1000 * DAY;

    it('fires at exactly the minimum sample size', () => {
      expect(
        detectRelationshipSkew({
          following: mapWithOldest(base, MIN_TIMESTAMPS_FOR_SKEW, 'fg'),
          followers: mapWithOldest(far, MIN_TIMESTAMPS_FOR_SKEW, 'fr'),
        })
      ).toBe('followers');
    });

    it('cannot judge one entry below the minimum sample size', () => {
      expect(
        detectRelationshipSkew({
          following: mapWithOldest(base, MIN_TIMESTAMPS_FOR_SKEW - 1, 'fg'),
          followers: mapWithOldest(far, MIN_TIMESTAMPS_FOR_SKEW, 'fr'),
        })
      ).toBe('insufficient-data');
    });

    it('cannot judge when either map is empty', () => {
      expect(
        detectRelationshipSkew({ following: new Map(), followers: mapWithOldest(far, 50, 'fr') })
      ).toBe('insufficient-data');
      expect(
        detectRelationshipSkew({ following: mapWithOldest(base, 50, 'fg'), followers: new Map() })
      ).toBe('insufficient-data');
    });

    /**
     * `instagram-following.ts` and `instagram-followers.ts` both store
     * `r.timestamp ?? 0`, so a record without a timestamp is a zero, not an
     * absence. Counting those would make the oldest entry the epoch and fire on
     * every export that has any.
     */
    it('ignores zero timestamps rather than treating them as 1970', () => {
      const zeroed = new Map<string, number>();
      for (let i = 0; i < 40; i++) zeroed.set(`z${i}`, 0);
      expect(
        detectRelationshipSkew({ following: zeroed, followers: mapWithOldest(far, 50, 'fr') })
      ).toBe('insufficient-data');

      const mixed = new Map(zeroed);
      for (let i = 0; i < MIN_TIMESTAMPS_FOR_SKEW; i++) mixed.set(`m${i}`, base + i * DAY);
      expect(
        detectRelationshipSkew({ following: mixed, followers: mapWithOldest(far, 50, 'fr') })
      ).toBe('followers');
    });

    it('cannot judge when the readable entries are too few', () => {
      const mostlyZero = new Map<string, number>();
      for (let i = 0; i < 400; i++) mostlyZero.set(`z${i}`, 0);
      for (let i = 0; i < MIN_TIMESTAMPS_FOR_SKEW - 1; i++) mostlyZero.set(`m${i}`, base + i * DAY);
      expect(
        detectRelationshipSkew({ following: mostlyZero, followers: mapWithOldest(far, 50, 'fr') })
      ).toBe('insufficient-data');
    });
  });
  /**
   * The defect this split exists to close.
   *
   * Both of these used to return `null`, and from that point every layer below
   * read them the same way: no caveat, no chip marked affected, and — the one
   * that matters — no analytics event, because `useFileUpload` gated on
   * truthiness. A parse that produced no usable timestamp at all was recorded
   * as a clean upload and left no trace anywhere.
   *
   * Asserted as a difference rather than as two values, because the bug was
   * never that either answer was wrong. It was that they were equal.
   */
  it('does not give the same answer for a clean export and an unjudgeable one', () => {
    const base = 1_600_000_000;
    const clean = detectRelationshipSkew({
      following: mapWithOldest(base, 50, 'fg'),
      followers: mapWithOldest(base, 50, 'fr'),
    });
    const unjudgeable = detectRelationshipSkew({
      following: new Map(),
      followers: new Map(),
    });

    expect(clean).not.toBe(unjudgeable);
  });
});

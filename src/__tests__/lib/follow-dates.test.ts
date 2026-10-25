import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES } from '@/config/languages';
import type { DateZones } from '@/core/types';
import { createFollowDateFormatter, pickDateLine, reservesDateLine } from '@/lib/follow-dates';

const L: DateZones = {
  following: 'local',
  followers: 'local',
  pending: 'local',
  permanent: 'local',
};
const SEP30 = 1727654400; // 2024-09-30 00:00:00 UTC

describe('pickDateLine', () => {
  it('prefers a request over everything else', () =>
    expect(pickDateLine({ pending: 5, following: 9 }, L)).toEqual({
      key: 'requested',
      seconds: 5,
      zone: 'local',
    }));
  it('uses permanent as a request', () =>
    expect(pickDateLine({ permanent: 7 }, L)?.key).toBe('requested'));
  it("mutual takes the later of the two dates, in that date's zone", () =>
    expect(
      pickDateLine(
        { following: 100, followers: 200, mutuals: true },
        { following: 'local', followers: 'utc' }
      )
    ).toEqual({ key: 'mutual', seconds: 200, zone: 'utc' }));
  it('a mutual with one date falls through to that badge', () => {
    expect(pickDateLine({ following: 100, followers: true }, L)?.key).toBe('following');
    expect(pickDateLine({ following: true, followers: 200 }, L)?.key).toBe('followers');
  });
  it('a number on a badge without a zone is not a date', () =>
    expect(pickDateLine({ following: 100 }, { followers: 'local' })).toBeNull());
  it('true, 0 and absent are not dates', () => {
    expect(pickDateLine({ following: true }, L)).toBeNull();
    expect(pickDateLine({ following: 0 }, L)).toBeNull();
    expect(pickDateLine({}, L)).toBeNull();
  });
  it('never produces a line for unfollowed, restricted, close or dismissed', () =>
    expect(
      pickDateLine(
        { unfollowed: 1, restricted: 2, close: 3, dismissed: 4 },
        { unfollowed: 'utc', restricted: 'utc', close: 'utc', dismissed: 'utc' }
      )
    ).toBeNull());
});

describe('reservesDateLine', () => {
  it('reserves only when a line badge has a zone', () => {
    expect(reservesDateLine(null)).toBe(false);
    expect(reservesDateLine({})).toBe(false);
    expect(reservesDateLine({ close: 'utc', unfollowed: 'utc' })).toBe(false);
    expect(reservesDateLine({ followers: 'utc' })).toBe(true);
  });
});

describe('createFollowDateFormatter', () => {
  it('formats a utc value in UTC whatever the viewer zone', () => {
    expect(createFollowDateFormatter('en', 'Asia/Jakarta')(SEP30, 'utc')).toBe('Sep 30, 2024');
    expect(createFollowDateFormatter('en', 'America/Asuncion')(SEP30, 'utc')).toBe('Sep 30, 2024');
  });
  it('formats a local value in the viewer zone', () =>
    expect(createFollowDateFormatter('en', 'America/Asuncion')(SEP30, 'local')).toBe(
      'Sep 29, 2024'
    ));
  it.each(SUPPORTED_LANGUAGES)('%s never shows a time of day', lang => {
    const text = createFollowDateFormatter(lang, 'UTC')(SEP30 + 18 * 3600 + 32 * 60, 'local');
    expect(text).not.toMatch(/\d{1,2}[:.]\d{2}/);
    expect(text).toMatch(/2024/);
  });
});

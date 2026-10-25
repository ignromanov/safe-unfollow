import type { BadgeKey, BadgeMap, DateZone, DateZones } from '@/core/types';

export type DateLineKey = 'requested' | 'mutual' | 'following' | 'followers';

export interface DateLine {
  key: DateLineKey;
  seconds: number;
  zone: DateZone;
}

const REQUEST_BADGES = ['pending', 'permanent'] as const;

export const LINE_BADGES: readonly BadgeKey[] = ['following', 'followers', ...REQUEST_BADGES];

// A number on a badge without a zone cannot be placed on a calendar, so it is not a date.
export function datedSeconds(badges: BadgeMap, zones: DateZones, key: BadgeKey): number | null {
  const value = badges[key];
  const dated =
    typeof value === 'number' && Number.isInteger(value) && value > 0 && zones[key] !== undefined;
  return dated ? value : null;
}

export function pickDateLine(badges: BadgeMap, zones: DateZones): DateLine | null {
  const line = (key: DateLineKey, badge: BadgeKey, seconds: number): DateLine => ({
    key,
    seconds,
    zone: zones[badge] as DateZone,
  });

  for (const badge of REQUEST_BADGES) {
    const seconds = datedSeconds(badges, zones, badge);
    if (seconds !== null) return line('requested', badge, seconds);
  }

  const following = datedSeconds(badges, zones, 'following');
  const followers = datedSeconds(badges, zones, 'followers');
  if (following !== null && followers !== null) {
    return followers > following
      ? line('mutual', 'followers', followers)
      : line('mutual', 'following', following);
  }
  if (following !== null) return line('following', 'following', following);
  return followers !== null ? line('followers', 'followers', followers) : null;
}

export function reservesDateLine(zones: DateZones | null): boolean {
  return zones !== null && LINE_BADGES.some(key => zones[key] !== undefined);
}

export type FollowDateFormatter = (seconds: number, zone: DateZone) => string;

const FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

export function createFollowDateFormatter(lang: string, viewerZone?: string): FollowDateFormatter {
  const make = (timeZone?: string) =>
    new Intl.DateTimeFormat(lang, { ...FORMAT_OPTIONS, timeZone });
  const local = make(viewerZone);
  const utc = make('UTC');
  return (seconds, zone) => (zone === 'utc' ? utc : local).format(seconds * 1000);
}

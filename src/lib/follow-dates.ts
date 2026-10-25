import type { BadgeKey, BadgeMap, DateZone, DateZones } from '@/core/types';

export type DateLineKey = 'requested' | 'mutual' | 'following' | 'followers';

export interface DateLine {
  key: DateLineKey;
  seconds: number;
  zone: DateZone;
}

export const LINE_BADGES: readonly BadgeKey[] = ['following', 'followers', 'pending', 'permanent'];

// A number on a badge without a zone cannot be placed on a calendar, so it is not a date.
function datedSeconds(badges: BadgeMap, zones: DateZones, key: BadgeKey): number | null {
  const value = badges[key];
  const dated =
    typeof value === 'number' && Number.isInteger(value) && value > 0 && zones[key] !== undefined;
  return dated ? value : null;
}

export function pickDateLine(badges: BadgeMap, zones: DateZones): DateLine | null {
  for (const key of ['pending', 'permanent'] as const) {
    const seconds = datedSeconds(badges, zones, key);
    if (seconds !== null) return { key: 'requested', seconds, zone: zones[key] as DateZone };
  }

  const following = datedSeconds(badges, zones, 'following');
  const followers = datedSeconds(badges, zones, 'followers');
  if (following !== null && followers !== null) {
    const later = followers > following ? 'followers' : 'following';
    return {
      key: 'mutual',
      seconds: Math.max(following, followers),
      zone: zones[later] as DateZone,
    };
  }
  if (following !== null) {
    return { key: 'following', seconds: following, zone: zones.following as DateZone };
  }
  if (followers !== null) {
    return { key: 'followers', seconds: followers, zone: zones.followers as DateZone };
  }
  return null;
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
  const local = new Intl.DateTimeFormat(lang, { ...FORMAT_OPTIONS, timeZone: viewerZone });
  const utc = new Intl.DateTimeFormat(lang, { ...FORMAT_OPTIONS, timeZone: 'UTC' });
  return (seconds, zone) => (zone === 'utc' ? utc : local).format(seconds * 1000);
}

/**
 * Follow dates as they leave in the export (GH#285 PR-3).
 *
 * A date is exported under exactly the rule that lets `/results` display it
 * (`datedSeconds`), and as the calendar day the row shows: the file and the
 * screen must not disagree about one account.
 */

import type { BadgeKey, BadgeMap, DateZone, DateZones } from '@/core/types';
import { datedSeconds } from '@/lib/follow-dates';
import { TIME_BASED_BADGES } from '@/lib/indexeddb/indexeddb-schema';

/**
 * Badges whose date is exported. `unfollowed` is left out because GH#34 ruled the
 * badge retired, and a retiring badge gets no new surface. The order matches
 * `CSV_BADGE_COLUMNS`, which a test enforces.
 */
export const EXPORT_DATE_BADGES: readonly BadgeKey[] = TIME_BASED_BADGES.filter(
  badge => badge !== 'unfollowed'
);

const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

/**
 * `YYYY-MM-DD` in the zone the row formats it in: UTC for wall-clock dates read as
 * UTC (HTML exports), the default zone for true epochs (JSON exports). Date getters
 * instead of Intl, because at 1M rows `formatToParts` measured ~25x slower.
 */
export function toIsoDay(seconds: number, zone: DateZone): string {
  const d = new Date(seconds * 1000);
  return zone === 'utc'
    ? `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
    : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The exportable dates of one account. `zones === null` means the file was stored
 * before date zones existed, and such a file has no displayable date at all.
 */
export function exportDates(
  badges: BadgeMap,
  zones: DateZones | null
): Partial<Record<BadgeKey, string>> {
  const dates: Partial<Record<BadgeKey, string>> = {};
  if (!zones) return dates;
  for (const badge of EXPORT_DATE_BADGES) {
    const seconds = datedSeconds(badges, zones, badge);
    if (seconds !== null) dates[badge] = toIsoDay(seconds, zones[badge] as DateZone);
  }
  return dates;
}

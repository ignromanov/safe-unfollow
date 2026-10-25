import type { BadgeKey, DateSources, DateZone } from '@/core/types';
import { relationshipFormatOf } from './instagram-file-specs';

// HTML exports record dates as UTC wall-clock; JSON exports record epoch
// seconds that the viewer's zone renders as the day Instagram showed.
const ZONE_OF_FORMAT = { html: 'utc', json: 'local' } as const satisfies Record<string, DateZone>;

/** The zone of the markup behind `paths`; `'mixed'` when both markups were read. */
export function zoneOfPaths(paths: readonly string[]): DateZone | 'mixed' | undefined {
  const zones = new Set<DateZone>();
  for (const path of paths) {
    const format = relationshipFormatOf(path);
    if (format) zones.add(ZONE_OF_FORMAT[format]);
  }
  if (zones.size > 1) return 'mixed';
  return [...zones][0];
}

export function collectDateSources(read: {
  following?: string;
  followers: readonly string[];
  optional: Partial<Record<BadgeKey, string | undefined>>;
}): DateSources {
  const paths: Partial<Record<BadgeKey, readonly string[]>> = {
    following: read.following ? [read.following] : [],
    followers: read.followers,
  };
  for (const [badge, path] of Object.entries(read.optional) as [BadgeKey, string | undefined][]) {
    paths[badge] = path ? [path] : [];
  }
  const sources: DateSources = {};
  for (const [badge, badgePaths] of Object.entries(paths) as [BadgeKey, readonly string[]][]) {
    const zone = zoneOfPaths(badgePaths);
    if (zone) sources[badge] = zone;
  }
  return sources;
}

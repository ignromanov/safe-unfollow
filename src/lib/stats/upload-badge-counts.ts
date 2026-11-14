import type { BadgeKey, FileExpectation } from '@/core/types';
import { indexedDBService } from '@/lib/indexeddb/indexeddb-service';

/**
 * Which export files a badge's count is computed from, by `FileSpec.name`.
 *
 * A `Record` over `BadgeKey`, so a new badge does not compile until someone
 * says where its number comes from. The three derived badges need both
 * relationship files: with one missing, their count is an artefact.
 */
export const BADGE_SOURCE_FILES: Record<BadgeKey, readonly string[]> = {
  following: ['following.json'],
  followers: ['followers_*.json'],
  pending: ['pending_follow_requests.json'],
  permanent: ['permanent_follow_requests.json'],
  restricted: ['restricted_profiles.json'],
  close: ['close_friends.json'],
  unfollowed: ['recently_unfollowed.json'],
  dismissed: ['dismissed_suggestions.json'],
  notFollowingBack: ['following.json', 'followers_*.json'],
  notFollowedBack: ['following.json', 'followers_*.json'],
  mutuals: ['following.json', 'followers_*.json'],
};

const snake = (key: string) => key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);

/**
 * `count_<badge>` for every badge this parse actually measured.
 *
 * `getBadgeStats` answers 0 both for a badge whose file was absent and for one
 * whose file was there and empty. A badge is sent only when every source file
 * was found and readable, so its absence from the row means "not measured",
 * and a 0 means zero. Flat keys, not one JSON string: Grafana charts them
 * without a parsing step.
 */
export function measuredBadgeCounts(
  stats: Partial<Record<BadgeKey, number>>,
  files: readonly FileExpectation[]
): Record<string, number> {
  const read = new Set(files.filter(f => f.found && !f.formatUnreadable).map(f => f.name));
  const counts: Record<string, number> = {};
  for (const [badge, sources] of Object.entries(BADGE_SOURCE_FILES)) {
    const count = stats[badge as BadgeKey];
    if (count !== undefined && sources.every(name => read.has(name))) {
      counts[`count_${snake(badge)}`] = count;
    }
  }
  return counts;
}

/**
 * The counts for a freshly stored parse, read by the parse worker after its
 * store. Imported by nothing in the entry chunk, so neither is the map above.
 * A failed read sends no counts rather than failing the upload.
 */
export async function readBadgeCounts(
  fileHash: string,
  files: readonly FileExpectation[]
): Promise<Record<string, number>> {
  try {
    const stats = await indexedDBService.getBadgeStats(fileHash);
    return stats ? measuredBadgeCounts(stats, files) : {};
  } catch {
    return {};
  }
}

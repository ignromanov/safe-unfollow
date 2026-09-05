import type { BadgeKey } from '@/core/types';

export type BadgeGroupId = 'relationship' | 'requests' | 'flags';

/**
 * Facet groups for the filter surface. OR within a group, AND across groups.
 *
 * Derived from the set math in `./index.ts`, not from the label text: group A
 * is everything computed from `following` and `followers`, group B is the two
 * request maps, group C is the four optional-file flags. Seven measured dead
 * ends are pairs inside group A, which is why they are a group.
 *
 * Membership is stated here and nowhere else. `groups.test.ts` derives the
 * partition from `BADGE_ORDER`, so a badge added without a group fails.
 */
export const BADGE_GROUPS: ReadonlyArray<{ id: BadgeGroupId; members: readonly BadgeKey[] }> = [
  {
    id: 'relationship',
    members: ['following', 'followers', 'mutuals', 'notFollowingBack', 'notFollowedBack'],
  },
  { id: 'requests', members: ['pending', 'permanent'] },
  { id: 'flags', members: ['unfollowed', 'restricted', 'close', 'dismissed'] },
] as const;

const GROUP_BY_BADGE: ReadonlyMap<BadgeKey, BadgeGroupId> = new Map(
  BADGE_GROUPS.flatMap(group => group.members.map(member => [member, group.id] as const))
);

export function groupOf(badge: BadgeKey): BadgeGroupId {
  const id = GROUP_BY_BADGE.get(badge);
  if (!id) throw new Error(`[badges] ungrouped badge: ${badge}`);
  return id;
}

import type { ParsedAll, AccountBadges, BadgeKey, TruncatedRelationshipFile } from '@/core/types';

// Helper function to collect all unique usernames
function collectAllUsernames(parsed: ParsedAll): Set<string> {
  return new Set<string>([
    ...parsed.following, // Accounts user follows
    ...parsed.followers, // Accounts that follow user
    ...parsed.pendingSent.keys(), // Pending follow requests
    ...parsed.permanentRequests.keys(), // Permanently rejected requests
    ...parsed.restricted.keys(), // Restricted profiles
    ...parsed.closeFriends.keys(), // Close friends
    ...parsed.unfollowed.keys(), // Recently unfollowed
    ...parsed.dismissedSuggestions.keys(), // Dismissed suggestions
  ]);
}

/**
 * Badges whose count is too HIGH when a follow-requests file is present and
 * unreadable (GH#41), because `computeDerivedRelationships` below subtracts
 * those files' accounts and an empty map subtracts nobody.
 *
 * Declared beside the subtraction that causes it, and read by `FilterChips` to
 * mark the chip: which badge inflates is a fact about the derivation, and a UI
 * component comparing against a badge key by hand is a third independent copy
 * of it. Only overstatement is listed — `pending` and `permanent` read the same
 * maps and fall to 0, which is a different failure the caveat's own copy names.
 */
export const BADGES_OVERSTATED_BY_UNREADABLE_REQUESTS: ReadonlySet<BadgeKey> = new Set([
  'notFollowingBack',
]);

/**
 * Badges whose count is wrong when one relationship file was cut short before
 * export — a date range picked in Meta's dialog filters `followers_*.json` by
 * entry timestamp and leaves `following.json` whole.
 *
 * A function rather than a constant, because unlike GH#41 the damage depends on
 * *which* file is short. The two cases are not disjoint and mostly overlap:
 * each names its own file's badge, plus the same three derived badges, which
 * are all read from both lists and so move whichever one lost people.
 *
 * Wrong in both directions, which is why this is not named "overstated" like
 * its GH#41 sibling. A short followers list inflates `notFollowingBack` — the
 * missing followers become accusations — and deflates `followers`, `mutuals`
 * and `notFollowedBack`, all of which are read from the list that lost people.
 * Measured on a real export: `notFollowingBack` 95 -> 294 while mutuals fell
 * 298 -> 99. Telling the reader only about the inflated number would leave them
 * believing they have a third of the friends they have.
 *
 * All four of every case are here because a smaller set was wrong: the first
 * version of this listed three and omitted `notFollowedBack`, which is
 * `followers` minus `following` and so shrinks with the file. `badges.test.ts`
 * derives the real answer from `computeDerivedRelationships` rather than
 * restating this list, and caught it. Keep that test honest and this list can
 * stay hand-written.
 *
 * `pending`, `permanent` and the other optional-file badges are untouched:
 * they are read from their own files, which the date range does not filter.
 */
const NO_BADGES: ReadonlySet<BadgeKey> = new Set<BadgeKey>();

export function badgesAffectedByTruncation(
  truncated: TruncatedRelationshipFile
): ReadonlySet<BadgeKey> {
  // A shared constant, not a fresh empty Set: `FilterChips` calls this on every
  // render and almost every export is untruncated, so this is the hot answer.
  if (truncated === null) return NO_BADGES;

  // The short file's own badge, plus the three derived from both lists. Written
  // as one expression rather than a literal per case: the two cases used to be
  // spelled out separately, with the three shared badges in a different order
  // each time, so telling them apart meant diffing two four-element lists to
  // find the single element that differs.
  return new Set<BadgeKey>([truncated, 'notFollowingBack', 'notFollowedBack', 'mutuals']);
}

// Helper function to compute derived relationship categories
function computeDerivedRelationships(parsed: ParsedAll) {
  // notFollowingBack: User follows but account doesn't follow back (excluding pending/permanent requests)
  //
  // GH#41: the two request exclusions come from optional files that can be
  // present and unreadable, in which case their maps are empty, nobody is
  // subtracted, and this badge silently overstates itself. `ParseResult`
  // carries `followRequestsUnreadable` for exactly this, and `/results` renders
  // a caveat from it. Adding a THIRD exclusion here means asking whether that
  // flag still covers the badge — `badges.test.ts` fails until someone does.
  // What they must set is `feedsNotFollowingBackExclusion` on the new file's
  // spec (`instagram-file-specs.ts`); the flag is what the caveat folds over.
  const notFollowingBack = new Set(
    [...parsed.following].filter(
      u =>
        !parsed.followers.has(u) && !parsed.pendingSent.has(u) && !parsed.permanentRequests.has(u)
    )
  );

  // notFollowedBack: Account follows but user doesn't follow back
  const notFollowedBack = new Set([...parsed.followers].filter(u => !parsed.following.has(u)));

  // mutuals: Both user and account follow each other
  const mutuals = new Set([...parsed.following].filter(u => parsed.followers.has(u)));

  return { notFollowingBack, notFollowedBack, mutuals };
}

// Helper function to build badges for a single account
function buildAccountBadges(
  username: string,
  parsed: ParsedAll,
  derived: ReturnType<typeof computeDerivedRelationships>
): AccountBadges['badges'] {
  const badges: Record<string, number | true> = {};

  // Core relationship badges (with timestamps when available)
  if (parsed.following.has(username))
    badges.following = parsed.followingTimestamps.get(username) ?? true;
  if (parsed.followers.has(username))
    badges.followers = parsed.followersTimestamps.get(username) ?? true;

  // Special relationship badges (with timestamps)
  if (parsed.pendingSent.has(username)) badges.pending = parsed.pendingSent.get(username) ?? 0;
  if (parsed.permanentRequests.has(username))
    badges.permanent = parsed.permanentRequests.get(username) ?? 0;
  if (parsed.restricted.has(username)) badges.restricted = parsed.restricted.get(username) ?? 0;
  if (parsed.closeFriends.has(username)) badges.close = parsed.closeFriends.get(username) ?? 0;
  if (parsed.unfollowed.has(username)) badges.unfollowed = parsed.unfollowed.get(username) ?? 0;
  if (parsed.dismissedSuggestions.has(username))
    badges.dismissed = parsed.dismissedSuggestions.get(username) ?? 0;

  // Computed relationship badges (boolean flags)
  if (derived.notFollowingBack.has(username)) badges.notFollowingBack = true;
  if (derived.notFollowedBack.has(username)) badges.notFollowedBack = true;
  if (derived.mutuals.has(username)) badges.mutuals = true;

  return badges as AccountBadges['badges'];
}

export function buildAccountBadgeIndex(parsed: ParsedAll): AccountBadges[] {
  const usernames = collectAllUsernames(parsed);
  const derived = computeDerivedRelationships(parsed);

  // Build badge index for each account
  const list: AccountBadges[] = [];
  for (const username of usernames) {
    const badges = buildAccountBadges(username, parsed, derived);
    list.push({ username, badges });
  }

  // Sort accounts alphabetically by username
  const result = list.sort((a, b) => a.username.localeCompare(b.username));
  return result;
}

// Pure helper for filtering logic (OR). Exported for tests.
export function filterAccountsByBadges(
  accounts: AccountBadges[],
  selected: Set<BadgeKey>,
  query?: string
): AccountBadges[] {
  if (selected.size === 0) return [];

  const q = (query ?? '').toLowerCase();
  return accounts.filter(acc => {
    // Filter by username query (case-insensitive)
    if (q && !acc.username.includes(q)) return false;

    // Filter by selected badges (OR logic - account needs at least one selected badge)
    for (const k of selected) if (acc.badges[k]) return true;
    return false;
  });
}

// Order of badges in UI (defines display priority)
export const BADGE_ORDER: readonly BadgeKey[] = [
  'following', // Core relationships first
  'followers',
  'mutuals',
  'notFollowingBack', // Problematic relationships
  'notFollowedBack',
  'pending', // Special states
  'permanent',
  'restricted',
  'close', // Special features
  'unfollowed', // Historical data
  'dismissed',
] as const;

// V3 Color scheme using OKLCH for perceptual uniformity
export const BADGE_COLORS: Record<BadgeKey, string> = {
  following:
    'bg-[oklch(0.6_0.15_250_/_0.12)] text-[oklch(0.6_0.15_250)] border-[oklch(0.6_0.15_250_/_0.2)]',
  followers:
    'bg-[oklch(0.7_0.15_150_/_0.12)] text-[oklch(0.6_0.18_150)] border-[oklch(0.7_0.15_150_/_0.2)]',
  mutuals:
    'bg-[oklch(0.6_0.18_264_/_0.12)] text-[oklch(0.6_0.18_264)] border-[oklch(0.6_0.18_264_/_0.2)]',
  notFollowingBack:
    'bg-[oklch(0.6_0.2_25_/_0.12)] text-[oklch(0.6_0.2_25)] border-[oklch(0.6_0.2_25_/_0.2)]',
  notFollowedBack:
    'bg-[oklch(0.75_0.15_80_/_0.12)] text-[oklch(0.7_0.18_80)] border-[oklch(0.75_0.15_80_/_0.2)]',
  pending:
    'bg-[oklch(0.7_0.15_50_/_0.12)] text-[oklch(0.65_0.18_50)] border-[oklch(0.7_0.15_50_/_0.2)]',
  permanent:
    'bg-[oklch(0.55_0.2_25_/_0.12)] text-[oklch(0.55_0.2_25)] border-[oklch(0.55_0.2_25_/_0.2)]',
  restricted:
    'bg-[oklch(0.5_0_0_/_0.12)] text-[oklch(0.4_0_0)] dark:text-[oklch(0.8_0_0)] border-[oklch(0.5_0_0_/_0.2)]',
  close:
    'bg-[oklch(0.65_0.2_340_/_0.12)] text-[oklch(0.65_0.2_340)] border-[oklch(0.65_0.2_340_/_0.2)]',
  unfollowed:
    'bg-[oklch(0.6_0.22_25_/_0.15)] text-[oklch(0.55_0.25_25)] border-[oklch(0.6_0.22_25_/_0.3)] font-bold',
  dismissed:
    'bg-[oklch(0.5_0.05_250_/_0.12)] text-[oklch(0.5_0.05_250)] border-[oklch(0.5_0.05_250_/_0.2)]',
} as const;

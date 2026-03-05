export type BadgeKey =
  | 'following' // User follows this account
  | 'followers' // This account follows the user
  | 'pending' // Outgoing follow request is pending
  | 'permanent' // Follow request was permanently rejected
  | 'restricted' // Account has restricted profile
  | 'close' // Account is marked as close friend
  | 'unfollowed' // Account was recently unfollowed
  | 'dismissed' // Account suggestion was dismissed
  | 'notFollowingBack' // User follows but account doesn't follow back (excluding pending/permanent)
  | 'notFollowedBack' // Account follows but user doesn't follow back
  | 'mutuals'; // Both user and account follow each other

// Time-based badges that store Unix timestamps (seconds since epoch)
export type TimeBasedBadgeKey =
  | 'following'
  | 'followers'
  | 'pending'
  | 'permanent'
  | 'restricted'
  | 'close'
  | 'unfollowed'
  | 'dismissed';

// Boolean badges (computed, not from Instagram data)
export type BooleanBadgeKey = 'notFollowingBack' | 'notFollowedBack' | 'mutuals';

// Typed badge maps for each category
export type TimeBadges = Partial<Record<TimeBasedBadgeKey, number>>;
export type BoolBadges = Partial<Record<BooleanBadgeKey, true>>;

// Combined badge map with proper types per category
export type BadgeMap = TimeBadges & BoolBadges;

// Legacy type alias for backward compatibility
export type BadgeValue = number | true;

export interface AccountBadges {
  username: string;
  badges: BadgeMap;
}

// Type guards for badge value access
export function isTimeBadge(key: BadgeKey): key is TimeBasedBadgeKey {
  return [
    'following',
    'followers',
    'pending',
    'permanent',
    'restricted',
    'close',
    'unfollowed',
    'dismissed',
  ].includes(key);
}

export function isBoolBadge(key: BadgeKey): key is BooleanBadgeKey {
  return ['notFollowingBack', 'notFollowedBack', 'mutuals'].includes(key);
}

// Safe accessors for typed badge values
export function getTimestamp(badges: BadgeMap, key: TimeBasedBadgeKey): number | undefined {
  return badges[key];
}

export function hasBoolBadge(badges: BadgeMap, key: BooleanBadgeKey): boolean {
  return badges[key] === true;
}

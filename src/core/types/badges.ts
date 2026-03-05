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

// Combined badge map: time-based badges store Unix timestamps, boolean badges store `true`
export type BadgeMap = Partial<Record<BadgeKey, number | true>>;

export interface AccountBadges {
  username: string;
  badges: BadgeMap;
}

export interface InstagramListItem {
  href: string;
  value?: string; // username (old format) - now optional, username may be in parent entry.title
  timestamp?: number;
}

export interface InstagramExportEntry {
  title: string;
  string_list_data: InstagramListItem[];
  media_list_data: unknown[];
}

/** One `{ label, value }` pair inside a `label_values` entry. */
export interface InstagramLabelValue {
  label?: string;
  value?: string;
}

/**
 * Entry shape introduced by the 2026-08 export. It carries neither `title` nor
 * `string_list_data`; every field is behind a **localised** label, so the
 * username cannot be found by key name — see `instagram-labels.ts` for how the
 * label is resolved per archive.
 *
 * `fbid` is Instagram's internal account id. It is declared because the shape
 * has it, not because anything reads it: it identifies a person more durably
 * than a username does, and this app has no use that would justify storing it.
 */
export interface InstagramLabelValueEntry {
  timestamp?: number;
  label_values?: InstagramLabelValue[];
  fbid?: string;
}

export interface ParsedAll {
  // Core relationship data
  following: Set<string>; // Accounts that the user follows
  followers: Set<string>; // Accounts that follow the user

  // Special relationship categories with timestamps
  pendingSent: Map<string, number>; // Outgoing follow requests that are still pending (not yet accepted/declined)
  permanentRequests: Map<string, number>; // Follow requests that were declined or blocked (permanently rejected)
  restricted: Map<string, number>; // Accounts with restricted profiles (private accounts that don't follow back)
  closeFriends: Map<string, number>; // Accounts marked as close friends
  unfollowed: Map<string, number>; // Accounts that were recently unfollowed by the user
  dismissedSuggestions: Map<string, number>; // Suggested accounts that were dismissed by the user

  // Timestamp data for core relationships
  followingTimestamps: Map<string, number>; // When the user started following each account
  followersTimestamps: Map<string, number>; // When each account started following the user
}

// Raw data structure for individual account items from Instagram export
export interface RawItem {
  username: string; // Account username
  href?: string; // Instagram profile URL
  timestamp?: number; // Unix timestamp when relationship was established
}

// Raw data structure for all relationship lists from Instagram export
export interface RawLists {
  following: RawItem[]; // Accounts that the user follows
  followers: RawItem[]; // Accounts that follow the user
  pendingSent: RawItem[]; // Outgoing follow requests that are still pending
  permanentRequests: RawItem[]; // Follow requests that were permanently rejected
  restricted: RawItem[]; // Accounts with restricted profiles
  closeFriends: RawItem[]; // Accounts marked as close friends
  unfollowed: RawItem[]; // Accounts that were recently unfollowed
  dismissedSuggestions: RawItem[]; // Suggested accounts that were dismissed
}

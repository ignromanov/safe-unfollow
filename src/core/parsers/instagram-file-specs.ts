/**
 * Instagram Export File Specifications
 * Describes all files we look for in Instagram data export
 */

export interface FileSpec {
  name: string;
  description: string;
  required: boolean;
  fileNames: string[];
  propCandidates?: string[];
  /**
   * ParseWarning code emitted when this file is found but its top-level shape
   * matches neither a bare array nor any propCandidate holding one (GH#21).
   * Optional files only — following.json/followers_*.json use dedicated
   * INVALID_FOLLOWING_FORMAT/INVALID_FOLLOWERS_FORMAT codes with severity
   * 'error' instead, since those two are required for badge math.
   */
  driftCode?: string;
  /**
   * True when appearing in this file implies the account is **currently** in
   * `following ∪ followers`. Used only by the membership tiebreak in
   * `instagram-labels.ts`, to identify a localised username label when value
   * shape alone cannot.
   *
   * `recently_unfollowed.json` is the one that looks eligible and is not: an
   * account you unfollowed is by definition gone from `following.json`, and if
   * it never followed you it is in neither set. Measured against the real
   * exports, its correct label matched 0 of 2 (English) and 0 of 22 (Russian).
   * Pending and permanent follow requests are excluded for the same reason —
   * the request was never accepted.
   */
  impliesKnownAccount?: boolean;
}

/**
 * All expected files in Instagram data export
 * Ordered by importance (required first)
 */
export const FILE_SPECS: FileSpec[] = [
  {
    name: 'following.json',
    description: 'Accounts you follow — required for unfollower detection',
    required: true,
    fileNames: ['following.json'],
    propCandidates: ['relationships_following'],
  },
  {
    name: 'followers_*.json',
    description: 'Accounts that follow you — required for mutual detection',
    required: true,
    fileNames: ['followers_1.json', 'followers_2.json', 'followers_3.json'],
    propCandidates: ['relationships_followers'],
  },
  {
    name: 'pending_follow_requests.json',
    description: 'Outgoing follow requests still pending',
    required: false,
    fileNames: ['pending_follow_requests.json'],
    propCandidates: ['relationships_follow_requests_sent'],
    driftCode: 'INVALID_PENDING_FORMAT',
  },
  {
    name: 'restricted_profiles.json',
    description: 'Accounts you have restricted',
    required: false,
    fileNames: ['restricted_profiles.json'],
    propCandidates: ['relationships_restricted_users'],
    driftCode: 'INVALID_RESTRICTED_FORMAT',
    impliesKnownAccount: true,
  },
  {
    name: 'close_friends.json',
    description: 'Your close friends list',
    required: false,
    fileNames: ['close_friends.json', 'friends.json'],
    propCandidates: ['relationships_close_friends'],
    driftCode: 'INVALID_CLOSE_FRIENDS_FORMAT',
    impliesKnownAccount: true,
  },
  {
    name: 'recently_unfollowed.json',
    description: 'Accounts you recently unfollowed',
    required: false,
    fileNames: [
      'recently_unfollowed_profiles.json',
      'recently_unfollowed.json',
      'unfollowed_profiles.json',
    ],
    propCandidates: ['relationships_unfollowed_users'],
    driftCode: 'INVALID_UNFOLLOWED_FORMAT',
  },
  {
    name: 'dismissed_suggestions.json',
    description: 'Suggested accounts you dismissed',
    required: false,
    fileNames: ['removed_suggestions.json', 'dismissed_suggestions.json'],
    propCandidates: ['relationships_dismissed_suggested_users'],
    driftCode: 'INVALID_DISMISSED_FORMAT',
    impliesKnownAccount: true,
  },
];

/**
 * Permanent follow requests spec (not in main FILE_SPECS for historical reasons)
 */
export const PERMANENT_REQUESTS_SPEC: FileSpec = {
  name: 'permanent_follow_requests.json',
  description: 'Follow requests that were declined or blocked',
  required: false,
  fileNames: ['recent_follow_requests.json', 'permanent_follow_requests.json'],
  propCandidates: [
    'relationships_permanent_follow_requests',
    'relationships_follow_requests_permanent',
  ],
  driftCode: 'INVALID_PERMANENT_FORMAT',
};

/**
 * Every `driftCode` any optional spec can emit, derived rather than restated.
 *
 * The consumer is `useFileUpload`, which reports optional-file shape drift to
 * analytics — that event is the only detection surface these warnings have, since
 * severity `'warning'` is rendered nowhere. Deriving the set here means adding a
 * seventh optional file with a `driftCode` wires its reporting automatically; a
 * hardcoded list in the hook would leave the new file silently unmeasured, which
 * is the exact failure mode GH#21 is about.
 */
export const OPTIONAL_FILE_DRIFT_CODES: ReadonlySet<string> = new Set(
  [...FILE_SPECS, PERMANENT_REQUESTS_SPEC]
    .map(spec => spec.driftCode)
    .filter((code): code is string => code !== undefined)
);

/**
 * Common base paths where Instagram data might be located
 */
export const BASE_PATH_CANDIDATES = [
  'connections/followers_and_following',
  'followers_and_following',
];

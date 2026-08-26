/**
 * Instagram Export File Specifications
 * Describes all files we look for in Instagram data export
 */

import { escapeRegExp } from './instagram-utils';

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
   * ParseWarning code emitted when this file's top level WAS recognized but its
   * records were not — `unresolvedEntries > 0` (GH#21). Deliberately a second
   * code rather than a reuse of `driftCode`: four of the six files that broke in
   * the 2026-08-11 export were plain arrays, so the wrapper parsed and only the
   * records had changed. Collapsing the two would lose the ability to tell
   * Instagram renaming the wrapper from Instagram changing the record.
   *
   * Required files are absent here for the same reason they have no
   * `driftCode`: their codes carry severity 'error' and are raised where the
   * file is parsed, in `instagram.ts` and `instagram-followers.ts`.
   */
  entryDriftCode?: string;
  /**
   * True when this file's entries are worth scoring against
   * `following ∪ followers`. Used only by the membership tiebreak in
   * `instagram-labels.ts`, to identify a localised username label when value
   * shape alone cannot: the label whose values hit that set is the username.
   *
   * The flag selects files that can only *add* hits, never mislead. Restricted
   * profiles and close friends are accounts you follow, so they hit. Dismissed
   * suggestions are **not** — by construction you do not follow them — and are
   * flagged anyway because they contribute few or no hits either way while
   * being entries in the drifted shape. Membership is not implied there; the
   * scoring simply survives their absence from the set.
   *
   * What the flag must keep out is a file whose entries score the *correct*
   * label to zero while noise scores above it. `recently_unfollowed.json` is
   * exactly that: an account you unfollowed is by definition gone from
   * `following.json`, and measured against the real exports its correct label
   * matched 0 of 2 (English) and 0 of 22 (Russian) — enough volume to bury the
   * signal. Pending and permanent follow requests are excluded for the same
   * reason; the request was never accepted.
   */
  impliesKnownAccount?: boolean;
  /**
   * True when `notFollowingBack` is computed by *subtracting* this file's
   * accounts (`core/badges/index.ts`), so failing to read it does not zero a
   * badge — it inflates one, silently (GH#41).
   *
   * Declared on the spec rather than read off two named results in
   * `parseOptionalFiles`, for the same reason `OPTIONAL_FILE_DRIFT_CODES` is
   * derived: a third exclusion added to the badge subtraction fails
   * `badges.test.ts`, whoever fixes that arrives at the exclusion set, and the
   * flag they must also set is one field on the file they are already holding.
   * Spelled out as an OR of two variables instead, the caveat keeps compiling
   * while covering two of three files — a wrong answer with no warning, which
   * is the class this change exists to remove.
   */
  feedsNotFollowingBackExclusion?: boolean;
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
    entryDriftCode: 'UNRESOLVED_ENTRIES_PENDING',
    feedsNotFollowingBackExclusion: true,
  },
  {
    name: 'restricted_profiles.json',
    description: 'Accounts you have restricted',
    required: false,
    fileNames: ['restricted_profiles.json'],
    propCandidates: ['relationships_restricted_users'],
    driftCode: 'INVALID_RESTRICTED_FORMAT',
    entryDriftCode: 'UNRESOLVED_ENTRIES_RESTRICTED',
    impliesKnownAccount: true,
  },
  {
    name: 'close_friends.json',
    description: 'Your close friends list',
    required: false,
    fileNames: ['close_friends.json', 'friends.json'],
    propCandidates: ['relationships_close_friends'],
    driftCode: 'INVALID_CLOSE_FRIENDS_FORMAT',
    entryDriftCode: 'UNRESOLVED_ENTRIES_CLOSE_FRIENDS',
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
    entryDriftCode: 'UNRESOLVED_ENTRIES_UNFOLLOWED',
  },
  {
    name: 'dismissed_suggestions.json',
    description: 'Suggested accounts you dismissed',
    required: false,
    fileNames: ['removed_suggestions.json', 'dismissed_suggestions.json'],
    propCandidates: ['relationships_dismissed_suggested_users'],
    driftCode: 'INVALID_DISMISSED_FORMAT',
    entryDriftCode: 'UNRESOLVED_ENTRIES_DISMISSED',
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
  entryDriftCode: 'UNRESOLVED_ENTRIES_PERMANENT',
  feedsNotFollowingBackExclusion: true,
};

/**
 * Every drift code any optional spec can emit — both the file-level
 * `driftCode` and the entry-level `entryDriftCode` — derived rather than
 * restated.
 *
 * The consumer is `useFileUpload`, which reports optional-file drift to
 * analytics — that event is the only detection surface these warnings have, since
 * severity `'warning'` is rendered nowhere. Deriving the set here means adding a
 * seventh optional file wires its reporting automatically; a
 * hardcoded list in the hook would leave the new file silently unmeasured, which
 * is the exact failure mode GH#21 is about. The two kinds share one set because
 * they share one consumer; they stay separate codes so the event can still say
 * which of the two failures happened.
 */
export const OPTIONAL_FILE_DRIFT_CODES: ReadonlySet<string> = new Set(
  [...FILE_SPECS, PERMANENT_REQUESTS_SPEC]
    .flatMap(spec => [spec.driftCode, spec.entryDriftCode])
    .filter((code): code is string => code !== undefined)
);

/**
 * The same file's name in an HTML export.
 *
 * Derived rather than listed, on a measurement: the nine relationship files of
 * `raw/real/2026-08-11-en-html-x9g96b0A` are each the JSON name with the
 * extension swapped — `close_friends.html`, `recently_unfollowed_profiles.html`,
 * `recent_follow_requests.html` and the rest. Not one base name differs, and the
 * folder layout is the same `connections/followers_and_following`.
 *
 * A second hand-written `htmlFileNames` beside `fileNames` would restate nine
 * facts that already have a home, and the two lists would disagree the first
 * time either changed. Stating it once means an alternative added to
 * `fileNames` — the way `friends.json` sits beside `close_friends.json` — is
 * covered on both sides without anyone remembering to do it twice.
 *
 * Case-insensitive because the pattern below is, and a `.JSON` alternative that
 * silently produced `.JSON.html` would be findable in neither format.
 */
export function htmlTwin(fileName: string): string {
  return fileName.replace(/\.json$/i, '.html');
}

/**
 * Common base paths where Instagram data might be located
 */
export const BASE_PATH_CANDIDATES = [
  'connections/followers_and_following',
  'followers_and_following',
];

/**
 * The entry names `openZipArchive` must keep an object for. Everything else is
 * listed by name and then discarded.
 *
 * Derived, for the same reason `OPTIONAL_FILE_DRIFT_CODES` is: a spec gaining a
 * `fileNames` alternative that this pattern did not cover would make that file
 * unfindable, and the parser would report it missing — a silent wrong answer,
 * not a crash. Deriving it means the two cannot disagree.
 *
 * Why it exists at all is a measurement, owned by `openZipArchive`'s `keep`
 * param doc in `zip-archive.ts` — link there rather than restate the numbers.
 * In short: an "All of your information" export from a decade-old account
 * carries tens of thousands of media files; the parser reads about a dozen of
 * them, and keeping a zip.js entry object per discarded file is not free.
 *
 * Followers is a regex rather than its `fileNames`, and deliberately wider than
 * that list: `instagram-followers.ts` looks up `followers_.*\.json`, so an
 * export sharded into `followers_4.json` and beyond is read today and must
 * keep being read.
 *
 * Both extensions, because both are readable. An entry this pattern does not
 * name keeps no object, so the parser cannot open it however correctly
 * everything downstream is written — it reports the file MISSING, which is a
 * silent wrong answer rather than a crash. That makes this the first seam an
 * HTML export passes through, and the reason it is widened before anything that
 * reads one.
 */
const KEPT_FILE_NAMES = [...FILE_SPECS, PERMANENT_REQUESTS_SPEC]
  .filter(spec => spec.name !== 'followers_*.json')
  .flatMap(spec => spec.fileNames)
  .flatMap(name => [name, htmlTwin(name)])
  .map(escapeRegExp);

export const RELEVANT_FILE_PATTERN = new RegExp(
  `(^|/)(followers_[^/]*\\.(json|html)|${KEPT_FILE_NAMES.join('|')})$`,
  'i'
);

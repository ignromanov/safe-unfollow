/**
 * Fixtures for GH#21: relationship files whose top-level SHAPE we don't
 * recognize must not silently parse into an empty Set/Map, indistinguishable
 * from a genuinely empty file.
 *
 * Each "drift" fixture below is a payload where neither known shape branch
 * matches (top-level array, or `{ <propCandidate>: [...] }`). Each "regression"
 * fixture is a payload that DOES match a known shape and must keep the old
 * behavior (empty 'info' warning, no drift error).
 */

/** One valid Instagram export entry (old format: username in string_list_data[0].value). */
export function makeEntry(username: string, timestamp = 1_700_000_000) {
  return {
    title: username,
    string_list_data: [
      {
        href: `https://www.instagram.com/${username}/`,
        value: username,
        timestamp,
      },
    ],
    media_list_data: [],
  };
}

/** A single valid entry, top-level bare-array shape. */
export const VALID_ARRAY_OF_ONE = [makeEntry('validuser')];

/** Recognized shape (bare array), genuinely empty — must stay 'info', not drift. */
export const EMPTY_ARRAY: unknown[] = [];

/** Recognized shape (bare array), but no entry yields a recognizable username. */
export const ARRAY_NO_USERNAME_FIELD = [{ media_list_data: [] }];

/** Unknown top-level key — neither an array nor any known relationships_* property. */
export const UNKNOWN_TOP_LEVEL_KEY = { some_other_key: [makeEntry('ghost')] };

/** Null payload — JSON `null`. */
export const NULL_PAYLOAD = null;

/** Object instead of array — the expected property exists but isn't an array. */
export function objectInsteadOfArray(propName: string) {
  return { [propName]: { not: 'an array' } };
}

/**
 * One record in the 2026-08 `label_values` form, carrying two labels whose
 * values are both username-shaped. Values and labels are invented; the shape is
 * the one in `raw/connections-2026-08-11`.
 */
export function makeAmbiguousLabelEntry(left: string, right: string) {
  return {
    timestamp: 1_700_000_000,
    label_values: [
      { label: 'Χρήστης', value: left },
      { label: 'Ψευδώνυμο', value: right },
    ],
  };
}

/**
 * Recognized shape (bare array) whose every record is unreadable: both labels
 * score identically on every entry, so no username label resolves and nothing
 * comes back. This is the 2026-08-11 signature that `formatValid` cannot see —
 * `Array.isArray` passes, the wrapper is fine, and the file still yields zero
 * accounts (GH#21 Task 3).
 */
export const ARRAY_UNREADABLE_ENTRIES = [
  makeAmbiguousLabelEntry('sample_user_a', 'sample_user_b'),
  makeAmbiguousLabelEntry('sample_user_c', 'sample_user_d'),
  makeAmbiguousLabelEntry('sample_user_e', 'sample_user_f'),
];

/**
 * Task 4 builders below — added 2026-08-12 for the end-to-end regression that
 * walks a whole ZIP through `parseInstagramZipFile`. Named after the three
 * shapes `00-plan.md` documents, so a reader can match a builder to the export
 * date it reproduces without re-deriving the shape from the JSON.
 */

/**
 * The classic entry: `{title, string_list_data:[{href, value, timestamp}]}`.
 * Same shape as `makeEntry` above, exported under the plan's vocabulary.
 * Unchanged as of the 2026-08-11 export for `following.json` and
 * `followers_*.json` (`00-plan.md`, "What changed in the export").
 */
export const classicValueEntry = makeEntry;

/**
 * The 2026-01 `following.json` shape: `string_list_data` still carries `href`
 * and `timestamp`, but no longer `value` — the username lives only in
 * `title`. Observed in `following.json` from the 2026-01-08 full export
 * (the extracted directory for that pull is named after a personal Instagram
 * handle and is deliberately not quoted here — see `00-plan.md`, which
 * refers to the same export by date only).
 */
export function titleOnlyEntry(username: string, timestamp = 1_700_000_000) {
  return {
    title: username,
    string_list_data: [{ href: `https://www.instagram.com/${username}/`, timestamp }],
  };
}

/** One `{label, value}` triple's labels, in whatever language the archive uses. */
export interface DriftLabelSet {
  username: string;
  name: string;
  url: string;
}

/**
 * Labels as spelled in an English-language export. `URL` survives
 * untranslated in every archive measured so far — it is an acronym — which is
 * why it is shared between label sets rather than parameterized per language.
 */
export const ENGLISH_LABELS: DriftLabelSet = { username: 'Username', name: 'Name', url: 'URL' };

/**
 * A label set in a language nobody on this team reads and nobody wrote code
 * against — the same pair `instagram-labels.test.ts` uses for the same
 * reason: a test that only covers Russian proves we handled Russian, not that
 * we handled localisation.
 */
export const INVENTED_LABELS: DriftLabelSet = { username: 'Χρήστης', name: 'Όνομα', url: 'URL' };

/**
 * One record in the 2026-08 shape: `{timestamp, media, label_values, fbid}`.
 * `labels` defaults to English; pass `INVENTED_LABELS` (or any other
 * `DriftLabelSet`) to prove a caller resolves the username without depending
 * on which language produced the export — see `00-plan.md` finding 3b, where
 * the same account produced English and Russian labels two hours apart.
 * Observed in `raw/connections-2026-08-11/` (English) and
 * `raw/connections-2026-08-11-ru/` (Russian).
 *
 * Building `following.json`/`followers_1.json` from this builder is valid —
 * `resolveEntryList`/`resolveEntry` recognise the shape there too — but their
 * entries will not resolve to usernames yet: the username label is pooled
 * only across the six optional files today (`instagram-labels.ts` "Scope
 * seam"), tracked as **GH#40** ("Username-label resolution covers six of
 * eight relationship files — the required two fail loudly instead"). See
 * `exportFormatDriftEndToEnd.test.ts`'s "fully-migrated export" case for the
 * loud-failure guarantee that covers this gap in the meantime.
 */
export function labelValuesEntry(
  username: string,
  options: {
    labels?: DriftLabelSet;
    displayName?: string;
    url?: string;
    timestamp?: number;
    fbid?: string;
  } = {}
) {
  const labels = options.labels ?? ENGLISH_LABELS;
  // The space makes the default fail `isValidUsername`, same as a real
  // display name. A username-shaped default would tie the name label with
  // the username label at 100% and make every archive built from this
  // builder unresolvable by scoring — a fixture bug, not a parser one, that
  // this default exists to rule out for every caller.
  const displayName = options.displayName ?? `${username} display name`;
  // Non-empty and non-Instagram on purpose: the real `URL` label holds the
  // profile's bio link, not an Instagram URL — in the real
  // `removed_suggestions.json` it's a third-party scheduling link. An empty
  // default (as this builder shipped first) drops out of scoring entirely
  // (`tally.scored > 0` in instagram-labels.ts excludes it), leaving the
  // username label to beat only one populated competitor — easier than any
  // real archive, where it beats two. `/` and `:` also fail
  // `isValidUsername`, so this default never accidentally wins the label.
  const url = options.url ?? `https://example.com/${username}-profile-link`;
  return {
    timestamp: options.timestamp ?? 1_700_000_000,
    media: [],
    label_values: [
      { label: labels.url, value: url },
      { label: labels.name, value: displayName },
      { label: labels.username, value: username },
    ],
    fbid: options.fbid ?? '17800000000000001',
  };
}

/**
 * Wrap entries under a `relationships_*` property — the shape Instagram uses
 * when a list is nested beneath a named key instead of being a bare array.
 * Observed for `following.json` in all four archives on disk, including the
 * drifted 2026-08-11 export (`relationships_following`); observed for every
 * relationship file — `close_friends.json`, `restricted_profiles.json`,
 * `pending_follow_requests.json`, and the rest — in the three pre-drift
 * archives (2025-08-31, 2025-09-18, 2026-01-08). The drifted optional files
 * are exactly the ones that lost this wrapper.
 *
 * The third wrapper shape, a single bare entry object, needs no helper: it is
 * just one builder's return value used directly as the top-level payload.
 * Observed on `restricted_profiles.json` and `removed_suggestions.json` in
 * the 2026-08-11 export, each holding exactly one record — the same fact
 * `resolveEntryList`'s own docblock (`instagram-utils.ts`) records.
 */
export function relationshipsWrapper(
  propName: string,
  entries: readonly unknown[]
): Record<string, readonly unknown[]> {
  return { [propName]: entries };
}

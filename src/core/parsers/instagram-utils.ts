/**
 * Instagram Parser Utilities
 * Shared functions for parsing and processing Instagram export data
 */

import type { InstagramExportEntry, InstagramLabelValueEntry, RawItem } from '@/core/types';

/** Instagram usernames: 1-30 chars, alphanumeric + dots + underscores */
const INSTAGRAM_USERNAME_RE = /^[a-zA-Z0-9._]{1,30}$/;

/**
 * Check if a username matches Instagram's username format
 */
export function isValidUsername(username: string): boolean {
  return INSTAGRAM_USERNAME_RE.test(username);
}

/**
 * Normalize username to lowercase and trim whitespace
 * Returns null for empty, malformed, or invalid usernames
 */
export function normalize(username: string | undefined | null): string | null {
  if (!username) return null;
  const trimmed = username.trim().toLowerCase();
  if (!trimmed.length) return null;
  if (!isValidUsername(trimmed)) return null;
  return trimmed;
}

/**
 * Escape special regex characters in a literal string
 */
export function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Read one export entry down to a username, or `null` if it cannot be read.
 *
 * Three shapes are known, tried in this order — the first two are the
 * established formats and must not regress:
 *
 * 1. `string_list_data[0].value` — the classic shape.
 * 2. `title` — the 2026-01 `following.json` shape, where `string_list_data`
 *    still carries the `href` but no longer the username.
 * 3. `label_values` — the 2026-08 shape, where the username sits under a
 *    localised label. `usernameLabel` is the label resolved for this archive
 *    (see `instagram-labels.ts`); it is matched **exactly**, because that
 *    function returns the label as the archive spells it.
 *
 * `href` is deliberately left undefined for shape 3. The `URL` label holds the
 * profile's bio link, not an Instagram profile URL — in one real
 * `removed_suggestions.json` it is a third-party scheduling page. Storing it
 * as `href` would aim a profile click off Instagram entirely.
 *
 * Returning `null` rather than guessing is the point: on the Russian archive
 * the display-name label alone produced eight username-shaped values, so a
 * per-entry "first thing that looks like a username" fallback would invent
 * accounts instead of finding them.
 */
export function resolveEntry(entry: unknown, usernameLabel: string | null): RawItem | null {
  if (typeof entry !== 'object' || entry === null) return null;

  const legacy = entry as Partial<InstagramExportEntry>;
  const item = legacy.string_list_data?.[0];
  const username = normalize(item?.value) ?? normalize(legacy.title);
  if (username) return { username, href: item?.href, timestamp: item?.timestamp };

  if (usernameLabel === null) return null;

  const labelled = entry as InstagramLabelValueEntry;
  if (!Array.isArray(labelled.label_values)) return null;

  for (const pair of labelled.label_values) {
    if (pair?.label !== usernameLabel) continue;
    const labelledUsername = normalize(pair.value);
    // Keep scanning: a repeated label with one empty value must not mask the
    // populated one. The entry's own timestamp is the only one this shape has.
    if (labelledUsername) return { username: labelledUsername, timestamp: labelled.timestamp };
  }

  return null;
}

export interface ResolvedEntries {
  /** Deduplicated by username, first occurrence winning, in entry order. */
  items: RawItem[];
  /**
   * Entries `resolveEntry` could not read. Counted rather than dropped: an
   * export whose shape drifted must leave a trace, or it comes back as a
   * confidently empty list indistinguishable from a genuinely empty file.
   */
  unresolved: number;
}

/**
 * Resolve a list of entries, keeping count of the ones that could not be read.
 *
 * `usernameLabel` defaults to `null` — "no label resolution was done for this
 * list". That is the honest state for `following.json` and `followers_*.json`,
 * which have not migrated to the `label_values` shape yet; when they do, they
 * need a label resolved over all eight files rather than the six
 * `parseOptionalFiles` pools today.
 */
export function resolveEntries(
  entries: readonly unknown[] | undefined,
  usernameLabel: string | null = null
): ResolvedEntries {
  const items: RawItem[] = [];
  const seen = new Set<string>();
  let unresolved = 0;

  for (const entry of entries ?? []) {
    const item = resolveEntry(entry, usernameLabel);
    if (!item) {
      unresolved += 1;
      continue;
    }
    if (seen.has(item.username)) continue;
    seen.add(item.username);
    items.push(item);
  }

  return { items, unresolved };
}

/**
 * Extract deduplicated usernames from Instagram export entries
 */
export function extractUsernames(entries: readonly unknown[] | undefined): string[] {
  return resolveEntries(entries).items.map(item => item.username);
}

/**
 * Resolve an unknown top-level JSON payload down to a list of raw entries.
 *
 * Instagram's relationship-file shape has drifted across three known forms,
 * checked in this order (first match wins):
 * 1. A bare array (`[...]`).
 * 2. A wrapper object holding the array under a known key
 *    (`{ relationships_close_friends: [...] }`).
 * 3. A single record with the array wrapper omitted entirely — observed on
 *    `restricted_profiles.json`/`removed_suggestions.json` in the
 *    2026-08-11 export, both holding exactly one record. This is a
 *    hypothesis about the serializer (single-record collections may skip
 *    the array), not a documented contract, so it's recognized by a
 *    positive shape test — does the object itself look like an entry? —
 *    never by counting.
 *
 * `null` means "shape not recognized" and is what callers turn into
 * `formatValid: false` / `formatInvalid: true`. An empty array is a
 * distinct, valid result: shape recognized, genuinely no records. Those two
 * must never collapse into one value.
 *
 * Replaces the `Array.isArray` ladder that used to be duplicated across
 * `instagram-optional.ts`, `instagram.ts` (following.json) and
 * `instagram-followers.ts` (followers_*.json) — the duplication is how the
 * missing "bare single entry" case stayed hidden in all three for so long.
 */
export function resolveEntryList(data: unknown, propCandidates?: string[]): unknown[] | null {
  if (Array.isArray(data)) return data;

  if (propCandidates) {
    for (const key of propCandidates) {
      const value = (data as Record<string, unknown> | null)?.[key];
      if (Array.isArray(value)) return value;
    }
  }

  return looksLikeEntry(data) ? [data] : null;
}

/**
 * Positive test for "this object is itself a single Instagram export entry",
 * not a wrapper whose expected array key got renamed or corrupted. A
 * `{ relationships_*: <non-array> }` wrapper must NOT pass this check, or a
 * genuine key rename would be silently swallowed as one garbage record
 * instead of surfacing a drift warning.
 */
function looksLikeEntry(data: unknown): data is Record<string, unknown> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
  return 'label_values' in data || 'string_list_data' in data || 'title' in data;
}

/**
 * Instagram Parser Utilities
 * Shared functions for parsing and processing Instagram export data
 */

import type { InstagramExportEntry, RawItem } from '@/core/types';

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
 * Extract usernames from Instagram export entries
 * Handles both old format (item.value) and new format (entry.title)
 */
export function extractUsernames(entries: InstagramExportEntry[]): string[] {
  const usernames: string[] = [];
  for (const entry of entries) {
    const item = entry.string_list_data?.[0];
    // Instagram changed format: username can be in item.value (old) or entry.title (new)
    const norm = normalize(item?.value) ?? normalize(entry.title);
    if (norm) usernames.push(norm);
  }
  return Array.from(new Set(usernames));
}

/**
 * Convert Instagram export entries to RawItem format with deduplication
 */
export function listToRaw(entries: InstagramExportEntry[] | undefined): RawItem[] {
  const result: RawItem[] = [];
  if (!entries) return result;
  const seen = new Set<string>();

  for (const e of entries) {
    const item = e.string_list_data?.[0];
    // Instagram changed format: username can be in item.value (old) or entry.title (new)
    const username = normalize(item?.value) ?? normalize(e.title);
    if (!username || seen.has(username)) continue;
    seen.add(username);
    result.push({ username, href: item?.href, timestamp: item?.timestamp });
  }

  return result;
}

/**
 * Convert Instagram export entries to username -> timestamp map
 */
export function listToMap(entries: InstagramExportEntry[] | undefined): Map<string, number> {
  const m = new Map<string, number>();
  if (!entries) return m;

  for (const e of entries) {
    const item = e.string_list_data?.[0];
    // Instagram changed format: username can be in item.value (old) or entry.title (new)
    const u = normalize(item?.value) ?? normalize(e.title);
    if (!u) continue;
    if (!m.has(u)) m.set(u, item?.timestamp ?? 0);
  }

  return m;
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

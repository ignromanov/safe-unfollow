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

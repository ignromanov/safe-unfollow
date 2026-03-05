/**
 * Instagram Parser Validation Helpers
 * Empty state factory for ParsedAll
 */

import type { ParsedAll } from '@/core/types';

/** Create an empty ParsedAll with all collections initialized */
export function createEmptyParsedAll(): ParsedAll {
  return {
    following: new Set(),
    followers: new Set(),
    pendingSent: new Map(),
    permanentRequests: new Map(),
    restricted: new Map(),
    closeFriends: new Map(),
    unfollowed: new Map(),
    dismissedSuggestions: new Map(),
    followingTimestamps: new Map(),
    followersTimestamps: new Map(),
  };
}

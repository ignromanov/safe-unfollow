/**
 * IndexedDB Filter Engine - Optimized filtering using bitsets from IndexedDB
 *
 * Uses pre-computed badge bitsets stored in IndexedDB for fast filtering
 * Supports lazy loading with virtualization
 */

import type { AccountBadges, BadgeKey } from '@/core/types';
import { BADGE_ORDER } from '@/core/badges';
import { BADGE_GROUPS, groupOf, type BadgeGroupId } from '@/core/badges/groups';
import { BitSet } from '../indexeddb/bitset';
import { indexedDBService } from '../indexeddb/indexeddb-service';
import { hasSearchIndexes, smartSearch } from '../search-index';

interface FilterEngineResult {
  filteredAccounts: AccountBadges[];
  processingTime: number;
  totalMatches?: number;
}

export class IndexedDBFilterEngine {
  private fileHash: string | null = null;
  private totalAccounts = 0;

  // Cache for frequently used bitsets
  private bitsetCache = new Map<BadgeKey, BitSet>();

  /**
   * Initialize engine with file hash
   */
  async init(fileHash: string, totalAccounts?: number): Promise<void> {
    this.fileHash = fileHash;

    // Use provided total or fetch from metadata
    if (totalAccounts !== undefined) {
      this.totalAccounts = totalAccounts;
    } else {
      const metadata = await indexedDBService.getFileMetadata(fileHash);
      if (metadata) {
        this.totalAccounts = metadata.accountCount;
      }
    }

    // Preload common bitsets
    const commonBadges: BadgeKey[] = ['following', 'followers', 'mutuals'];
    await Promise.all(commonBadges.map(badge => this.loadBitset(badge)));
  }

  /**
   * Reset engine state
   */
  reset(): void {
    this.fileHash = null;
    this.totalAccounts = 0;
    this.bitsetCache.clear();
  }

  /**
   * Load bitset for a badge (with caching)
   */
  private async loadBitset(badge: BadgeKey): Promise<BitSet | null> {
    if (!this.fileHash) {
      throw new Error('[IndexedDB Filter Engine] Not initialized');
    }

    // Check cache first
    if (this.bitsetCache.has(badge)) {
      const cached = this.bitsetCache.get(badge);
      if (cached) return cached;
    }

    // Load from IndexedDB
    const bitset = await indexedDBService.getBadgeBitset(this.fileHash, badge);

    if (bitset) {
      this.bitsetCache.set(badge, bitset);
    }

    return bitset;
  }

  /**
   * Filter accounts by badges and search query
   * Returns indices of matching accounts
   */
  async filterToIndices(searchQuery: string, activeFilters: BadgeKey[]): Promise<number[]> {
    if (!this.fileHash) {
      throw new Error('[IndexedDB Filter Engine] Not initialized');
    }

    // Start with all accounts if no filters
    let resultBitset: BitSet | null = null;

    if (activeFilters.length > 0) {
      // OR within a facet group, AND across groups. The eleven badges are not
      // eleven independent facets: five of them are mutually-exclusive states
      // computed from the same two lists, so intersecting them asked for
      // accounts that cannot exist. Membership lives in `core/badges/groups.ts`
      // and is stated nowhere else.
      const byGroup = new Map<BadgeGroupId, BadgeKey[]>();
      for (const badge of activeFilters) {
        const id = groupOf(badge);
        const members = byGroup.get(id);
        if (members) members.push(badge);
        else byGroup.set(id, [badge]);
      }

      for (const members of byGroup.values()) {
        const bitsets = (await Promise.all(members.map(badge => this.loadBitset(badge)))).filter(
          (b): b is BitSet => b !== null
        );

        // A group whose every badge is missing from storage contributes an
        // empty set to the AND, which is what an absent optional file means.
        //
        // This is a BEHAVIOUR CHANGE, not a refactor: the old code filtered
        // nulls out of the list and intersected what remained, so an absent
        // badge silently widened the result instead of emptying it. Both the
        // boundary row and Task 5's `empty.absentTitle` exist because of this
        // line.
        if (bitsets.length === 0) return [];

        let groupBitset = bitsets[0] as BitSet;
        for (let i = 1; i < bitsets.length; i++) {
          groupBitset = groupBitset.union(bitsets[i] as BitSet);
        }

        resultBitset = resultBitset === null ? groupBitset : resultBitset.intersect(groupBitset);
      }
    }

    // Convert bitset to indices
    let indices: number[];

    if (resultBitset) {
      indices = resultBitset.toIndices();
    } else {
      // No filters - return all indices
      indices = Array.from({ length: this.totalAccounts }, (_, i) => i);
    }

    // Apply search query if present
    if (searchQuery.trim()) {
      indices = await this.applySearchFilter(indices, searchQuery);
    }

    return indices;
  }

  /**
   * For each badge, how many accounts the current selection would hold if that
   * badge were added to it. A zero means the option ends the road, and the
   * surface disables it rather than letting the reader walk into an empty list.
   *
   * The chip's all-time badge count systematically overstates under grouped
   * semantics: it promises rows the other groups' AND constraints remove. This
   * is the number that does not.
   *
   * Group unions for the selection are built once; only the candidate's own
   * group is rebuilt per candidate, and every bitset involved is already
   * resident in `bitsetCache` after `init`.
   */
  async candidateCounts(activeFilters: BadgeKey[]): Promise<Record<BadgeKey, number>> {
    if (!this.fileHash) {
      throw new Error('[IndexedDB Filter Engine] Not initialized');
    }

    const selectedByGroup = new Map<BadgeGroupId, BadgeKey[]>();
    for (const badge of activeFilters) {
      const id = groupOf(badge);
      const members = selectedByGroup.get(id);
      if (members) members.push(badge);
      else selectedByGroup.set(id, [badge]);
    }

    const unionOf = async (badges: readonly BadgeKey[]): Promise<BitSet | null> => {
      const bitsets = (await Promise.all(badges.map(b => this.loadBitset(b)))).filter(
        (b): b is BitSet => b !== null
      );
      if (bitsets.length === 0) return null;
      let acc = bitsets[0] as BitSet;
      for (let i = 1; i < bitsets.length; i++) acc = acc.union(bitsets[i] as BitSet);
      return acc;
    };

    const groupUnions = new Map<BadgeGroupId, BitSet | null>();
    for (const [id, badges] of selectedByGroup) {
      groupUnions.set(id, await unionOf(badges));
    }

    const counts = {} as Record<BadgeKey, number>;

    for (const candidate of BADGE_ORDER) {
      const candidateGroup = groupOf(candidate);
      const selectedHere = selectedByGroup.get(candidateGroup) ?? [];
      const merged = selectedHere.includes(candidate) ? selectedHere : [...selectedHere, candidate];

      let result: BitSet | null = null;
      let impossible = false;

      for (const { id } of BADGE_GROUPS) {
        if (id !== candidateGroup && !selectedByGroup.has(id)) continue;

        // A group with no readable bitset contributes the empty set, matching
        // filterToIndices: an absent optional file empties the result rather
        // than silently widening it.
        const bits = id === candidateGroup ? await unionOf(merged) : (groupUnions.get(id) ?? null);
        if (!bits) {
          impossible = true;
          break;
        }
        result = result === null ? bits : result.intersect(bits);
      }

      counts[candidate] = impossible || result === null ? 0 : result.count();
    }

    return counts;
  }

  /**
   * Apply search filter to account indices
   * Uses search indexes when available for better performance
   */
  private async applySearchFilter(indices: number[], searchQuery: string): Promise<number[]> {
    if (!this.fileHash) {
      return indices;
    }

    const query = searchQuery.toLowerCase().trim();

    // Try using search index first
    const hasIndexes = await hasSearchIndexes(this.fileHash);

    if (hasIndexes) {
      const searchBitset = await smartSearch(this.fileHash, query);

      if (searchBitset) {
        // Create bitset from indices
        const indicesBitset = BitSet.fromIndices(indices, this.totalAccounts);

        // Intersect with search results
        const resultBitset = indicesBitset.intersect(searchBitset);

        return resultBitset.toIndices();
      }
    }

    // Fallback to linear search
    const filtered: number[] = [];

    // Load accounts in batches for search
    const BATCH_SIZE = 1000;
    for (let i = 0; i < indices.length; i += BATCH_SIZE) {
      const batchIndices = indices.slice(i, Math.min(i + BATCH_SIZE, indices.length));
      const batchStart = Math.min(...batchIndices);
      const batchEnd = Math.max(...batchIndices) + 1;

      const accounts = await indexedDBService.getAccountsByRange(
        this.fileHash,
        batchStart,
        batchEnd
      );

      // Filter by search query
      for (const index of batchIndices) {
        const localIndex = index - batchStart;
        const account = accounts[localIndex];
        if (account && account.username.toLowerCase().includes(query)) {
          filtered.push(index);
        }
      }
    }

    return filtered;
  }

  /**
   * Filter and return actual account objects (for compatibility)
   */
  async filter(
    accounts: AccountBadges[], // Ignored - we use IndexedDB
    searchQuery: string,
    activeFilters: string[]
  ): Promise<FilterEngineResult> {
    // Get filtered indices
    const indices = await this.filterToIndices(searchQuery, activeFilters as BadgeKey[]);

    // Load actual accounts for the indices
    const filteredAccounts = await this.loadAccountsByIndices(indices);

    return {
      filteredAccounts,
      processingTime: 0,
      totalMatches: indices.length,
    };
  }

  /**
   * Load accounts by their indices (for range-based virtualization)
   */
  async loadAccountsByIndices(indices: number[]): Promise<AccountBadges[]> {
    if (!this.fileHash || indices.length === 0) {
      return [];
    }

    // Group indices into contiguous ranges for efficient loading
    const ranges: Array<{ start: number; end: number; indices: number[] }> = [];

    const sortedIndices = [...indices].sort((a, b) => a - b);

    if (sortedIndices.length === 0) {
      return [];
    }

    const firstIndex = sortedIndices[0];
    if (firstIndex === undefined) return [];

    let currentRange = {
      start: firstIndex,
      end: firstIndex + 1,
      indices: [firstIndex],
    };

    for (let i = 1; i < sortedIndices.length; i++) {
      const idx = sortedIndices[i];
      if (idx === undefined) continue;

      // If index is close to current range, extend it
      if (idx - currentRange.end < 10) {
        currentRange.end = idx + 1;
        currentRange.indices.push(idx);
      } else {
        // Start new range
        ranges.push(currentRange);
        currentRange = { start: idx, end: idx + 1, indices: [idx] };
      }
    }
    ranges.push(currentRange);

    // Load all ranges, tracking original index for correct ordering
    const results: Array<{ account: AccountBadges; originalIndex: number }> = [];

    for (const range of ranges) {
      const accounts = await indexedDBService.getAccountsByRange(
        this.fileHash,
        range.start,
        range.end
      );

      // Extract only the accounts we need, preserving original index
      for (const idx of range.indices) {
        const localIdx = idx - range.start;
        if (accounts[localIdx]) {
          results.push({ account: accounts[localIdx]!, originalIndex: idx });
        }
      }
    }

    // Create order map: originalIndex -> position in input indices array
    const orderMap = new Map(indices.map((idx, order) => [idx, order]));

    // Sort by original order (O(n log n))
    results.sort((a, b) => {
      const orderA = orderMap.get(a.originalIndex) ?? Infinity;
      const orderB = orderMap.get(b.originalIndex) ?? Infinity;
      return orderA - orderB;
    });

    return results.map(r => r.account);
  }

  /**
   * Get badge statistics (fast - from metadata)
   */
  async getStats(): Promise<Record<BadgeKey, number>> {
    if (!this.fileHash) {
      throw new Error('[IndexedDB Filter Engine] Not initialized');
    }

    return await indexedDBService.getBadgeStats(this.fileHash);
  }

  /**
   * Clear all data and reset engine
   */
  clear(): void {
    this.fileHash = null;
    this.totalAccounts = 0;
    this.bitsetCache.clear();
  }
}

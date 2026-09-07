/**
 * IndexedDB Filter Engine - Optimized filtering using bitsets from IndexedDB
 *
 * Uses pre-computed badge bitsets stored in IndexedDB for fast filtering
 * Supports lazy loading with virtualization
 */

import type { AccountBadges, BadgeKey } from '@/core/types';
import { BADGE_ORDER } from '@/core/badges';
import { groupOf, type BadgeGroupId } from '@/core/badges/groups';
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
   * Partition badges by facet group.
   *
   * OR applies within a group, AND across groups. The eleven badges are not
   * eleven independent facets: five of them are mutually-exclusive states
   * computed from the same two lists, so intersecting them asked for accounts
   * that cannot exist. Membership lives in `core/badges/groups.ts` and is
   * stated nowhere else.
   */
  private groupBadges(badges: readonly BadgeKey[]): Map<BadgeGroupId, BadgeKey[]> {
    const byGroup = new Map<BadgeGroupId, BadgeKey[]>();
    for (const badge of badges) {
      const id = groupOf(badge);
      const members = byGroup.get(id);
      if (members) members.push(badge);
      else byGroup.set(id, [badge]);
    }
    return byGroup;
  }

  /**
   * The union of a group's bitsets — the OR half of the rule above.
   *
   * `null` when not one of them is readable, which is what an absent optional
   * file means: the group contributes the empty set to the AND rather than
   * silently widening the result. Both the measurement-boundary row and Task
   * 5's `empty.absentTitle` exist because of this.
   */
  private async unionOf(badges: readonly BadgeKey[]): Promise<BitSet | null> {
    const bitsets = (await Promise.all(badges.map(b => this.loadBitset(b)))).filter(
      (b): b is BitSet => b !== null
    );
    if (bitsets.length === 0) return null;

    let acc = bitsets[0] as BitSet;
    for (let i = 1; i < bitsets.length; i++) acc = acc.union(bitsets[i] as BitSet);
    return acc;
  }

  /**
   * The accounts a non-empty selection holds: OR within each facet group, AND
   * across groups. `null` means the selection is provably empty.
   *
   * This is the one statement of that rule. `filterToIndices` and
   * `candidateCounts` both read it from here rather than each carrying its own
   * copy — they carried two until 2026-09-07, and the copies had already
   * drifted in shape (one returned early on the first empty group, the other
   * raised a flag and kept looping). They agreed on every input anyone tried;
   * what they could not do is stay agreed through the next edit to the rule,
   * and a disagreement there is invisible, because the chip counts and the list
   * would each remain self-consistent.
   */
  private async selectionBitset(filters: readonly BadgeKey[]): Promise<BitSet | null> {
    let result: BitSet | null = null;

    for (const members of this.groupBadges(filters).values()) {
      const groupBitset = await this.unionOf(members);
      if (!groupBitset) return null;
      result = result === null ? groupBitset : result.intersect(groupBitset);
    }

    return result;
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
      resultBitset = await this.selectionBitset(activeFilters);
      // A group whose every badge is missing from storage empties the result
      // rather than widening it — the convention is stated on `unionOf`.
      if (resultBitset === null) return [];
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
   * The rule is `selectionBitset`'s; what this adds is the arithmetic that
   * makes eleven answers cheaper than eleven independent ones. Two things are
   * constant across every candidate that shares a group and are therefore built
   * once per group rather than once per candidate: that group's own union, and
   * the AND of all the *other* selected groups. Every bitset involved is
   * already resident in `bitsetCache` after `init`.
   */
  async candidateCounts(activeFilters: BadgeKey[]): Promise<Record<BadgeKey, number>> {
    if (!this.fileHash) {
      throw new Error('[IndexedDB Filter Engine] Not initialized');
    }

    const selectedByGroup = this.groupBadges(activeFilters);

    const groupUnions = new Map<BadgeGroupId, BitSet | null>();
    for (const [id, badges] of selectedByGroup) {
      groupUnions.set(id, await this.unionOf(badges));
    }

    // `undefined` = no other group constrains this one; `null` = another group
    // is empty, so nothing in this one can yield a row.
    const constraintExcluding = (skip: BadgeGroupId): BitSet | null | undefined => {
      let acc: BitSet | undefined;
      for (const [id, bits] of groupUnions) {
        if (id === skip) continue;
        if (!bits) return null;
        acc = acc === undefined ? bits : acc.intersect(bits);
      }
      return acc;
    };

    const otherGroups = new Map<BadgeGroupId, BitSet | null | undefined>();
    const counts = {} as Record<BadgeKey, number>;

    for (const candidate of BADGE_ORDER) {
      const group = groupOf(candidate);

      if (!otherGroups.has(group)) otherGroups.set(group, constraintExcluding(group));
      const rest = otherGroups.get(group);
      if (rest === null) {
        counts[candidate] = 0;
        continue;
      }

      // The candidate's own group with the candidate in it. Already selected
      // means that union is the one already built; otherwise it is that union
      // plus one bitset, never the whole chain rebuilt.
      const selectedHere = selectedByGroup.get(group);
      let withCandidate: BitSet | null;
      if (selectedHere?.includes(candidate)) {
        withCandidate = groupUnions.get(group) ?? null;
      } else {
        const candidateBits = await this.loadBitset(candidate);
        const base = groupUnions.get(group);
        withCandidate =
          candidateBits === null ? null : base ? base.union(candidateBits) : candidateBits;
      }

      if (!withCandidate) {
        counts[candidate] = 0;
        continue;
      }

      counts[candidate] = (
        rest === undefined ? withCandidate : withCandidate.intersect(rest)
      ).count();
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

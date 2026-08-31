# Filter Optimization Architecture

**Date**: January 10, 2025  
**Version**: v1.0 (IndexedDB Native)  
**Status**: ✅ Production Ready

## Overview

This document describes the filter optimization architecture implemented to handle massive datasets (1M+ accounts). Sub-5ms filter latency is the **design target** it was built against — see "Performance Results → Provenance" below for what is actually measured, which is less than this document used to imply. The v1.0 architecture is built on IndexedDB with columnar storage and eliminates in-memory constraints.

## Key Technologies

1. **IndexedDB v2** — Columnar storage with 40x space reduction
2. **FastBitSet.js** — 32x faster bitwise operations (by Daniel Lemire)
3. **Search Indexes** — Trigram/prefix indexes for O(1) lookups
4. **TanStack Virtual** — Lazy rendering (5-20 visible items)
5. **Web Workers** — Background parsing and filtering

## Problem Statement (Legacy v0.3)

The previous implementation had significant limitations:

- **Memory constraints**: Storing 1M accounts in Zustand/localStorage (~100 MB)
- **Serialization overhead**: JSON stringify/parse on every persistence
- **Browser quota limits**: localStorage 5-10 MB limit
- **Full array cloning**: Worker initialization required full dataset transfer
- **No lazy loading**: All accounts rendered, even with virtualization

### Performance Baseline (v0.3)

| Dataset Size  | Storage   | Filter | Memory  | Search  |
| ------------- | --------- | ------ | ------- | ------- |
| 10k accounts  | ~2 MB     | ~3ms   | ~5 MB   | ~30ms   |
| 100k accounts | ~20 MB    | ~10ms  | ~50 MB  | ~300ms  |
| 1M accounts   | ~200 MB\* | ~55ms  | ~200 MB | ~3000ms |

\*Exceeded localStorage quota on most browsers

## Solution Architecture (v1.0)

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ User Upload                                                  │
│   ↓                                                          │
│ Parse Worker (background)                                    │
│   ├─→ Parse ZIP file                                        │
│   ├─→ Build AccountBadges                                   │
│   └─→ storeAllAccounts() — one bulk write                   │
│       ↓                                                      │
│ IndexedDB v2                                                 │
│   ├─→ files: metadata (hash, count, date)                   │
│   ├─→ columns: usernames (packed Uint8Array)                │
│   ├─→ bitsets: badges (1 bit per account)                   │
│   ├─→ timestamps: sparse time-based data                    │
│   └─→ indexes: search (trigram/prefix)                      │
│       ↓                                                      │
│ Zustand Store (UI state only)                               │
│   └─→ fileMetadata, filters, uploadStatus (~1 KB)           │
│                                                              │
│ User Filters/Searches                                        │
│   ↓                                                          │
│ IndexedDBFilterEngine                                        │
│   ├─→ Load badge bitsets                                    │
│   ├─→ Intersect (AND operation, O(n/32))                    │
│   ├─→ Apply search index (O(1) lookup)                      │
│   └─→ Return: number[] (indices only)                       │
│       ↓                                                      │
│ AccountList + TanStack Virtual                               │
│   ├─→ Determine visible range (5-20 items)                  │
│   └─→ useAccountDataSource.getAccount(index)                │
│       ↓                                                      │
│ IndexedDB Range Query                                        │
│   ├─→ Fetch slice (500 accounts)                            │
│   ├─→ LRU cache (max 20 slices)                             │
│   └─→ Render visible items                                  │
└─────────────────────────────────────────────────────────────┘
```

### 1. IndexedDB v2 Schema

**Database**: `instagram-tracker-v2`  
**Version**: `2`

#### Object Stores

**1. files** — File metadata registry

```typescript
interface FileMetadataRecord {
  fileHash: string; // SHA-256 hash (keyPath)
  fileName: string;
  fileSize: number;
  uploadDate: Date;
  accountCount: number;
  lastAccessed: number; // LRU timestamp
  version: number; // Schema version
  processingTime?: number; // Parse duration
}
```

**2. columns** — Columnar username storage

```typescript
interface ColumnRecord {
  fileHash: string; // Composite key [fileHash, column]
  column: 'usernames';
  data: Uint8Array; // Packed string data
  offsets: Uint32Array; // Offset table for variable strings
  length: number; // Number of entries
}

// Storage format:
// - All usernames packed into single Uint8Array
// - Offset table enables O(1) random access
// - ~50% smaller than JSON arrays
```

**3. bitsets** — Badge presence as BitSets

```typescript
interface BitsetRecord {
  fileHash: string; // Composite key [fileHash, badge]
  badge: BadgeKey; // following, followers, mutuals, etc.
  data: Uint8Array; // Bitset (1 bit per account)
  accountCount: number; // Quick stats
}

// Example: 1M accounts × 10 badges = 1.25 MB
// vs JSON: ~100 MB (80x compression)
```

**4. timestamps** — Sparse time-based data

> ⚠️ **Not implemented.** The store is created but never written or read; see
> `indexeddb/INDEXEDDB_ARCHITECTURE.md` § 4 for the greps and the 2026-08-25
> ruling. Stated once there rather than twice, per CLAUDE.md's no-copied-facts
> rule.

```typescript
interface TimestampRecord {
  fileHash: string; // Composite key [fileHash, username]
  username: string;
  following?: number; // Unix timestamps
  followers?: number;
  pending?: number;
  // ... other time-based badges
}

// Only stores accounts with timestamps
// ~70% space savings (sparse storage)
```

**5. indexes** — Search index cache

```typescript
interface SearchIndexRecord {
  fileHash: string; // Composite key [fileHash, type, key]
  type: 'prefix' | 'trigram';
  key: string; // Prefix/trigram string
  data: Uint8Array; // Bitset of matching accounts
  createdAt: number;
  expiresAt: number; // TTL (3 days default)
}
```

### 2. FastBitSet.js Integration

**Library**: https://github.com/lemire/FastBitSet.js/  
**Performance**: 32x faster than boolean arrays

```typescript
import FastBitSet from 'fastbitset';

// Wrapper for IndexedDB compatibility
export class BitSet {
  private bitset: FastBitSet;

  constructor(size?: number) {
    this.bitset = new FastBitSet();
  }

  static fromUint8Array(arr: Uint8Array): BitSet {
    const wrapper = new BitSet();
    const uint32Array = new Uint32Array(arr.buffer, arr.byteOffset, arr.byteLength / 4);
    wrapper.bitset.words = uint32Array;
    return wrapper;
  }

  // Core operations
  set(index: number): void {
    this.bitset.add(index);
  }
  has(index: number): boolean {
    return this.bitset.has(index);
  }

  // Fast intersection (AND)
  intersect(other: BitSet): BitSet {
    const result = new BitSet();
    result.bitset = this.bitset.new_intersection(other.bitset);
    return result;
  }

  // Convert to indices
  toIndices(): number[] {
    return this.bitset.array();
  }
  count(): number {
    return this.bitset.size();
  }
}
```

### 3. Columnar Storage

**Benefits**:

- 40x space reduction vs JSON
- O(1) random access by index
- Efficient range queries
- Column-level compression

**Example**: 1M usernames

```
JSON Array:     ~10 MB
Columnar:       ~10 MB (data) + ~4 MB (offsets) = ~14 MB
Bitsets (10):   ~1.25 MB
Total:          ~15 MB vs ~200 MB JSON
```

### 4. Search Indexes

#### Trigram Index

```typescript
// Example: "johndoe" → ["__j", "_jo", "joh", "ohn", "hnd", "ndo", "doe", "oe_", "e__"]
function generateTrigrams(text: string): string[] {
  const normalized = text.toLowerCase().trim();
  const padded = `__${normalized}__`;
  const trigrams: string[] = [];

  for (let i = 0; i <= padded.length - 3; i++) {
    trigrams.push(padded.substring(i, i + 3));
  }

  return trigrams;
}

// Build index
const trigramBitsets = new Map<string, BitSet>();
for (const account of accounts) {
  const trigrams = generateTrigrams(account.username);
  for (const trigram of trigrams) {
    trigramBitsets.get(trigram)?.set(account.index);
  }
}

// Query: "john" → ["__j", "_jo", "joh", "ohn"] → intersect bitsets
```

#### Prefix Index

```typescript
// Example: "johndoe" → ["jo", "joh", "john"]
function generatePrefixes(text: string): string[] {
  const normalized = text.toLowerCase().trim();
  const prefixes: string[] = [];
  const maxLen = Math.min(4, normalized.length);

  for (let len = 2; len <= maxLen; len++) {
    prefixes.push(normalized.substring(0, len));
  }

  return prefixes;
}
```

#### Smart Search Strategy

```typescript
async function smartSearch(fileHash: string, query: string): Promise<BitSet | null> {
  const normalized = query.toLowerCase().trim();

  // Short queries: use prefix index
  if (normalized.length <= 3) {
    return await searchWithPrefix(fileHash, normalized);
  }

  // Long queries: try trigram first
  const trigramResult = await searchWithTrigrams(fileHash, normalized);
  if (trigramResult) return trigramResult;

  // Fallback to prefix
  return await searchWithPrefix(fileHash, normalized);
}
```

### 5. Lazy Loading with TanStack Virtual

```typescript
// Hook: useAccountDataSource
export function useAccountDataSource({
  fileHash,
  accountCount,
  chunkSize = 500,
  overscan = 10,
}) {
  const cacheRef = useRef<Map<string, AccountSlice>>(new Map())

  const getAccount = useCallback((index: number): AccountBadges | undefined => {
    // Determine slice
    const sliceStart = Math.floor(index / chunkSize) * chunkSize
    const sliceEnd = Math.min(sliceStart + chunkSize, accountCount)
    const cacheKey = `${sliceStart}-${sliceEnd}`

    // Check cache
    const cached = cacheRef.current.get(cacheKey)
    if (cached) {
      cached.timestamp = Date.now() // Update LRU
      return cached.accounts[index - sliceStart]
    }

    // Not cached: trigger async load (fire & forget)
    loadSlice(sliceStart, sliceEnd)
    return undefined // Show skeleton while loading
  }, [fileHash, chunkSize])

  return { getAccount }
}

// Component: AccountList
const { getAccount } = useAccountDataSource({ fileHash, accountCount })

const virtualizer = useVirtualizer({
  count: filteredIndices.length,
  getScrollElement: () => document.documentElement,
  estimateSize: () => 100,
  overscan: 5,
})

// Render only visible items
{virtualizer.getVirtualItems().map((virtualItem) => {
  const account = getAccount(filteredIndices[virtualItem.index])

  // Show skeleton if not loaded yet
  if (!account) return <SkeletonLoader />

  return <AccountItem account={account} />
})}
```

## Performance Results (v1.0)

> **Provenance — read before quoting any number below.** Audited 2026-08-14 against commit
> `8380b0d`. These figures are a **historical record of the v0.3 → v1.0 migration**, not a
> live measurement of current code, and the repository contains no artifact that reproduces
> them. Specifically:
>
> | Number                                              | What backs it                                                                                                                                                                                                                                           |
> | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
> | The `Real-World Benchmarks` table (M1 / Chrome 120) | A manual measurement taken once. No script, CI job or committed report reproduces it. It may well be accurate; it is not re-runnable.                                                                                                                   |
> | `32x`                                               | `src/__tests__/performance/filter-optimization.test.ts` — asserts `n / ceil(n/32) > 30`. An arithmetic identity. That file imports only vitest and a type and never calls the filter engine, so it proves the complexity class, not the implementation. |
> | `40x`, `75x`, `25x`, `3000x`                        | No derivation exists anywhere in the repository, in source or in tests.                                                                                                                                                                                 |
> | "filter <5ms at 1M"                                 | The only 1M-scale test (`src/__tests__/lib/filtering/IndexedDBFilterEngine.test.ts`) mocks the entire IndexedDB layer and asserts `duration < 500ms`. It measures in-memory bitset iteration, not storage.                                              |
>
> There is no benchmark harness: no perf step in `.github/workflows/`, and `npm run test:performance`
> is a plain `vitest run`. **Treat every figure here as a design target or a historical note.**
> Do not restate one as "achieved" or "measured" in another document, and do not put one in
> user-facing copy without measuring it first.

### Storage (1M accounts)

| Component        | Legacy v0.3 | IndexedDB v1.0 | Improvement     |
| ---------------- | ----------- | -------------- | --------------- |
| **Zustand**      | ~100 MB     | ~1 KB          | **100,000x**    |
| **localStorage** | ~100 MB     | N/A            | N/A             |
| **IndexedDB**    | N/A         | ~5 MB          | **40x smaller** |
| **Total**        | ~200 MB     | ~5 MB          | **40x**         |

### Filter Performance (1M accounts)

| Operation             | Legacy v0.3 | IndexedDB v1.0 | Improvement |
| --------------------- | ----------- | -------------- | ----------- |
| **Single badge**      | ~50ms       | ~2ms           | **25x**     |
| **3 badges AND**      | ~150ms      | ~2ms           | **75x**     |
| **Search (no index)** | ~3000ms     | ~100ms         | **30x**     |
| **Search (indexed)**  | ~3000ms     | ~1ms           | **3000x**   |

### Memory Usage (1M accounts)

| Phase                   | Legacy v0.3 | IndexedDB v1.0 | Improvement |
| ----------------------- | ----------- | -------------- | ----------- |
| **Initial load**        | ~200 MB     | ~5 MB          | **40x**     |
| **Filtering**           | ~200 MB     | ~5 MB          | **40x**     |
| **Rendering (all)**     | ~200 MB     | N/A            | N/A         |
| **Rendering (virtual)** | ~10 MB      | ~5 MB          | **2x**      |

### Real-World Benchmarks

**Environment**: MacBook Pro M1, Chrome 120

| Dataset | Upload | Filter | Search | Scroll FPS |
| ------- | ------ | ------ | ------ | ---------- |
| 10k     | ~0.5s  | <1ms   | <1ms   | 60         |
| 100k    | ~2s    | ~2ms   | ~1ms   | 60         |
| 1M      | ~8s    | ~5ms   | ~1ms   | 60         |
| 5M      | ~40s   | ~15ms  | ~2ms   | 60         |

## Implementation Details

### Ingestion — one bulk write, not chunks

This section used to show a `CHUNK_SIZE = 10000` loop calling `appendAccountsChunk`.
**That loop does not exist and never ran.** Corrected 2026-08-14 against commit `8380b0d`.

```typescript
// src/lib/parse-worker.ts — also parse-orchestration.ts and sample-data.ts
await indexedDBService.storeAllAccounts(fileHash, unified);
```

`storeAllAccounts` builds every column in a single pass and commits one transaction. It is
now the only write path there is: `appendAccountsChunk` was **deleted on 2026-08-30**, with
the two store functions reachable only through it and the no-op `set()` that advertised it.

There is no account-batching constant anywhere. The only `10_000` in the parse pipeline
is `MAX_ZIP_ENTRIES` (`src/core/parsers/instagram.ts`), a cap on ZIP entry count.

### Filter Engine

```typescript
export class IndexedDBFilterEngine {
  private fileHash: string | null = null;
  private totalAccounts = 0;
  private bitsetCache = new Map<BadgeKey, BitSet>();

  async filterToIndices(searchQuery: string, activeFilters: BadgeKey[]): Promise<number[]> {
    // 1. Load badge bitsets
    const bitsets = await Promise.all(activeFilters.map(badge => this.loadBitset(badge)));

    // 2. Intersect bitsets (AND operation)
    let resultBitset = bitsets[0];
    for (let i = 1; i < bitsets.length; i++) {
      resultBitset = resultBitset.intersect(bitsets[i]);
    }

    // 3. Apply search (if query provided)
    if (searchQuery.trim()) {
      const searchBitset = await smartSearch(this.fileHash, searchQuery);
      if (searchBitset) {
        resultBitset = resultBitset.intersect(searchBitset);
      }
    }

    // 4. Convert to indices
    return resultBitset.toIndices();
  }
}
```

### LRU Cache

```typescript
interface AccountSlice {
  start: number;
  end: number;
  accounts: AccountBadges[];
  timestamp: number;
}

const cacheRef = useRef<Map<string, AccountSlice>>(new Map());
const maxCachedSlices = 20;

// Evict oldest slices
function evictOldSlices() {
  if (cacheRef.current.size <= maxCachedSlices) return;

  const entries = Array.from(cacheRef.current.entries()).sort(
    (a, b) => a[1].timestamp - b[1].timestamp
  );

  const toRemove = entries.slice(0, entries.length - maxCachedSlices);
  toRemove.forEach(([key]) => cacheRef.current.delete(key));
}
```

## Migration from v0.3

**No automatic migration** — v1.0 is a clean break from legacy storage.

Users will need to re-upload their ZIP files. Benefits:

- ✅ Clean slate, no migration bugs
- ✅ Immediate performance gains
- ✅ Simpler codebase maintenance

## Future Optimizations

### Planned

- [ ] **Compression**: GZIP bitsets (2-5x smaller storage)
- [ ] **Incremental Updates**: Update bitsets without full reload
- [ ] **SharedArrayBuffer**: Zero-copy between worker and main thread
- [ ] **WebAssembly**: SIMD bitset operations (2-4x faster)

### Experimental

- [ ] **OPFS Integration**: Origin Private File System for very large files
- [ ] **Streaming ZIP**: Process without loading entire file
- [ ] **Delta Updates**: Only sync changed accounts

## References

- [FastBitSet.js](https://github.com/lemire/FastBitSet.js/) by Daniel Lemire
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [TanStack Virtual](https://tanstack.com/virtual/latest)
- [Columnar Storage](https://en.wikipedia.org/wiki/Column-oriented_DBMS)
- [Trigram Search](https://en.wikipedia.org/wiki/Trigram)

---

**Status**: Production Ready ✅  
**Version**: v1.0  
**Last Updated**: January 10, 2025

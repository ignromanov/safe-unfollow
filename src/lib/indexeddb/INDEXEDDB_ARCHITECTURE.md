# IndexedDB Architecture v2

**Date**: January 10, 2025  
**Version**: v2.0  
**Status**: ✅ Production Ready

## Overview

Instagram Unfollow Tracker uses IndexedDB v2 with columnar storage and bitset-based filtering to efficiently handle datasets of 1M+ accounts while maintaining sub-60ms filter latency and minimal memory footprint.

## Key Features

- ✅ **Columnar Storage** - Separate username, badge, and timestamp columns
- ✅ **Bitset Filtering** - 32x faster badge filtering using FastBitSet.js
- ✅ **Bulk Ingestion** - `storeAllAccounts()` writes every column in one transaction (the "10k account chunks" this line claimed until 2026-08-14 do not exist — see Configuration below)
- ✅ **Search Indexes** - Trigram and prefix indexes for O(1) search
- ✅ **Lazy Loading** - TanStack Virtual integration for on-demand rendering
- ✅ **Auto-Migration** - Seamless upgrade from localStorage/v1
- ✅ **LRU Caching** - In-memory caches for frequently accessed data

## Database Schema

### Stores

#### 1. `files` Store

Metadata registry for all processed files.

```typescript
interface FileMetadataRecord {
  fileHash: string; // SHA-256 hash (keyPath)
  fileName: string; // Original filename
  fileSize: number; // File size in bytes
  uploadDate: Date; // When uploaded
  accountCount: number; // Total accounts
  lastAccessed: number; // LRU timestamp
  version: number; // Schema version
  processingTime?: number; // Parse duration (ms)
}

// Indexes:
// - lastAccessed (for LRU cleanup)
// - version (for migration)
```

#### 2. `columns` Store

Columnar username data for efficient range queries.

```typescript
interface ColumnRecord {
  fileHash: string; // Composite key part 1
  column: 'usernames' | 'displayNames' | 'hrefs'; // Composite key part 2
  data: Uint8Array; // Packed string data
  offsets: Uint32Array; // Offset table for variable strings
  length: number; // Number of entries
}

// Indexes:
// - fileHash (for bulk queries)
```

**Storage Format:**

- Usernames packed into single `Uint8Array` buffer
- Offset table enables O(1) random access
- ~50% smaller than JSON arrays

#### 3. `bitsets` Store

Badge presence stored as compact bitsets.

```typescript
interface BitsetRecord {
  fileHash: string; // Composite key part 1
  badge: BadgeKey; // Composite key part 2
  data: Uint8Array; // Bitset (1 bit per account)
  accountCount: number; // Quick stats
}

// Indexes:
// - fileHash (for batch loading)
```

**Performance:**

- 1M accounts × 10 badges = **1.25 MB** (vs ~100 MB JSON)
- Intersection: O(n/32) bitwise AND operations
- Memory efficient: ~125 KB per badge

#### 4. `timestamps` Store

Sparse storage for time-based badges.

```typescript
interface TimestampRecord {
  fileHash: string; // Composite key part 1
  username: string; // Composite key part 2
  following?: number; // Unix timestamps
  followers?: number;
  pending?: number;
  restricted?: number;
  close?: number;
  unfollowed?: number;
  dismissed?: number;
  permanent?: number;
}

// Indexes:
// - fileHash (for range queries)
```

**Optimization:**

- Only stores accounts with timestamps
- Sparse storage reduces size ~70%

#### 5. `indexes` Store

Search index cache (trigrams & prefixes).

```typescript
interface SearchIndexRecord {
  fileHash: string; // Composite key part 1
  type: 'prefix' | 'trigram'; // Composite key part 2
  key: string; // Composite key part 3 (prefix/trigram)
  data: Uint8Array; // Bitset of matching accounts
  createdAt: number;
  expiresAt: number; // TTL (3 days default)
}

// Indexes:
// - fileHash (for cleanup)
// - expiresAt (for eviction)
```

## Data Flow

### File Upload & Processing

```
1. File Upload
   ↓
2. Generate SHA-256 Hash (first 1MB)
   ↓
3. Check IndexedDB Cache
   ├─→ HIT: Load from cache (instant)
   └─→ MISS: Parse file ↓

4. Parse ZIP in Web Worker
   ├─→ parseInstagramZipFile()
   ├─→ buildAccountBadgeIndex()
   └─→ Progress events (worker → parse-orchestration.ts:61; cadence is
       set by the worker, not by any 10k constant)

5. Bulk Ingestion — storeAllAccounts(), one transaction
   ├─→ Save file metadata
   ├─→ Build username columns in a single pass
   ├─→ Update badge bitsets
   └─→ Store timestamps (sparse)

6. Background Index Building (async)
   ├─→ Build prefix indexes (2-4 char)
   └─→ Build trigram indexes (3-char)

7. Update UI State
   └─→ Ready for filtering
```

### Filtering Pipeline

```
1. User Action (filters + search)
   ↓
2. IndexedDB Filter Engine
   ├─→ Load badge bitsets (cached)
   ├─→ Intersect bitsets (O(n/32))
   └─→ Result: account indices

3. Search Application (if query)
   ├─→ Check search index exists
   ├─→ smartSearch (trigram/prefix)
   ├─→ Intersect with badge results
   └─→ Fallback: linear search batches

4. Lazy Data Loading
   ├─→ Get visible range from virtualizer
   ├─→ Load accounts by indices (batched)
   ├─→ LRU cache for smooth scrolling
   └─→ Preload adjacent ranges

5. Render Virtual List
   └─→ TanStack Virtual (60 FPS)
```

## Performance Characteristics

> **Provenance**: audited 2026-08-14 against commit `8380b0d`. The figures below are **design
> targets and complexity arguments**, not measurements of the current implementation — the
> repository has no benchmark harness that reproduces any of them. The full breakdown of which
> number is backed by what lives in one place, `src/lib/filtering/FILTER_OPTIMIZATION.md`
> ("Performance Results → Provenance"); it is deliberately not copied here, because these
> numbers drifting apart across documents is the defect that audit found.
>
> Do not restate any figure below as "achieved", and do not put one into user-facing copy
> without measuring it first.

### Storage Size

| Dataset       | Old (localStorage) | New (IndexedDB v2) | Reduction |
| ------------- | ------------------ | ------------------ | --------- |
| 10k accounts  | ~2 MB              | ~100 KB            | **20x**   |
| 100k accounts | ~20 MB             | ~1 MB              | **20x**   |
| 1M accounts   | ~200 MB            | ~5 MB              | **40x**   |

### Filter Performance

| Operation         | Old (Linear) | New (Bitset) | Speedup  |
| ----------------- | ------------ | ------------ | -------- |
| Single badge      | O(n) ~50ms   | O(n/32) ~2ms | **25x**  |
| 3 badges AND      | O(3n) ~150ms | O(n/32) ~2ms | **75x**  |
| Search (no index) | O(n) ~100ms  | O(n) ~100ms  | 1x       |
| Search (indexed)  | O(n) ~100ms  | O(1) ~1ms    | **100x** |

### Memory Usage

| Component           | Size (1M accounts) |
| ------------------- | ------------------ |
| Badge bitsets (10)  | ~1.25 MB           |
| Username column     | ~10 MB             |
| Timestamp sparse    | ~2 MB              |
| Search indexes      | ~4 MB              |
| **Total IndexedDB** | **~17 MB**         |
| **Runtime (UI)**    | **~5 MB** (LRU)    |

## Key Technologies

### FastBitSet.js

High-performance bitset library by Daniel Lemire.

- **Repository**: https://github.com/lemire/FastBitSet.js/
- **Performance**: 32x faster than boolean arrays
- **Operations**: add, has, intersection, union, difference
- **Memory**: 1 bit per account (vs 8 bytes for boolean)

```typescript
import FastBitSet from 'fastbitset';

const bitset = new FastBitSet();
bitset.add(0);
bitset.add(1000);
bitset.has(1000); // true

// Intersection (AND)
const result = bitset.new_intersection(other);
```

### TanStack Virtual

Headless virtualization library for React.

- **Documentation**: https://tanstack.com/virtual/latest
- **Features**: Window scrolling, dynamic heights, overscan
- **Performance**: Renders only visible items (5-20 from 1M)

```typescript
const virtualizer = useVirtualizer({
  count: accounts.length,
  getScrollElement: () => document.documentElement,
  estimateSize: () => 100,
  overscan: 5,
});
```

## Migration Strategy

### Auto-Migration on Startup

The app automatically detects and migrates legacy data:

1. Check localStorage for `unfollow-radar-store`
2. Extract `unified` and `parsed` data
3. Generate file hash from metadata
4. Chunk and ingest into IndexedDB v2
5. Build search indexes in background
6. Preserve localStorage (safety)

```typescript
// In main.tsx
import { autoMigrate } from '@/lib/indexeddb-migration';

autoMigrate(true).catch(console.error);
```

### Manual Migration

```typescript
import { migrateLegacyData, getMigrationStatus } from '@/lib/indexeddb-migration';

// Check status
const status = getMigrationStatus();
console.log(status.hasLegacyData, status.legacyAccountCount);

// Migrate
await migrateLegacyData();
```

## Cache Management

### LRU Caching Strategy

**Bitset Cache** (in-memory):

- Key: `${fileHash}:${badge}`
- Max size: Unlimited (cleared on file change)
- Eviction: On file clear

**Column Cache** (in-memory):

- Key: `${fileHash}:${column}`
- Max size: Unlimited
- Eviction: On file clear

**Account Data Source** (hook):

- Slices: 500 accounts per slice
- Max slices: 20 (configurable)
- Eviction: LRU (oldest timestamp)

### Cache Invalidation

```typescript
// On file clear
indexedDBService.clearFile(fileHash); // Remove from IndexedDB
indexedDBService.clearCaches(fileHash); // Clear in-memory caches

// On new upload
indexedDBService.clearCaches(); // Clear all caches
```

## Search Optimization

### Trigram Index

**How it works:**

1. Pad username: `"user"` → `"__user__"`
2. Extract trigrams: `["__u", "_us", "use", "ser", "er_", "r__"]`
3. Build bitset for each trigram
4. Query intersects relevant trigrams

**Performance:**

- Index build: ~200ms for 100k accounts
- Search lookup: **O(1)** vs O(n) linear
- Memory: ~4 MB for 1M accounts

### Prefix Index

**How it works:**

1. Extract prefixes: `"user"` → `["us", "use", "user"]`
2. Build bitset for each prefix (2-4 chars)
3. Query finds exact prefix match

**Use case:**

- Short queries (2-3 chars)
- Autocomplete scenarios
- Faster than trigram for short strings

## Configuration

### Chunk Sizes — there is no account chunking on the write path

This section used to quote `const CHUNK_SIZE = 10000` from `src/lib/parse-worker.ts`. **That
constant does not exist there and never runs.** Corrected 2026-08-14 against commit `8380b0d`.

The real write path is a single bulk call:

```typescript
// src/lib/parse-worker.ts — also parse-orchestration.ts and sample-data.ts
await indexedDBService.storeAllAccounts(fileHash, unified);
```

`storeAllAccounts` builds every column in one pass and commits one transaction. No batching
constant is involved.

`IndexedDBService.appendAccountsChunk()` is the chunked API this section described. It has
**zero production callers on any branch** — `indexeddb-cache.ts`'s deprecated `set()` prints a
warning naming it and returns without calling it. Do not wire new code into it expecting the
documented flow; it is dead.

The only `10_000` in the parse pipeline is `MAX_ZIP_ENTRIES` in `src/core/parsers/instagram.ts`,
a safety cap on ZIP entry count — unrelated to account batching. The only real `CHUNK_SIZE` is
`1000` in `src/lib/export/data.ts`, for export files.

### Cache TTL

```typescript
// src/lib/indexeddb-schema.ts
export const CACHE_CONFIG = {
  FILE_CACHE_DAYS: 7, // File data expires after 7 days
  INDEX_CACHE_DAYS: 3, // Search indexes expire after 3 days
  MAX_INDEX_ENTRIES: 10000, // Max cached trigrams/prefixes
};
```

### Account Data Source

```typescript
// src/hooks/useAccountDataSource.ts
const sliceSize = 500; // Accounts per cached slice
const maxCachedSlices = 20; // Max slices in LRU cache
```

## Best Practices

### File Upload

1. ✅ Generate file hash for deduplication
2. ✅ Check cache before parsing
3. ✅ Use chunked processing for large files
4. ✅ Build search indexes in background
5. ✅ Display progress to user

### Filtering

1. ✅ Use bitset engine for badge filters
2. ✅ Leverage search indexes when available
3. ✅ Batch account loading (500-1000 at a time)
4. ✅ Cache results in memory (LRU)
5. ✅ Preload adjacent ranges for scrolling

### Memory Management

1. ✅ Clear caches on file change
2. ✅ Use LRU eviction for large datasets
3. ✅ Lazy load account data (don't load all)
4. ✅ Virtualize rendering (TanStack Virtual)
5. ✅ Monitor cache size in dev tools

## Troubleshooting

### Slow Filtering

**Symptom**: Filters take >100ms  
**Solution**:

- Check bitsets loaded (console logs)
- Verify worker is running (not fallback)
- Clear IndexedDB and re-upload

### High Memory Usage

**Symptom**: App uses >100 MB RAM  
**Solution**:

- Check LRU cache size (should evict)
- Clear old caches: `indexedDBService.clearCaches()`
- Reduce `maxCachedSlices` in data source

### Search Not Working

**Symptom**: Search is slow or doesn't work  
**Solution**:

- Check indexes built: `hasSearchIndexes(fileHash)`
- Rebuild indexes: re-upload file
- Check console for index build errors

### Migration Failed

**Symptom**: Legacy data not migrated  
**Solution**:

- Check localStorage has data
- Verify data structure (unified array)
- Manually trigger: `migrateLegacyData()`

## Future Enhancements

### Planned

- [ ] **Incremental Updates**: Update bitsets without full reload
- [ ] **Compression**: GZIP bitsets for storage (2-5x smaller)
- [ ] **SharedArrayBuffer**: Zero-copy between worker and UI
- [ ] **WebAssembly**: SIMD bitset operations (2-4x faster)

### Experimental

- [ ] **OPFS Integration**: Origin Private File System for large files
- [ ] **Streaming ZIP**: Process ZIP without loading into memory
- [ ] **Delta Updates**: Only sync changed accounts

## References

- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [FastBitSet.js](https://github.com/lemire/FastBitSet.js/)
- [TanStack Virtual](https://tanstack.com/virtual/latest)
- [Trigram Search](https://en.wikipedia.org/wiki/Trigram)
- [Columnar Storage](https://en.wikipedia.org/wiki/Column-oriented_DBMS)

---

**Status**: Production Ready ✅  
**Performance**: 40x smaller, 75x faster  
**Browser Support**: All modern browsers with IndexedDB  
**Memory**: ~5 MB runtime for 1M accounts

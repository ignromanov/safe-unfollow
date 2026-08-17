import { DB_CONFIG } from '@/lib/indexeddb/indexeddb-schema';
import { IndexedDBService } from '@/lib/indexeddb/indexeddb-service';
import { describe, expect, it } from 'vitest';

import 'fake-indexeddb/auto';

/**
 * GH#24: init() wired onsuccess/onerror/onupgradeneeded but not onblocked. When
 * another tab holds an open connection at an older DB version, the upgrade
 * transaction can't start until that tab closes or reloads — without onblocked,
 * no IDBOpenDBRequest event ever fires and init() hangs forever with no error
 * and no timeout.
 *
 * This file gets its own fake-indexeddb instance (vitest.config.ts sets
 * `isolate: true`, so each test file gets a fresh module/global registry). That
 * matters here specifically: it lets this test control connection ordering from
 * a clean database, which the shared indexeddb-service.test.ts suite (using the
 * same DB name via the shared `indexedDBService` singleton, already opened at
 * DB_CONFIG.version by the time any one test runs) cannot do without disturbing
 * other tests.
 *
 * No afterEach/deleteDatabase cleanup here deliberately: IndexedDBService has no
 * public way to close its internal connection (matching production, where the
 * app never closes it either — only page unload does, implicitly), so a
 * `deleteDatabase` call after a passing test would itself hang forever waiting
 * on a connection nothing can close. There is exactly one test in this file, so
 * no cross-test database state needs resetting.
 */
describe('IndexedDBService.init() — blocked upgrade (GH#24)', () => {
  it('rejects with an actionable message instead of hanging when another connection blocks the upgrade, and recovers once it closes', async () => {
    // Stand-in for "another tab has this app open at an older version": open a
    // connection at a lower version and never close it. A well-behaved tab would
    // close itself on the `versionchange` event fired at it once a newer-version
    // open() request arrives; deliberately not listening for that here reproduces
    // the stuck-tab scenario this bug is about.
    const staleConnection = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version - 1);
      req.onupgradeneeded = () => {
        // No stores needed — this connection only exists to hold the DB open at
        // an older version.
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    // A fresh instance (not the shared singleton) so `init()` actually calls
    // `indexedDB.open()` here instead of returning an already-cached connection.
    const service = new IndexedDBService();

    await expect(service.getFileMetadata('anything')).rejects.toThrow(/blocked/i);

    // The other tab closes (or the user follows the actionable message and closes
    // it). Without resetting `initPromise` on the blocked path, every later call on
    // this same instance would keep replaying the same cached rejection forever,
    // even though a fresh open() would now succeed.
    staleConnection.close();

    await expect(service.getFileMetadata('anything')).resolves.toBeNull();
  });
});

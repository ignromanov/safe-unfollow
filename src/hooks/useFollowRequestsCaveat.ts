import { indexedDBService } from '@/lib/indexeddb/indexeddb-service';
import { useEffect, useState } from 'react';

/**
 * Whether this dataset's `notFollowingBack` badge is overstated because a
 * follow-requests file could not be read (GH#41).
 *
 * Read from IndexedDB rather than from the live parse: `/results` is reached
 * from a stored file hash, and a returning visitor never re-parses at all. The
 * stored record is the only place that outlives the upload, so it is the only
 * place both the fresh and the returning reader can be told the same thing.
 *
 * Defaults to `false` and stays there on any failure — a missing record, a
 * record from before the field existed, or an environment with no IndexedDB.
 * A caveat that appears when nothing is wrong is worse than none at all: it
 * names a specific badge as unreliable on a page where every other number is
 * correct.
 */
export function useFollowRequestsCaveat(fileHash: string | null): boolean {
  const [unreadable, setUnreadable] = useState(false);

  useEffect(() => {
    if (!fileHash) {
      setUnreadable(false);
      return;
    }

    let cancelled = false;
    void indexedDBService
      .getFileMetadata(fileHash)
      .then(record => {
        if (!cancelled) setUnreadable(record?.followRequestsUnreadable === true);
      })
      .catch(() => {
        if (!cancelled) setUnreadable(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fileHash]);

  return unreadable;
}

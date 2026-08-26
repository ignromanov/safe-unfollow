import { namesTruncatedFile } from '@/core/types';
import type { RelationshipSkew } from '@/core/types';
import { indexedDBService } from '@/lib/indexeddb/indexeddb-service';
import { useEffect, useState } from 'react';

/**
 * Everything `/results` must warn the reader about for this dataset.
 *
 * Two independent reasons a badge count can be wrong, both recorded at parse
 * time and both read back from the same stored record:
 *
 * - `followRequestsUnreadable` — a follow-requests file was found and could
 *   not be read, so `notFollowingBack` is overstated (GH#41).
 * - `truncatedRelationshipFile` — a date range chosen when the export was
 *   requested left one of the two required files short, so four counts are
 *   wrong in two directions (`core/badges/index.ts`).
 *
 * They can be true at once and are not alternatives.
 */
export interface UploadCaveats {
  followRequestsUnreadable: boolean;
  truncatedRelationshipFile: RelationshipSkew;
}

/**
 * The quiet answer, and the one every failure falls back to.
 *
 * A module constant rather than a fresh object literal so that the common case
 * — no caveats, which is almost every upload — keeps a stable identity across
 * renders instead of invalidating every consumer that depends on it.
 */
const NO_CAVEATS: UploadCaveats = {
  followRequestsUnreadable: false,
  truncatedRelationshipFile: 'not-applicable',
};

/**
 * Reads this dataset's caveats from storage.
 *
 * Read from IndexedDB rather than from the live parse: `/results` is reached
 * from a stored file hash, and a returning visitor never re-parses at all. The
 * stored record is the only place that outlives the upload, so it is the only
 * place both the fresh and the returning reader can be told the same thing.
 *
 * Both flags default to quiet and stay there on any failure — a missing record,
 * a record from before the fields existed, or an environment with no
 * IndexedDB. A caveat that appears when nothing is wrong is worse than none at
 * all: it names specific badges as unreliable on a page where every other
 * number is correct.
 *
 * One read for both flags, deliberately. A second hook would be a second
 * `getFileMetadata` call against the same record on every visit to the page,
 * to answer a question the first call already returned.
 */
export function useUploadCaveats(fileHash: string | null): UploadCaveats {
  const [caveats, setCaveats] = useState<UploadCaveats>(NO_CAVEATS);

  useEffect(() => {
    if (!fileHash) {
      setCaveats(NO_CAVEATS);
      return;
    }

    let cancelled = false;
    void indexedDBService
      .getFileMetadata(fileHash)
      .then(record => {
        if (cancelled) return;
        const followRequestsUnreadable = record?.followRequestsUnreadable === true;
        // Absent means a record written before the field existed, or before the
        // verdict was widened — either way nothing is known about this parse's
        // skew, which is what `not-applicable` says. `no-skew` would turn a
        // missing field into a clean bill of health for every record in the
        // store that predates 2026-08-19.
        const truncatedRelationshipFile = record?.truncatedRelationshipFile ?? 'not-applicable';
        // The quiet case returns the shared constant rather than an equal-looking
        // literal. `useState` bails out on `Object.is`, so a fresh object here
        // would re-render `/results` on every visit, including the overwhelming
        // majority that have no caveat at all — a cost the boolean hook this
        // replaced did not have.
        // The shared constant covers every case with nothing to render, which
        // now means three verdicts rather than one `null`. Asked through the
        // predicate so the identity-stability trick above keeps working for the
        // quiet majority: `no-skew` and `insufficient-data` must land on
        // NO_CAVEATS too, or `/results` re-renders on every visit again.
        setCaveats(
          !followRequestsUnreadable && !namesTruncatedFile(truncatedRelationshipFile)
            ? NO_CAVEATS
            : { followRequestsUnreadable, truncatedRelationshipFile }
        );
      })
      .catch(() => {
        if (!cancelled) setCaveats(NO_CAVEATS);
      });

    return () => {
      cancelled = true;
    };
  }, [fileHash]);

  return caveats;
}

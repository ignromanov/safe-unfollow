import { namesTruncatedFile } from '@/core/types';
import type { DateZones, RelationshipSkew } from '@/core/types';
import { indexedDBService } from '@/lib/indexeddb/indexeddb-service';
import { useEffect, useState } from 'react';

/**
 * Everything `/results` must warn the reader about for this dataset.
 *
 * Two independent reasons a badge count can be wrong, both recorded at parse
 * time and both read back from the same stored record (alongside the date zones
 * and the stale-dates marker, described on the fields below):
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
  /** The file's zones once read; null while loading, on any failure, without a record, or for a pre-PR-2 record. */
  dateZones: DateZones | null;
  /** True only when a record WAS read and has no dateZones. Never true on failure or while loading. */
  datesStale: boolean;
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
  dateZones: null,
  datesStale: false,
};

/**
 * Reads this dataset's caveats from storage.
 *
 * Read from IndexedDB rather than from the live parse: `/results` is reached
 * from a stored file hash, and a returning visitor never re-parses at all. The
 * stored record is the only place that outlives the upload, so it is the only
 * place both the fresh and the returning reader can be told the same thing.
 *
 * Every field defaults to quiet and stays there on any failure — a missing record,
 * a record from before the fields existed, or an environment with no
 * IndexedDB. A caveat that appears when nothing is wrong is worse than none at
 * all: it names specific badges as unreliable on a page where every other
 * number is correct.
 *
 * One read for all four fields, deliberately. A second hook would be a second
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
        // `dateZones` is the displayability marker: a record without it was
        // stored before zones were kept, so its dates cannot be shown until the
        // file is uploaded again. Asked of a record that was actually read, so a
        // failed or pending read never claims the file is stale.
        const dateZones = record?.dateZones ?? null;
        const datesStale = record !== null && record.dateZones === undefined;
        setCaveats(
          !followRequestsUnreadable &&
            !namesTruncatedFile(truncatedRelationshipFile) &&
            dateZones === null &&
            !datesStale
            ? NO_CAVEATS
            : { followRequestsUnreadable, truncatedRelationshipFile, dateZones, datesStale }
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

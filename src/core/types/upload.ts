import type { ParsedAll } from './instagram-models';

/**
 * File metadata for UI layer.
 * Uses short field names (name, size) for convenience.
 * For IndexedDB storage, see FileMetadataRecord in indexeddb-schema.ts
 */
export interface FileMetadata {
  name: string;
  size: number;
  uploadDate: Date;
  fileHash?: string;
  accountCount?: number;
  lastAccessed?: number;
  version?: number;
  processingTime?: number;
}

// === Parse Result Types ===

/** Severity of a parse warning */
export type ParseWarningSeverity = 'info' | 'warning' | 'error';

/**
 * How the localised username label was resolved for one parse (GH#21 Task 5).
 * `instagram-labels.ts` decides this once per parse, pooled across every
 * optional relationship file present in the archive — see
 * `resolveUsernameLabelWithMode`.
 *
 * - `fast-path`: the literal label `username` (case/whitespace-insensitive)
 *   matched — the common case for an English-language export.
 * - `inferred`: no label was literally `username`, but archive-wide scoring
 *   (or its membership tiebreak) picked a clear winner.
 * - `unresolved`: `label_values` entries were present but no label won.
 *   A rise in this across many parses at once is the earliest signal that
 *   Instagram changed the record shape again — one archive alone is not.
 * - `not-applicable`: no `label_values` entry existed anywhere in the
 *   archive, so there was nothing to resolve.
 */
export type LabelResolutionMode = 'fast-path' | 'inferred' | 'unresolved' | 'not-applicable';

/**
 * What the skew detector concluded about the two required relationship files.
 *
 * `followers` / `following` name the list that starts materially later than the
 * other, and so appears to have been cut short before it was exported. The
 * detector and its thresholds live in `core/parsers/relationship-skew.ts`.
 *
 * The two quiet answers are deliberately not the same value, and that is the
 * whole point of this type. Until 2026-08-25 both were `null`, and from there
 * down every layer read them identically — no caveat, no affected chip, and no
 * analytics event, because `useFileUpload` gated on truthiness. So a parse that
 * produced no usable timestamp at all was indistinguishable from a clean one,
 * recorded as a successful upload, and left no trace to count later:
 *
 * - `no-skew`: the comparison ran on enough data and the two lists begin close
 *   enough together. A measured verdict.
 * - `insufficient-data`: the comparison could not run, because fewer than
 *   `MIN_TIMESTAMPS_FOR_SKEW` records in one of the lists carry a usable
 *   timestamp. **Nothing is known** about whether the export is short. This is
 *   the value that must never be read as reassurance.
 */
export type SkewVerdict = 'no-skew' | 'insufficient-data' | 'followers' | 'following';

/**
 * A `SkewVerdict`, or the admission that no comparison was ever attempted.
 *
 * `not-applicable` belongs to the early exits in `parseInstagramZipFile` — an
 * archive that would not open, one with too many entries, one that is not an
 * Instagram export. No relationship file was read on any of those paths, so
 * `no-skew` would assert a comparison that never happened and
 * `insufficient-data` a measurement that was never taken. Both are the same
 * class of untruth this type exists to remove. Named after
 * `LabelResolutionMode`'s member for the identical situation.
 */
export type RelationshipSkew = SkewVerdict | 'not-applicable';

/**
 * Whether the verdict names a relationship file as short.
 *
 * Every layer that renders or counts a truncation asks this, and each of them
 * used to ask it as a truthiness check on a nullable value. That was correct
 * for exactly as long as the two quiet answers were both `null`: the moment
 * they became distinct strings, `if (verdict)` started passing `no-skew`,
 * `insufficient-data` and `not-applicable` through as if a file were short —
 * silently, because all three are truthy and all three feed string
 * interpolation into i18n keys and analytics fields.
 *
 * So the question is asked in one place, as an allow-list over the two members
 * that mean it, rather than as a denial of the members that do not. A sixth
 * verdict added later is excluded by default, which is the safe direction: it
 * renders nothing until someone writes its copy, instead of rendering its own
 * name at the reader.
 */
export function namesTruncatedFile(
  verdict: RelationshipSkew
): verdict is 'followers' | 'following' {
  return verdict === 'followers' || verdict === 'following';
}

/** Warning about missing or malformed data during parsing */
export interface ParseWarning {
  /** Warning code for programmatic handling */
  code: string;
  /** Human-readable message */
  message: string;
  /** Severity level */
  severity: ParseWarningSeverity;
  /** How to fix this issue */
  fix?: string;
}

/** Information about an expected file in Instagram export */
export interface FileExpectation {
  /** File name pattern (e.g., "following.json", "followers_*.json") */
  name: string;
  /** Human-readable description of what this file contains */
  description: string;
  /** Is this file required for basic functionality? */
  required: boolean;
  /** Was this file found in the ZIP? */
  found: boolean;
  /** Number of items found (if applicable) */
  itemCount?: number;
  /** Actual path where file was found */
  foundPath?: string;
  /**
   * Records present in the file that could not be read (GH#21). `itemCount: 0`
   * on its own cannot separate "genuinely empty" from "full of records whose
   * shape we no longer understand" — this is the number that can.
   *
   * Every producer always writes a number, including `0` for an absent file, so
   * do not read `undefined` as a state: it only means the expectation was built
   * by older code. In particular `0` does **not** imply "nothing was wrong" —
   * when the top level was not recognized there were no records to count, and
   * that case is `formatUnreadable: true` with this at `0`. A renderer needs
   * both fields to tell the three outcomes apart.
   *
   * (This paragraph used to promise `undefined` for absent and unrecognized
   * files. No producer ever did that, so a renderer written against it would
   * have been wrong on every file.)
   */
  unreadableItemCount?: number;
  /**
   * True when the file was found but its top-level shape matched neither a bare
   * array, a known wrapper key, nor a single bare entry (GH#21). Kept distinct
   * from `unreadableItemCount` because they are different failures: Instagram
   * renaming the wrapper, versus Instagram changing the record.
   */
  formatUnreadable?: boolean;
}

/**
 * The markups a relationship file can be written in, and the ONE place the set
 * is spelled out.
 *
 * A tuple rather than a union so that the regex alternation, the type, and the
 * reader that dispatches on a file's extension are all derived from it. Those
 * three were three hand-written copies of the same two-element set, and the
 * third was the dangerous one: `parseRelationshipFile` asked `/\.html$/i` and
 * treated everything else as JSON, so a third extension added to the pattern
 * would have been handed to `JSON.parse` without anyone editing that line.
 */
export const RELATIONSHIP_FORMATS = ['json', 'html'] as const;

export type RelationshipFormat = (typeof RELATIONSHIP_FORMATS)[number];

/** Discovery status of expected files */
export interface FileDiscovery {
  /** Format of the export, or `unknown` when no relationship file was found. */
  format: RelationshipFormat | 'unknown';
  /** Is this a valid Instagram data export? */
  isInstagramExport: boolean;
  /** Base path where data was found */
  basePath?: string;
  /** All expected files and their status */
  files: FileExpectation[];
}

/** Result of parsing Instagram ZIP file */
export interface ParseResult {
  /** Parsed data (may be partial if some files are missing) */
  data: ParsedAll;
  /** Warnings about missing or malformed data */
  warnings: ParseWarning[];
  /** Information about which files were found */
  discovery: FileDiscovery;
  /** Whether we have enough data for meaningful analysis */
  hasMinimalData: boolean;
  /** How the username label was resolved for this parse (GH#21 Task 5). */
  labelResolutionMode: LabelResolutionMode;
  /**
   * True when a follow-requests file was found and could not be read, so the
   * `notFollowingBack` badge is overstated (GH#41).
   *
   * `notFollowingBack` is `following` minus `followers`, minus `pendingSent`,
   * minus `permanentRequests` (`core/badges/index.ts`). The last two come from
   * `pending_follow_requests.json` and the permanent-requests file; when either
   * is present but unreadable its map is empty, the subtraction removes nobody,
   * and every account with an outstanding request is badged "not following you
   * back". The drift warnings that record this carry severity 'warning', which
   * is rendered on no screen in the app — so without this field the wrong answer
   * ships as a right one.
   *
   * Required, not optional: every exit in `parseInstagramZipFile` knows the
   * answer, including the early ones that read no file at all (nothing was
   * read, so nothing is overstated — `false`). Same reasoning as
   * `labelResolutionMode`'s `'not-applicable'`.
   *
   * An absent request file is NOT a failure: most users have no pending
   * requests, and a caveat shown to everyone is a caveat nobody reads.
   */
  followRequestsUnreadable: boolean;
  /**
   * Which required relationship file appears to have been cut short, if either.
   *
   * Meta's export dialog offers a date range, and choosing one filters
   * `followers_*.json` by entry timestamp while leaving `following.json` whole.
   * The truncated file is present, well-formed and parses cleanly — it simply
   * holds fewer people — so nothing else in this result records it. Every
   * follower removed that way is reported as an account that does not follow
   * back, which is the worst answer this tool can give and the one it gives
   * with the most confidence.
   *
   * Measured on one account's own exports two days apart, same following list
   * both times: followers 364 -> 118, `notFollowingBack` 95 -> 294.
   *
   * Sibling to `followRequestsUnreadable` and overstates the same badge, but
   * for the opposite reason: that flag means data we could not read, this one
   * means data Instagram never put in the archive. They can fire together, and
   * the UI reads both.
   *
   * Required, not optional, for the same reason as its sibling: every exit in
   * `parseInstagramZipFile` knows the answer, including the early ones that
   * read no relationship file at all — those report `not-applicable`.
   *
   * Keeps the field name it was persisted under while carrying the wider type,
   * and that asymmetry is deliberate. `FileMetadataRecord` writes this key into
   * IndexedDB, `/results` reads it back for visitors who never re-parse, and
   * 37.3% of sessions with a successful upload carry a real value here. A
   * rename would read every one of those records as absent and silently drop
   * the caveat for exactly the readers it was built for.
   *
   * See `core/parsers/relationship-skew.ts` for what "cut short" is measured
   * against and why a false positive is the cheaper mistake here.
   */
  truncatedRelationshipFile: RelationshipSkew;
  /**
   * Whether the HTML relationship files behind `truncatedRelationshipFile`
   * (GH#156) fit their own month-name tables — see
   * `core/parsers/instagram-html-dates.ts` for what "fit" means and why no
   * fixed table covers every language.
   *
   * `insufficient-data` above has at least three different causes — too few
   * timestamps, rows that never matched the date shape at all, and a month
   * table that failed to fit — and only the last is locale-driven and only
   * the last is what this field answers. `false` means real date text was
   * present in an HTML `following` or `followers` file and could not be read,
   * which is the population `insufficient-data` alone cannot separate from a
   * small account.
   *
   * Optional rather than a `RelationshipSkew`-style enum with its own
   * `'not-applicable'` member: unlike that field, every exit does NOT know an
   * answer here. A JSON-only parse never asks the question, and fabricating
   * a value for it would send a fact to analytics that never existed — the
   * same omission `analytics.fileUploadSuccess` already makes for `format`
   * on its cache-hit path. `undefined` covers a JSON export, an early exit
   * that read no relationship file, and an HTML file whose rows carried no
   * date text at all; `combineDatesFitted` (`instagram-html.ts`) is what
   * turns per-file facts into this one.
   */
  datesFitted?: boolean;
}

/**
 * Upload state with discriminated union for type-safe status handling.
 * Each status variant has appropriate fields:
 * - idle: no file, no error
 * - loading: has fileName, no error
 * - success: has fileName, no error
 * - error: has error message, fileName optional
 */
export type UploadState =
  | { status: 'idle'; error: null; fileName: null }
  | { status: 'loading'; error: null; fileName: string }
  | { status: 'success'; error: null; fileName: string }
  | { status: 'error'; error: string; fileName: string | null };

/** Helper to create type-safe UploadState */
export function createUploadState(
  status: 'idle' | 'loading' | 'success' | 'error',
  fileName: string | null,
  error: string | null
): UploadState {
  switch (status) {
    case 'idle':
      return { status: 'idle', error: null, fileName: null };
    case 'loading':
      return { status: 'loading', error: null, fileName: fileName ?? '' };
    case 'success':
      return { status: 'success', error: null, fileName: fileName ?? '' };
    case 'error':
      return { status: 'error', error: error ?? 'Unknown error', fileName };
  }
}

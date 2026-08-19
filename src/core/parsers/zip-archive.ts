// The -native entry point, not the package root. The default build ships only
// a WASM codec; our CSP (vercel.json:69) grants no wasm-unsafe-eval, and a
// blocked WebAssembly.instantiate() is caught and retried against native
// CompressionStream rather than pure JS - which that build does not contain.
// This entry is native DecompressionStream first, pure-JS zlib second, no WASM:
// lib/zip-module-native.js sets wasmURI: null and supplies the zlib-js fallback.
import {
  BlobReader,
  ERR_ENCRYPTED,
  ERR_ENCRYPTED_CENTRAL_DIRECTORY,
  ERR_INVALID_PASSWORD,
  ERR_UNSUPPORTED_ENCRYPTION,
  TextWriter,
  ZipReader,
  configure,
} from '@zip.js/zip.js/lib/zip-core-native.js';
import type { ParseWarning } from '@/core/types';

// Also required by the CSP, not merely advisable: no worker-src or child-src is
// declared, so it inherits default-src 'self', which has no blob:. zip.js builds
// its worker pool from a blob URL. And the parser is already inside a Web Worker
// (src/lib/parse-worker.ts).
configure({ useWebWorkers: false });

/** One file inside the archive. Decompressed only when `text()` is called. */
export interface ZipEntry {
  readonly name: string;
  text(): Promise<string>;
}

/**
 * The parser's whole view of a ZIP: the entry names, and the ability to read a
 * few of them. Three members, because three are what the parser has ever used —
 * `src/__tests__/__mocks__/jszip.cjs` implemented exactly this surface years
 * before it had a name.
 *
 * Nothing downstream of this interface knows which library reads the archive,
 * which is what makes the backend replaceable.
 */
export interface ZipArchive {
  /**
   * Entry names from the archive's index, capped at the caller's `maxNames`.
   * Decompresses nothing. Complete whenever `count <= maxNames`, which is the
   * only case a caller may read it in — see `count`.
   */
  readonly names: string[];
  /**
   * How many entries the index actually holds, counted rather than measured
   * off `names`, which stops growing at `maxNames`.
   *
   * Separate because the two answer different questions: a caller decides
   * whether to go on from `count`, and only then looks at `names`.
   */
  readonly count: number;
  /**
   * Entries whose full path matches. Directory entries are excluded — the
   * semantics JSZip had at `!file.dir && regexp.test(relativePath)`
   * (`jszip/lib/object.js:225`), pinned by the characterisation tests.
   */
  find(pattern: RegExp): ZipEntry[];
}

/**
 * Which of the reader's two diagnostic codes a thrown zip.js error means.
 *
 * Compared against the library's own exported constants rather than searched
 * for as prose: the previous version tested the message for the substring
 * "encrypted", and the string it was written against — JSZip's "Encrypted zip
 * are not supported" — no longer exists anywhere in the program.
 *
 * It lives here because this is the one file that names the ZIP library. A
 * caller that had to know which phrases mean encryption would know which
 * library is underneath, which is the thing this module exists to hide.
 *
 * Encryption is not detectable when the archive is opened. Filenames are not
 * encrypted, so the central directory reads normally and only `getData` throws
 * (`zip-reader.js:738`) — which is why an encrypted export used to reach the
 * reader as a missing file rather than a locked one.
 */
const ENCRYPTION_ERRORS: ReadonlySet<string> = new Set([
  ERR_ENCRYPTED,
  ERR_ENCRYPTED_CENTRAL_DIRECTORY,
  ERR_INVALID_PASSWORD,
  ERR_UNSUPPORTED_ENCRYPTION,
]);

export function classifyZipFailure(error: unknown): 'ZIP_ENCRYPTED' | 'CORRUPTED_ZIP' {
  const message = error instanceof Error ? error.message : String(error);
  return ENCRYPTION_ERRORS.has(message) ? 'ZIP_ENCRYPTED' : 'CORRUPTED_ZIP';
}

/**
 * The warning for an entry that was in the archive's index and threw when
 * read — encrypted, damaged, or an unsupported compression method. Shared by
 * every caller of `ZipEntry.text()` (`instagram.ts`, `instagram-followers.ts`)
 * so the phrasing and fix cannot drift between them; only the severity, which
 * depends on whether the entry was required, is theirs to decide.
 */
export function describeUnreadableZipEntry(
  name: string,
  error: unknown,
  severity: ParseWarning['severity']
): ParseWarning {
  return {
    code: classifyZipFailure(error),
    message: `Found ${name} but could not read it: ${error instanceof Error ? error.message : String(error)}`,
    severity,
    fix: 'Try re-downloading your data from Instagram Settings.',
  };
}

/**
 * @param keep Which entries this archive may later be asked to read. Names are
 *   always listed in full; only matching entries keep an object, and `find`
 *   can therefore only ever return one of those. Callers pass
 *   `RELEVANT_FILE_PATTERN`, derived from the file specs.
 *
 *   Not an optimisation with a threshold — a correctness bound. `getEntries()`
 *   materialises the whole central directory, and a zip.js entry costs about
 *   7.6 KB of retained heap; 50 000 entries from an 8 MB archive held 364 MB,
 *   measured on Node 24 with --expose-gc after collection. The cost tracks the
 *   entry count, not the archive's size, so a media-heavy export OOMs a mobile
 *   tab with no error to show for it — the worker is killed, nothing is posted
 *   back, and the reader waits out the 60-second timeout.
 *
 * @param maxNames How many entry names to retain. `keep` bounds the entry
 *   objects; this bounds the strings, which are not free either: 5 000 000
 *   names of 41 characters held 406.6 MB, measured on Node 24 with --expose-gc
 *   after collection, and real media paths are longer than 41 characters.
 *
 *   A ceiling checked after the walk is not a ceiling. Pass the same number the
 *   caller will compare `count` against, so the walk retains at most what an
 *   accepted archive needs and an archive above the ceiling is rejected without
 *   ever having held its own claim.
 */
export async function openZipArchive(
  file: Blob,
  keep: RegExp,
  maxNames: number
): Promise<ZipArchive> {
  // filenameValidation 'tolerant', against zip.js's 'balanced' default: one
  // entry named `../x`, `/x` or `C:\x` otherwise makes getEntries() throw for
  // the whole archive (zip-reader.js:448), and JSZip read those.
  //
  // The check protects extractors that write to disk. This reader writes
  // nothing — it lists names and matches them against anchored patterns — so
  // there is no traversal here to protect against. What the default does catch
  // is an export somebody unzipped and re-zipped, which it rejects as a corrupt
  // file with advice to re-download that cannot help.
  const reader = new ZipReader(new BlobReader(file), { filenameValidation: 'tolerant' });
  // getEntriesGenerator, not getEntries: the same tail slices and the same
  // central-directory walk, but each entry is discardable as it goes.
  const names: string[] = [];
  const files: ZipEntry[] = [];
  let count = 0;
  for await (const entry of reader.getEntriesGenerator()) {
    count++;
    // Counted always, retained up to maxNames. The caller's ceiling is checked
    // against `count` after this returns, so an archive above it is rejected
    // having retained a bounded prefix instead of every name it claimed.
    if (names.length < maxNames) names.push(entry.filename);
    // Directory entries are listed and never returned by find — the semantics
    // JSZip had at `!file.dir && regexp.test(relativePath)`
    // (`jszip/lib/object.js:225`), pinned by the characterisation tests.
    if (entry.directory || !keep.test(entry.filename)) continue;
    files.push({
      name: entry.filename,
      text: () => entry.getData!(new TextWriter()),
    });
  }

  return {
    names,
    count,
    find: (pattern: RegExp): ZipEntry[] => files.filter(f => pattern.test(f.name)),
  };
}

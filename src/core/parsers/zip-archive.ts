// The -native entry point, not the package root. The default build ships only
// a WASM codec; our CSP (vercel.json:69) grants no wasm-unsafe-eval, and a
// blocked WebAssembly.instantiate() is caught and retried against native
// CompressionStream rather than pure JS - which that build does not contain.
// This entry is native DecompressionStream first, pure-JS zlib second, no WASM:
// lib/zip-module-native.js sets wasmURI: null and supplies the zlib-js fallback.
import {
  BlobReader,
  TextWriter,
  ZipReader,
  configure,
} from '@zip.js/zip.js/lib/zip-core-native.js';

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
  /** Every entry name, from the archive's index. Decompresses nothing. */
  readonly names: string[];
  /**
   * Entries whose full path matches. Directory entries are excluded — the
   * semantics JSZip had at `!file.dir && regexp.test(relativePath)`
   * (`jszip/lib/object.js:225`), pinned by the characterisation tests.
   */
  find(pattern: RegExp): ZipEntry[];
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
 */
export async function openZipArchive(file: Blob, keep: RegExp): Promise<ZipArchive> {
  const reader = new ZipReader(new BlobReader(file));
  // getEntriesGenerator, not getEntries: the same tail slices and the same
  // central-directory walk, but each entry is discardable as it goes.
  const names: string[] = [];
  const files: ZipEntry[] = [];
  for await (const entry of reader.getEntriesGenerator()) {
    names.push(entry.filename);
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
    find: (pattern: RegExp): ZipEntry[] => files.filter(f => pattern.test(f.name)),
  };
}

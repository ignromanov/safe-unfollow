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

export async function openZipArchive(file: Blob): Promise<ZipArchive> {
  const reader = new ZipReader(new BlobReader(file));
  // Reads the end-of-central-directory record and the central directory only:
  // tail slices, no entry data.
  const entries = await reader.getEntries();
  const files = entries.filter(e => !e.directory);

  return {
    names: entries.map(e => e.filename),
    find(pattern: RegExp): ZipEntry[] {
      return files
        .filter(e => pattern.test(e.filename))
        .map(e => ({
          name: e.filename,
          text: () => e.getData!(new TextWriter()),
        }));
    },
  };
}

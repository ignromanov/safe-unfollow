import JSZip from 'jszip';

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
   * Entries whose full path matches. Directory entries are excluded, matching
   * JSZip's `!file.dir && regexp.test(relativePath)`
   * (`node_modules/jszip/lib/object.js:225`).
   */
  find(pattern: RegExp): ZipEntry[];
}

export async function openZipArchive(file: Blob): Promise<ZipArchive> {
  const zip = await JSZip.loadAsync(file);

  return {
    names: Object.keys(zip.files ?? {}),
    find(pattern: RegExp): ZipEntry[] {
      return zip.file(pattern).map(f => ({
        name: f.name,
        text: () => f.async('text'),
      }));
    },
  };
}

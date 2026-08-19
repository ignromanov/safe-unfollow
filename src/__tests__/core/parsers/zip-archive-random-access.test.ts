import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openZipArchive } from '@/core/parsers/zip-archive';

/**
 * Every byte that changes hands, whoever asks for it.
 *
 * `FileReader.prototype.readAsArrayBuffer` is jsdom's only route from a Blob to
 * its bytes — its Blob has `slice` and nothing else, and `vitest/blob-polyfill`
 * builds `arrayBuffer()` on top of exactly this. Instrumenting the prototype
 * therefore sees every read by every caller, including reads of slices, and it
 * sees them the same way whichever ZIP library is underneath.
 *
 * Watching a single Blob instance would not: JSZip reads the whole archive
 * through a FileReader and never touches the Blob's own methods, so an
 * instrument on the instance recorded nothing at all and its silence looked
 * exactly like restraint.
 */
function instrumentReads() {
  const sizes: number[] = [];
  const original = FileReader.prototype.readAsArrayBuffer;

  FileReader.prototype.readAsArrayBuffer = function (blob: Blob) {
    sizes.push(blob.size);
    return original.call(this, blob);
  };

  return {
    sizes,
    restore: () => {
      FileReader.prototype.readAsArrayBuffer = original;
    },
  };
}

async function buildBulkyZip(): Promise<Blob> {
  const zip = new JSZip();
  // One entry the parser wants, and a lot of incompressible filler standing in
  // for the media that makes real exports large.
  zip.file('connections/followers_and_following/following.json', '{"relationships_following":[]}');
  for (let i = 0; i < 40; i++) {
    const noise = new Uint8Array(64 * 1024);
    for (let b = 0; b < noise.length; b++) noise[b] = (i * 31 + b * 17) % 256;
    zip.file(`media/photo_${i}.bin`, noise);
  }
  return zip.generateAsync({ type: 'blob' });
}

describe('random access', () => {
  let blob: Blob;
  let instrument: ReturnType<typeof instrumentReads>;

  beforeEach(async () => {
    // Built before instrumenting: writing the fixture is a test concern and its
    // reads are not the subject.
    blob = await buildBulkyZip();
    instrument = instrumentReads();
  });

  afterEach(() => instrument.restore());

  const total = () => instrument.sizes.reduce((sum, n) => sum + n, 0);

  it('never reads a range covering the whole archive', async () => {
    const archive = await openZipArchive(blob);
    const [entry] = archive.find(/following\.json$/);
    await entry.text();

    // Without this, a reader that produced bytes some other way would record
    // nothing, and "no read spans the archive" would be true of a silence.
    expect(instrument.sizes.length).toBeGreaterThan(0);
    expect(instrument.sizes.some(size => size >= blob.size)).toBe(false);
  });

  it('reads far less than the archive to get one small entry', async () => {
    const archive = await openZipArchive(blob);
    await archive.find(/following\.json$/)[0].text();

    expect(instrument.sizes.length).toBeGreaterThan(0);
    // Generous: the point is orders of magnitude, not a tuned threshold.
    expect(total()).toBeLessThan(blob.size / 4);
  });

  it('listing names decompresses nothing', async () => {
    const archive = await openZipArchive(blob);
    expect(archive.names.filter(name => !name.endsWith('/'))).toHaveLength(41);

    expect(instrument.sizes.length).toBeGreaterThan(0);
    expect(total()).toBeLessThan(blob.size / 4);
  });
});

describe('the entry list this backend produces', () => {
  it('is exactly the list JSZip reported, directory entries included', async () => {
    const blob = await buildBulkyZip();

    const viaJSZip = Object.keys((await JSZip.loadAsync(blob)).files);
    const viaAdapter = (await openZipArchive(blob)).names;

    // Worth testing rather than assuming: the two libraries build this list
    // differently. JSZip synthesises a folder object for every path segment;
    // zip.js reports the central directory as written. They agree — on an
    // archive that carries real directory entries and on one written with
    // createFolders: false, which JSZip's writer emits them for anyway.
    //
    // This test is only possible while jszip is still installed as the fixture
    // writer. If it is ever dropped, this equivalence goes with it.
    expect(viaAdapter).toEqual(viaJSZip);
    expect(viaAdapter.filter(name => !name.endsWith('/'))).toHaveLength(41);
  });
});

describe('ZIP64', () => {
  it('reads an archive carrying ZIP64 end-of-central-directory structures', async () => {
    const { TextReader, Uint8ArrayWriter, ZipWriter } = await import(
      '@zip.js/zip.js/lib/zip-core-native.js'
    );
    // Forced rather than provoked: the natural triggers are an entry, an
    // archive or an offset above 4 GiB, or more than 65 535 entries. The entry
    // count is the only affordable one, and JSZip cannot write it — see the
    // limitation test below — so the option is what a fixture can use.
    //
    // Uint8ArrayWriter, not BlobWriter, and the reason is a silent corruption
    // rather than a preference. BlobWriter finishes through
    // `new Blob([await new Response(stream).blob()])` (compatible-streams.js:63).
    // The inner Blob is undici's; the outer constructor is jsdom's. On Node 24
    // the inner one passes `instanceof Blob` and the bytes survive; on Node 20
    // and 22 it does not, so jsdom's BlobPart conversion stringifies it and the
    // whole archive becomes the 13 bytes of "[object Blob]" - no error, no
    // warning, a 388-byte fixture silently replaced by junk. Measured on this
    // machine (Node 24, green) against CI (Node 20 and 22, red) for the same
    // commit. Bytes never leave one realm this way.
    const writer = new ZipWriter(new Uint8ArrayWriter(), { zip64: true });
    await writer.add(
      'connections/followers_and_following/following.json',
      new TextReader('{"relationships_following":[]}')
    );
    const raw = await writer.close();
    const blob = new Blob([raw]);

    // Prove the fixture is what it claims before trusting what it demonstrates:
    // PK\x06\x06 is the ZIP64 end-of-central-directory record signature.
    const hasZip64Eocd = raw.some(
      (_, i) =>
        raw[i] === 0x50 && raw[i + 1] === 0x4b && raw[i + 2] === 0x06 && raw[i + 3] === 0x06
    );
    expect(hasZip64Eocd).toBe(true);

    const archive = await openZipArchive(blob);
    expect(archive.names).toEqual(['connections/followers_and_following/following.json']);
    expect(await archive.find(/following\.json$/)[0].text()).toContain('relationships_following');
  });

  it('trusts the entry count in the end-of-central-directory record', async () => {
    // Not a defect to fix here, but a limitation to record. Measured against
    // this backend: an archive of 65 539 entries whose writer emitted a plain
    // EOCD - the count truncated to 65 539 & 0xFFFF = 3, with no ZIP64 record -
    // is read as 3 entries, while JSZip's reader scanned past the count and
    // found all 65 539. zip.js looks for ZIP64 structures only when the 16-bit
    // count reads exactly 0xFFFF (zip-reader.js:276), which is what APPNOTE
    // 6.3.0 requires a compliant writer to leave there.
    //
    // The mechanism is demonstrated with a two-byte edit instead of a
    // 65 000-entry fixture, which costs eight seconds to build and shows the
    // same thing.
    //
    // Task 6 admits archives above 65 535 entries for the first time. It, not
    // this task, is where the consequence has to be faced.
    const zip = new JSZip();
    zip.file('a.json', '{}');
    zip.file('b.json', '{}');
    const raw = new Uint8Array(await (await zip.generateAsync({ type: 'blob' })).arrayBuffer());

    // End of central directory: PK\x05\x06, with the entry counts at +8 and +10.
    let eocd = -1;
    for (let i = raw.length - 22; i >= 0; i--) {
      if (raw[i] === 0x50 && raw[i + 1] === 0x4b && raw[i + 2] === 0x05 && raw[i + 3] === 0x06) {
        eocd = i;
        break;
      }
    }
    expect(eocd).toBeGreaterThan(-1);
    new DataView(raw.buffer).setUint16(eocd + 8, 1, true);
    new DataView(raw.buffer).setUint16(eocd + 10, 1, true);

    const archive = await openZipArchive(new Blob([raw]));
    expect(archive.names).toEqual(['a.json']);
  });
});

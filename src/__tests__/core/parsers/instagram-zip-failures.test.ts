import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { parseInstagramZipFile } from '@/core/parsers/instagram';

/**
 * The parser against real ZIP bytes.
 *
 * Every other parser test mocks `@/core/parsers/zip-archive`, so until this
 * file existed nothing exercised the seam between the reader and the parser —
 * and that seam is where the backend swap moved things. JSZip's `loadAsync`
 * walked the central directory *and* every local file header, so encryption and
 * unsupported compression threw while the archive was being opened, inside the
 * parser's only try. zip.js reads the central directory alone, so the same
 * conditions now throw when an entry is read. What used to be one guarded call
 * became two unguarded ones.
 *
 * A Blob, not a File: `vitest/file-mock.ts` replaces `global.File` with a
 * string-backed stub whose `arrayBuffer()` TextEncodes `chunks.join('')`, so a
 * `new File([blob], 'x.zip')` here would hand the reader the twelve characters
 * of "[object Blob]". `parseInstagramZipFile` only ever passes its argument to
 * `openZipArchive`, which takes a Blob.
 */
const asFile = (blob: Blob) => blob as File;

const FOLLOWING = 'connections/followers_and_following/following.json';
const FOLLOWERS = 'connections/followers_and_following/followers_1.json';

const followingPayload = JSON.stringify({
  relationships_following: [
    {
      title: '',
      media_list_data: [],
      string_list_data: [{ href: 'https://instagram.com/alpha', value: 'alpha', timestamp: 1 }],
    },
  ],
});

const followersPayload = JSON.stringify({
  relationships_followers: [
    {
      title: '',
      media_list_data: [],
      string_list_data: [{ href: 'https://instagram.com/beta', value: 'beta', timestamp: 2 }],
    },
  ],
});

async function buildEncryptedZip(): Promise<Blob> {
  const { TextReader, Uint8ArrayWriter, ZipWriter } =
    await import('@zip.js/zip.js/lib/zip-core-native.js');
  // Uint8ArrayWriter rather than BlobWriter — the latter finishes through a
  // cross-realm `new Blob([undiciBlob])` that jsdom stringifies on Node 20/22.
  // See the ZIP64 fixture in zip-archive-random-access.test.ts.
  const writer = new ZipWriter(new Uint8ArrayWriter());
  await writer.add(FOLLOWING, new TextReader(followingPayload), { password: 'not-the-users' });
  await writer.add(FOLLOWERS, new TextReader(followersPayload), { password: 'not-the-users' });
  return new Blob([await writer.close()]);
}

describe('a password-protected export', () => {
  it('is reported as encrypted, not as a file we could not find', async () => {
    // The whole point: zip.js lists the names of an encrypted archive happily —
    // filenames are not encrypted — so `openZipArchive` succeeds and
    // `analyzeZipStructure` sees a perfectly good Instagram export. The failure
    // arrives only when an entry is read. Before this was handled, that read
    // failure was caught and rewritten as a warning-severity JSON_PARSE_ERROR,
    // the file was then reported MISSING, and the upload SUCCEEDED with an
    // empty `following` set — every follower badged notFollowedBack.
    const result = await parseInstagramZipFile(asFile(await buildEncryptedZip()));

    expect(result.hasMinimalData).toBe(false);
    const error = result.warnings.find(w => w.severity === 'error');
    expect(error?.code).toBe('ZIP_ENCRYPTED');
  });

  it('names the file it could not read, so the message is about something real', async () => {
    const result = await parseInstagramZipFile(asFile(await buildEncryptedZip()));

    const error = result.warnings.find(w => w.severity === 'error');
    expect(error?.message).toContain('following.json');
  });
});

describe('an entry name a strict reader would refuse', () => {
  it('does not cost the reader the rest of the archive', async () => {
    // zip.js defaults to strictness 'balanced', where `..`, a leading slash or
    // a drive letter in ANY entry name makes getEntries() throw for the WHOLE
    // archive (zip-reader.js:448). JSZip sanitised such names and read on.
    //
    // That protection is for extractors that write to disk. This reader writes
    // nothing: it lists names and matches them against anchored patterns, so
    // there is no traversal to protect against — only an export somebody
    // unzipped and re-zipped, rejected as CORRUPTED_ZIP with advice to
    // re-download from Instagram that could not possibly help.
    const zip = new JSZip();
    zip.file(FOLLOWING, followingPayload);
    zip.file(FOLLOWERS, followersPayload);
    zip.file('../escaped.txt', 'from a re-zip');
    const blob = await zip.generateAsync({ type: 'blob' });

    const result = await parseInstagramZipFile(asFile(blob));

    expect(result.hasMinimalData).toBe(true);
    expect([...result.data.following]).toEqual(['alpha']);
    expect([...result.data.followers]).toEqual(['beta']);
  });
});

describe('a required file that is present and unreadable', () => {
  it('fails loudly rather than reporting the file missing', async () => {
    // Truncating the compressed stream of one entry, leaving the central
    // directory intact: the name is listed, the read fails. "Missing" and
    // "present but unintelligible" are different answers and the reader can act
    // on only one of them (GH#21).
    const zip = new JSZip();
    zip.file(FOLLOWING, followingPayload);
    zip.file(FOLLOWERS, followersPayload);
    const raw = new Uint8Array(await (await zip.generateAsync({ type: 'blob' })).arrayBuffer());
    // Corrupt the first entry's deflate stream in place — the local header is
    // 30 bytes plus the filename, so the payload starts well before byte 200.
    for (let i = 40 + FOLLOWING.length; i < 40 + FOLLOWING.length + 24; i++) raw[i] ^= 0xff;

    const result = await parseInstagramZipFile(asFile(new Blob([raw])));

    expect(result.hasMinimalData).toBe(false);
    expect(result.warnings.some(w => w.severity === 'error')).toBe(true);
    expect(result.warnings.some(w => w.code === 'MISSING_FOLLOWING')).toBe(false);
  });
});

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { openZipArchive } from '@/core/parsers/zip-archive';

// These characterise the adapter itself, so they keep every entry. Production
// passes RELEVANT_FILE_PATTERN — see openZipArchive's docblock for why.
const KEEP_EVERYTHING = /./;

// Deliberately NOT vi.mock('jszip'): these tests record what the real library
// does, so the Task 2 backend swap has something to be equivalent to. The four
// parser tests that do mock it are testing the parser, not the reader.
async function buildZip(files: Record<string, string>, dirs: string[] = []): Promise<Blob> {
  const zip = new JSZip();
  for (const dir of dirs) zip.folder(dir);
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  return zip.generateAsync({ type: 'blob' });
}

describe('openZipArchive', () => {
  it('lists every entry name without decompressing', async () => {
    const blob = await buildZip({
      'connections/followers_and_following/following.json': '{"a":1}',
      'ads_information/ads.json': '{}',
    });
    const archive = await openZipArchive(blob, KEEP_EVERYTHING);
    expect(archive.names).toContain('connections/followers_and_following/following.json');
    expect(archive.names).toContain('ads_information/ads.json');
  });

  it('matches the pattern against the whole path, not the basename', async () => {
    const blob = await buildZip({ 'connections/followers_and_following/following.json': '{}' });
    const archive = await openZipArchive(blob, KEEP_EVERYTHING);
    expect(archive.find(/^connections\/.*\/following\.json$/i)).toHaveLength(1);
    expect(archive.find(/^following\.json$/i)).toHaveLength(0);
  });

  it('excludes directory entries, as JSZip does with !file.dir', async () => {
    const blob = await buildZip({ 'connections/following.json': '{}' }, ['connections']);
    const archive = await openZipArchive(blob, KEEP_EVERYTHING);
    const matched = archive.find(/^connections\/?$/i);
    expect(matched).toHaveLength(0);
  });

  it('reads an entry as UTF-8 text, preserving non-ASCII usernames', async () => {
    const blob = await buildZip({ 'a.json': '{"u":"안녕_日本_café"}' });
    const archive = await openZipArchive(blob, KEEP_EVERYTHING);
    const [entry] = archive.find(/^a\.json$/);
    expect(await entry.text()).toBe('{"u":"안녕_日本_café"}');
  });

  it('exposes the entry name, which the parser reports in warnings', async () => {
    const blob = await buildZip({ 'deep/path/file.json': '{}' });
    const archive = await openZipArchive(blob, KEEP_EVERYTHING);
    expect(archive.find(/file\.json$/)[0].name).toBe('deep/path/file.json');
  });
});

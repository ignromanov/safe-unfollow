import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The IndexNow key file, and the one thing about it that can silently break.
 *
 * IndexNow authenticates a submission by fetching `https://<host>/<key>.txt` and checking the
 * key is in it. If the filename and the contents ever disagree, every submission answers
 * **403 Forbidden** ("key not found, or file found but key not in the file",
 * indexnow.org/documentation) — and nothing on the site looks any different, because the file
 * is inert until a submission happens. That is the whole failure mode, and the assertion below
 * is the whole guard.
 *
 * The key is NOT restated in this file. The content is compared against the *filename*, so
 * there is one copy of the key in the repository and this test reads it rather than repeating
 * it — the same reason `noindex-routes.ts` derives its path set instead of listing it.
 *
 * ⛔ The file must stay served for as long as we ever intend to submit again. It is not a
 * one-time artefact of the sweep that introduced it: a later submission with the file removed
 * gets a 403, not a warning.
 *
 * No trailing newline: the file is exactly the key, as Bing Webmaster generated it. The
 * documentation states the contents are the key and says nothing about surrounding whitespace,
 * so the byte-exact form is kept rather than assuming a newline is tolerated.
 */

const PUBLIC_DIR = join(process.cwd(), 'public');

/** IndexNow's own key charset and length bounds (indexnow.org/documentation): 8-128 of a-zA-Z0-9-. */
const KEY_SHAPED = /^[A-Za-z0-9-]{8,128}$/;

/**
 * `public/` also ships `ads.txt`, `llms.txt` and `robots.txt`, which are not keys. A key file is
 * recognised by its NAME having the shape IndexNow requires — not by being listed here, so
 * rotating the key means dropping in the new file and deleting the old one, with nothing to edit.
 */
function keyFiles(): string[] {
  return readdirSync(PUBLIC_DIR)
    .filter(name => name.endsWith('.txt'))
    .filter(name => KEY_SHAPED.test(basename(name, '.txt')))
    .sort();
}

describe('IndexNow key file', () => {
  /**
   * Asserted on the array, not its length, so a failure prints the names. Zero means no
   * submission can authenticate. More than one is not an error to IndexNow, but it means the
   * repository no longer states which key is ours, and a rotation left residue behind.
   */
  it('ships exactly one key-shaped file in public/', () => {
    expect(keyFiles()).toEqual([expect.stringMatching(/\.txt$/)]);
  });

  it('contains exactly its own filename, with nothing around it', () => {
    const name = keyFiles()[0];
    const raw = readFileSync(join(PUBLIC_DIR, name), 'utf-8');

    expect(raw).toBe(basename(name, '.txt'));
  });

  /**
   * The control, and it is the reason the two assertions above are not vacuous: they are both
   * derived from `keyFiles()`, so an empty `public/` — or a filter that stopped matching —
   * would make "exactly one" the only thing that fails, with no hint why. This states that the
   * recogniser still rejects the neighbours it is supposed to reject.
   */
  it('does not mistake the other public .txt files for keys', () => {
    const allTxt = readdirSync(PUBLIC_DIR).filter(n => n.endsWith('.txt'));

    expect(allTxt.length).toBeGreaterThan(1);
    expect(allTxt).toContain('robots.txt');
    expect(keyFiles()).not.toContain('robots.txt');
  });
});

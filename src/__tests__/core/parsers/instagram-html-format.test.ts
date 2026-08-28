import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { parseInstagramZipFile } from '@/core/parsers/instagram';

/**
 * The format predicate against real ZIP bytes.
 *
 * `HTML_FORMAT` is the single largest failure on the site — 2 276 events across
 * 1 293 sessions in the 30 days to 2026-08-25, 53.4% of all upload errors, and
 * 60.2% of those sessions never succeeded at all. Until this file existed,
 * nothing executed that predicate against an archive. Every other test that
 * mentions the code (`core/types.test.ts`, `DiagnosticErrorScreen.test.tsx`,
 * `diagnostic-utils.test.tsx`, `wizard-routing.test.ts`,
 * `error-classifier.test.ts`, `analytics.test.ts`) asserts the code *string*
 * against UI and classifier logic, never against bytes.
 *
 * **These were characterization tests and are now specifications.** They pinned
 * what the predicate did while HTML was refused, so that turning that rejection
 * into a dispatch could not silently change which uploads are refused — the
 * refused population being the one nobody sees. The dispatch has landed, and
 * each of them now states what the reader gets instead.
 *
 * The archive is built here rather than read from `raw/`, which is gitignored
 * (`.gitignore:117`) and therefore invisible to CI — a fixture only one laptop
 * can see is not a gate. `raw/synthetic/reject-html-format/` exists and is
 * referenced by nothing for exactly that reason.
 *
 * A Blob, not a File: `vitest/file-mock.ts` replaces `global.File` with a
 * string-backed stub, so `new File([blob], 'x.zip')` would hand the reader the
 * twelve characters of "[object Blob]". Same shim as
 * `instagram-zip-failures.test.ts`, and for the same reason.
 */
const asFile = (blob: Blob) => blob as File;

const BASE = 'connections/followers_and_following';

/**
 * One record in the grammar Meta actually ships, reproduced class for class.
 *
 * Taken from `raw/real/2026-08-25-en-html-sxQFBjYF` and verified against the
 * March 2026 and the Spanish and Japanese exports of the same day. The class
 * names are the load-bearing part and they are byte-identical across five
 * months and three locales; the handles here are synthetic, because the real
 * ones are real people's and must never reach a committed file.
 *
 * `withProfileHref` is the difference between the two shapes, and it is the
 * whole reason a transcoder can be written without a per-file branch:
 * `following.html` writes `instagram.com/_u/NAME` and carries an `<h2>`, while
 * `followers_1.html` writes `instagram.com/NAME` and has no `<h2>` at all.
 * Keyed on the href, the two are one grammar; keyed on the anchor text, they
 * are two.
 */
function record(username: string, date: string, withProfileHref: boolean): string {
  const href = withProfileHref
    ? `https://www.instagram.com/_u/${username}`
    : `https://www.instagram.com/${username}`;
  const heading = withProfileHref ? `<h2 class="_3-95 _2pim _a6-h _a6-i">${username}</h2>` : '';
  const anchorText = withProfileHref ? href : username;

  return (
    `<div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">${heading}` +
    `<div class="_a6-p"><div><div>` +
    `<a target="_blank" href="${href}">${anchorText}</a></div>` +
    `<div>${date}</div></div></div></div>`
  );
}

/**
 * One optional-file record, in the third grammar: a table of label/value rows
 * with the date in a trailing div.
 *
 * Nested exactly as Meta nests it — an outer record wrapper holding an inner
 * one — because that nesting is what makes one outermost wrapper equal one
 * record in BOTH grammars, so a record count is a record count in either.
 *
 * It is NOT what tells an empty file from a drifted one; that was the claim
 * until 2026-08-28 and it was wrong in the direction that hurts. Both come back
 * with zero wrappers, and the transcoder separates them by the record payload
 * left lying outside every wrapper — see `instagram-html.ts`, `readRecords`.
 */
function tableRecord(name: string, username: string, date: string): string {
  return (
    `<div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">` +
    `<div class="_3-95 _a6-p"><div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">` +
    `<div class="_a6-p"><table style="table-layout: fixed;">` +
    `<tr><td class="_a6_q">Name</td><td class="_2piu _a6_r">${name}</td></tr>` +
    `<tr><td class="_a6_q">Username</td><td class="_2piu _a6_r">${username}</td></tr>` +
    `</table></div></div></div>` +
    `<div class="_3-94 _a6-o">${date}</div></div>`
  );
}

/** The document wrapper, reduced to the two elements every real file carries. */
function htmlDocument(title: string, body: string): string {
  return (
    `<html><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />` +
    `<base href="../../" /></head><body><div class="_a705">` +
    `<header><h1 id="u_0_2_Ii">${title}</h1></header>` +
    `<main class="_a706" role="main">${body}</main></div></body></html>`
  );
}

const followingHtml = htmlDocument(
  'Following',
  record('alpha', 'Aug 10, 2026 6:32 pm', true) + record('bravo', 'Aug 01, 2026 3:40 pm', true)
);

const followersHtml = htmlDocument(
  'Followers',
  record('bravo', 'Aug 01, 2026 3:06 pm', false) + record('charlie', 'Jul 28, 2026 11:30 am', false)
);

/** An HTML export as Meta ships it: relationship files, and not one `.json`. */
async function buildHtmlExport(extra?: Record<string, string>): Promise<Blob> {
  const zip = new JSZip();
  zip.file('start_here.html', htmlDocument('Your Instagram activity', ''));
  zip.file(`${BASE}/following.html`, followingHtml);
  zip.file(`${BASE}/followers_1.html`, followersHtml);
  for (const [path, content] of Object.entries(extra ?? {})) zip.file(path, content);
  return zip.generateAsync({ type: 'blob' });
}

describe('an Instagram export downloaded in HTML format', () => {
  it('is read, not refused', async () => {
    // The whole point of the feature. `upload_error_html_format` was 53.4% of
    // every upload error on the site and 60.2% of the sessions that hit it
    // never succeeded at all — for an archive holding the same people, in the
    // same order, with the same dates, written in different markup.
    const result = await parseInstagramZipFile(asFile(await buildHtmlExport()));

    expect(result.warnings.filter(w => w.severity === 'error')).toEqual([]);
    expect(result.hasMinimalData).toBe(true);
    expect([...result.data.following].sort()).toEqual(['alpha', 'bravo']);
    expect([...result.data.followers].sort()).toEqual(['bravo', 'charlie']);
  });

  it('still says which format it was, because that is a fact about the archive', async () => {
    // `format` stops choosing an error message and starts describing what was
    // read. It must keep being reported: `FileDiscovery` is what the diagnostic
    // screen and the upload analytics are built on.
    const result = await parseInstagramZipFile(asFile(await buildHtmlExport()));

    expect(result.discovery?.isInstagramExport).toBe(true);
    expect(result.discovery?.format).toBe('html');
  });

  it('carries the dates through, so the skew detector can still judge', async () => {
    // An HTML export used to reach `detectRelationshipSkew` with nothing to
    // compare, and the honest degradation for that was `insufficient-data`.
    // Dates read from localised human text are what let it reach a real
    // verdict instead.
    //
    // Twelve records per list, not two: `MIN_TIMESTAMPS_FOR_SKEW` is 10, so a
    // smaller archive answers `insufficient-data` whether or not the dates were
    // read — an assertion over it would pass on a reader that carried no dates
    // at all, which is exactly the state this test exists to rule out.
    const many = (n: number, withHref: boolean) =>
      Array.from({ length: n }, (_, i) =>
        record(
          `user${String(i).padStart(2, '0')}`,
          `Aug ${String(i + 1).padStart(2, '0')}, 2026 6:32 pm`,
          withHref
        )
      ).join('');

    const zip = new JSZip();
    zip.file(`${BASE}/following.html`, htmlDocument('Following', many(12, true)));
    zip.file(`${BASE}/followers_1.html`, htmlDocument('Followers', many(12, false)));
    const result = await parseInstagramZipFile(asFile(await zip.generateAsync({ type: 'blob' })));

    expect(result.truncatedRelationshipFile).toBe('no-skew');
    expect([...result.data.followingTimestamps.values()].every(t => t > 0)).toBe(true);
  });

  it('reads the optional files too, so notFollowingBack is not inflated', async () => {
    // The correctness stake, and the one a set of followers cannot show.
    // `pending_follow_requests` is SUBTRACTED from `following` to compute the
    // app's most-used badge. Left unread it does not empty that badge, it
    // inflates it — and it would do so in silence if an unread file and an
    // empty one were the same empty array. The test below this one is the pair
    // to this one: it makes sure they are not.
    const result = await parseInstagramZipFile(
      asFile(
        await buildHtmlExport({
          [`${BASE}/pending_follow_requests.html`]: htmlDocument(
            'Pending follow requests',
            tableRecord('Alpha Person', 'alpha', 'Aug 09, 2026 1:15 pm')
          ),
        })
      )
    );

    expect([...result.data.pendingSent.keys()]).toEqual(['alpha']);
    expect(result.followRequestsUnreadable).toBe(false);
  });

  it('reports an optional file it cannot read rather than calling it empty', async () => {
    // The other half of the same stake. A grammar this reader does not know
    // must not come back as "you have no pending requests" — that is the same
    // wrong badge with none of the warning.
    const result = await parseInstagramZipFile(
      asFile(
        await buildHtmlExport({
          [`${BASE}/pending_follow_requests.html`]: htmlDocument(
            'Pending follow requests',
            '<div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder"><p>something new</p></div>'
          ),
        })
      )
    );

    expect(result.followRequestsUnreadable).toBe(true);
  });

  it('reports an optional file whose WRAPPER moved, not just its contents', async () => {
    // One layer out from the test above, and the layer that used to be silent.
    // There the wrapper was found and its contents were not understood, so the
    // record was counted as unresolved. Here the wrapper class itself moves, so
    // the file yields no records at all — and zero records used to be the same
    // empty array a user with no pending requests produces. GH#41 exactly:
    // nothing subtracted from `following`, `notFollowingBack` inflated by every
    // request the file held, `followRequestsUnreadable` false.
    const drifted = htmlDocument(
      'Pending follow requests',
      tableRecord('Alpha Person', 'alpha', 'Aug 09, 2026 1:15 pm')
    )
      .split('uiBoxWhite')
      .join('uiBoxSnow');

    const result = await parseInstagramZipFile(
      asFile(await buildHtmlExport({ [`${BASE}/pending_follow_requests.html`]: drifted }))
    );

    expect(result.followRequestsUnreadable).toBe(true);
    expect([...result.data.pendingSent.keys()]).toEqual([]);
  });

  it('raises an error when a REQUIRED file\u2019s wrapper moved, not an empty-list notice', async () => {
    // The same drift on `followers_1.html`. The reader found the file, read no
    // records, and the archive still had a following list — so the parse
    // "succeeded" with an account that follows 2 people and is followed by
    // nobody, carrying an informational EMPTY_FOLLOWERS notice that neither
    // screen renders (both filter `severity === 'error'`). Every one of those
    // 2 followers would have been accused of not following back.
    const zip = new JSZip();
    zip.file('start_here.html', htmlDocument('Your Instagram activity', ''));
    zip.file(`${BASE}/following.html`, followingHtml);
    zip.file(`${BASE}/followers_1.html`, followersHtml.split('uiBoxWhite').join('uiBoxSnow'));

    const result = await parseInstagramZipFile(asFile(await zip.generateAsync({ type: 'blob' })));

    expect(result.warnings.map(w => w.code)).toContain('INVALID_FOLLOWERS_FORMAT');
    expect(result.warnings.some(w => w.severity === 'error')).toBe(true);
  });
});

describe('an archive that is not an Instagram export at all', () => {
  it('is told what it actually is, not to go and pick JSON', async () => {
    // `createCriticalError` used to test the format before it asked whether the
    // archive was an Instagram export, so ANY ZIP of `.html` — a saved web
    // page, a report, anything — was told to re-request its data from
    // Instagram in JSON. Advice that cannot help, for a problem the reader does
    // not have.
    //
    // It also cost a measurement. Every such upload landed in the
    // `upload_error_html_format` bucket, which is why that bucket's 2 276
    // events are an UPPER bound on "users who chose HTML" rather than a count
    // of them, and why the sizing derived from it is an upper bound too.
    // Nothing separated the two populations before this ordering.
    const zip = new JSZip();
    zip.file('index.html', '<html><body>not instagram</body></html>');
    zip.file('about/team.html', '<html><body>still not</body></html>');

    const result = await parseInstagramZipFile(asFile(await zip.generateAsync({ type: 'blob' })));

    expect(result.discovery?.isInstagramExport).toBe(false);
    expect(result.warnings.find(w => w.severity === 'error')?.code).toBe('NOT_INSTAGRAM_EXPORT');
  });
});

describe('an archive holding both formats', () => {
  it('takes its format from the relationship files, not from a stray one', async () => {
    // `hasJsonFiles` — the field `ZipAnalysis` carried on `main`, before
    // `format` replaced it — was an `endsWith` over every entry name with no content
    // inspection, so a single unrelated `.json` anywhere used to outvote every
    // HTML relationship file in the archive: the export resolved to 'json',
    // found no relationship data, and reported a code the reader could not act
    // on instead of the one they could.
    //
    // Harmless on genuine archives — measured, a real JSON export is 9 files
    // and 100% `.json`, a real HTML export is 10 `.html` plus one `.png`, and
    // neither mixes. It bites a re-zipped or partially merged one, and it
    // becomes reachable in general the moment reject becomes dispatch, because
    // then this predicate chooses a PARSER rather than an error code.
    const result = await parseInstagramZipFile(
      asFile(
        await buildHtmlExport({
          'personal_information/personal_information.json': '{"profile_user":[]}',
        })
      )
    );

    expect(result.discovery?.format).toBe('html');
    expect(result.hasMinimalData).toBe(true);
  });

  it('does not mistake a JSON export for HTML because of one stray page', async () => {
    // The mirror, and the reason the fix keys on relationship files rather than
    // simply flipping which extension wins. An export whose relationship files
    // are JSON is a JSON export, whatever else somebody put in the archive.
    const zip = new JSZip();
    zip.file(`${BASE}/following.json`, JSON.stringify({ relationships_following: [] }));
    zip.file(`${BASE}/followers_1.json`, JSON.stringify([]));
    zip.file('start_here.html', '<html><body>a page</body></html>');

    const result = await parseInstagramZipFile(asFile(await zip.generateAsync({ type: 'blob' })));

    expect(result.discovery?.format).toBe('json');
    expect(result.warnings.find(w => w.severity === 'error')?.code).not.toBe('HTML_FORMAT');
  });

  /**
   * The twin pair, pinned. `following.json` and `following.html` are the same
   * file written twice, and so are `followers_1.json` and `followers_1.html`.
   *
   * `following` has always read one of them — first existing, JSON first.
   * `followers` did not: both twins match the shard glob, so both were read and
   * their accounts unioned. Identical twins made that invisible, and two
   * exports taken weeks apart made it a wrong answer with no warning — the
   * stale followers deflate `notFollowingBack` and inflate `mutuals`.
   *
   * So the twins here hold DIFFERENT people. A union would be detectable in no
   * other way, and asserting on identical content would pass on either rule.
   */
  it('reads one file per twin pair, the same way for both required files', async () => {
    const zip = new JSZip();
    zip.file(`${BASE}/following.json`, JSON.stringify({ relationships_following: [] }));
    zip.file(
      `${BASE}/following.html`,
      htmlDocument('Following', record('ghost', 'Aug 10, 2026 6:32 pm', true))
    );
    zip.file(
      `${BASE}/followers_1.json`,
      JSON.stringify([{ title: '', string_list_data: [{ value: 'kept', href: '', timestamp: 1 }] }])
    );
    zip.file(
      `${BASE}/followers_1.html`,
      htmlDocument('Followers', record('stale', 'Jul 28, 2026 11:30 am', false))
    );

    const result = await parseInstagramZipFile(asFile(await zip.generateAsync({ type: 'blob' })));

    expect([...result.data.followers]).toEqual(['kept']);
    expect([...result.data.following]).toEqual([]);
  });
});

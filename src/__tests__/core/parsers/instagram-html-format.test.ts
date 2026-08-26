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
 * **These are characterization tests, not specifications.** They pin what the
 * predicate does today. That is the point: `instagram-zip-analysis.ts:21-22`
 * decides format by file extension alone, and the plan of record turns that
 * rejection into a dispatch so an HTML archive is parsed rather than refused.
 * A rewrite with no test underneath it would silently change which uploads are
 * refused, and the refused population is the one nobody sees.
 *
 * Two of the four cases below record behaviour that is arguably wrong. They are
 * written as `it` rather than `it.fails` because they are what ships, and the
 * comments say which way they should move.
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
  it('is refused with the code that names the format, not a generic failure', async () => {
    const result = await parseInstagramZipFile(asFile(await buildHtmlExport()));

    expect(result.hasMinimalData).toBe(false);
    expect(result.warnings.find(w => w.severity === 'error')?.code).toBe('HTML_FORMAT');
  });

  it('is recognised as an Instagram export, so the advice is about the format', async () => {
    // The distinction the reader acts on. `createCriticalError` would otherwise
    // reach NOT_INSTAGRAM_EXPORT, whose fix tells them to download their data —
    // which they already did. Only HTML_FORMAT tells them the one thing that
    // resolves it: pick JSON in Meta's dialog.
    const result = await parseInstagramZipFile(asFile(await buildHtmlExport()));

    expect(result.discovery?.isInstagramExport).toBe(true);
    expect(result.discovery?.format).toBe('html');
  });

  it('lists the .html entries even though none of them can be read', async () => {
    // Why the predicate can see HTML at all: `openZipArchive` pushes every
    // entry name (`zip-archive.ts:161`) *before* applying the `keep` filter
    // (`:165`), and `RELEVANT_FILE_PATTERN` matches `.json` only
    // (`instagram-file-specs.ts:218-221`). So names are complete and readable
    // objects are not.
    //
    // This is the invariant the dispatch will rest on, which is why it is
    // pinned separately from the code assertion above: if `names` ever became
    // post-filter, `hasHtmlFiles` would be false for every archive, HTML_FORMAT
    // would silently stop firing, and 1 293 sessions a month would fall through
    // to a less useful error instead.
    const result = await parseInstagramZipFile(asFile(await buildHtmlExport()));

    expect(result.discovery?.format).toBe('html');
    expect(result.warnings.find(w => w.severity === 'error')?.code).toBe('HTML_FORMAT');
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
    // `hasJsonFiles` is an `endsWith` over every entry name with no content
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
    expect(result.warnings.find(w => w.severity === 'error')?.code).toBe('HTML_FORMAT');
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
});

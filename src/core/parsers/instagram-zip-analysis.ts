/**
 * Instagram ZIP Structure Analysis
 * Detects format and provides diagnostic information
 */

import type { FileDiscovery, ParseWarning, RelationshipFormat } from '@/core/types';
import { RELATIONSHIP_EXTENSIONS, relationshipFormatOf } from './instagram-file-specs';

export interface ZipAnalysis {
  hasConnections: boolean;
  hasFollowersFolder: boolean;
  basePath: string | undefined;
  topLevelFolders: string[];
  /**
   * Which format this export is written in, decided once and here.
   *
   * Derived rather than recomputed by each caller: it was read off
   * `hasJsonFiles`/`hasHtmlFiles` in two places with the same nested ternary,
   * and two copies of a rule are two rules as soon as one of them is fixed.
   */
  format: FileDiscovery['format'];
  /**
   * Whether this archive is an Instagram export at all, decided once and here.
   *
   * Derived for the same reason `format` is, and it became load-bearing with
   * the same change: `createCriticalError` now asks this question BEFORE it
   * names a format, which is what keeps an arbitrary ZIP of `.html` out of the
   * `HTML_FORMAT` bucket. That fix holds only while the two readers agree, and
   * they were two hand-written expressions in two files — one the negation of
   * the other. Widen the test in one and the contamination returns silently, in
   * the very metric the HTML work is justified by.
   */
  isInstagramExport: boolean;
}

/**
 * `following.json` / `followers_3.html` and the like, anywhere in the archive.
 *
 * These two files are what the format question is actually about — they are the
 * only ones any answer is computed from — so they are what decides it. Matched
 * on the whole name after the last slash so that a `following.json.bak` or a
 * `my-following.json` cannot vote.
 */
const RELATIONSHIP_FILE = new RegExp(
  `(?:^|/)(?:following|followers_\\d+)\\.(?<ext>${RELATIONSHIP_EXTENSIONS})$`,
  'i'
);

/**
 * Analyze ZIP file structure to determine format and validity
 */
export function analyzeZipStructure(allFiles: string[]): ZipAnalysis {
  const hasHtmlFiles = allFiles.some(f => f.endsWith('.html'));
  const hasJsonFiles = allFiles.some(f => f.endsWith('.json'));
  const hasConnections = allFiles.some(f => f.includes('connections/'));
  const hasFollowersFolder = allFiles.some(f => f.includes('followers_and_following'));

  // The format of the relationship files themselves, when the archive has any.
  //
  // The extension counts above are a vote over EVERY entry, so one unrelated
  // `.json` next to a full set of HTML relationship files used to make the
  // whole archive "json" — it then found no relationship data and reported a
  // code the reader could not act on, instead of the one they could. On a
  // genuine archive the two agree and always have: measured, a real JSON export
  // is nine files and 100% `.json`, a real HTML export is ten `.html` plus one
  // `.png`, and neither format mixes. This only changes the answer where the
  // old one was wrong.
  //
  // It matters more from here on than it did: once HTML is parsed rather than
  // refused, this predicate stops choosing an error message and starts choosing
  // a parser.
  // A set of the formats actually seen, rather than "json, else html". The
  // `else` decided what every non-JSON extension is, so it answered for
  // extensions nobody has added yet — and would have answered wrongly and
  // silently. `relationshipFormatOf` reads the name instead of assuming.
  const relationshipFormats = new Set<RelationshipFormat>();
  for (const name of allFiles) {
    if (!RELATIONSHIP_FILE.test(name)) continue;
    const format = relationshipFormatOf(name);
    if (format !== null) relationshipFormats.add(format);
  }

  // The relationship files decide; the archive-wide extension counts are the
  // fallback for an archive that has no relationship file at all, where the old
  // answer is still the best available one and is what every existing
  // diagnostic was written against. Written as two applications of one rule
  // rather than four guards in a row, so that the two-tier priority is the
  // shape of the expression instead of a note about the order of the tests.
  const format =
    pickFormat(relationshipFormats.has('json'), relationshipFormats.has('html')) ??
    pickFormat(hasJsonFiles, hasHtmlFiles) ??
    'unknown';

  // Determine base path
  let basePath: string | undefined;
  if (allFiles.some(f => f.startsWith('connections/followers_and_following/'))) {
    basePath = 'connections/followers_and_following';
  } else if (allFiles.some(f => f.startsWith('followers_and_following/'))) {
    basePath = 'followers_and_following';
  }

  const topLevelFolders = [
    ...new Set(allFiles.map(f => f.split('/')[0]).filter((f): f is string => Boolean(f))),
  ].slice(0, 5);

  return {
    hasConnections,
    hasFollowersFolder,
    basePath,
    topLevelFolders,
    format,
    isInstagramExport: hasConnections || hasFollowersFolder,
  };
}

/**
 * One evidence source's verdict, or `null` when it has nothing to say.
 *
 * JSON wins a genuinely mixed set: it is the format this tool has always read,
 * so a half-merged archive degrades to today's behaviour rather than to a newer
 * path. `null` rather than `'unknown'` so the caller can fall through to the
 * next source — `'unknown'` is an answer, and only the last source may give it.
 */
function pickFormat(json: boolean, html: boolean): 'json' | 'html' | null {
  if (json) return 'json';
  if (html) return 'html';
  return null;
}

/**
 * Create detailed error message based on ZIP analysis
 */
export function createCriticalError(analysis: ZipAnalysis): ParseWarning {
  // "Is this one of ours?" before "is it the right format?", and the order is
  // the whole point of these two blocks.
  //
  // The HTML test used to come first, and it asks only about file extensions —
  // so ANY ZIP of `.html`, a saved web page or a report, was told to re-request
  // its data from Instagram in JSON. Advice that cannot help, for a problem the
  // reader does not have. It also put every one of those uploads in the
  // `upload_error_html_format` bucket, which is why that bucket's 2 276 events
  // in the 30 days to 2026-08-25 are an upper bound on "chose the wrong format"
  // rather than a count of it, and why anything sized from that number is an
  // upper bound too.
  if (!analysis.isInstagramExport) {
    return {
      code: 'NOT_INSTAGRAM_EXPORT',
      message: "This doesn't appear to be an Instagram data export.",
      severity: 'error',
      fix: `Found folders: ${analysis.topLevelFolders.join(', ') || 'none'}. Please download your data from Instagram Settings › Download Your Data › Select JSON format › Include "Followers and following".`,
    };
  }

  // Reached only for something that IS an Instagram export, so naming the
  // format is now a statement about this reader's archive rather than a guess
  // about an unknown one.
  if (analysis.format === 'html') {
    return {
      code: 'HTML_FORMAT',
      message: 'Wrong format: You uploaded HTML format, but JSON is required.',
      severity: 'error',
      fix: 'Re-request your data from Instagram and select JSON format instead of HTML. Go to Settings › Meta Accounts Center › Your information and permissions › Download your information › Select JSON format.',
    };
  }

  if (analysis.hasConnections && !analysis.hasFollowersFolder) {
    return {
      code: 'INCOMPLETE_EXPORT',
      message: 'The export is missing the followers_and_following folder.',
      severity: 'error',
      fix: 'Re-request your data and make sure to select "Followers and following" option in the data types.',
    };
  }

  return {
    code: 'NO_DATA_FILES',
    message: 'Could not find following.json or followers files.',
    severity: 'error',
    fix: `Expected files under ${analysis.basePath || 'connections/followers_and_following'}. Found top-level: ${analysis.topLevelFolders.join(', ') || 'none'}.`,
  };
}

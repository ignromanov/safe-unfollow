/**
 * Instagram ZIP Structure Analysis
 * Detects format and provides diagnostic information
 */

import type { ParseWarning } from '@/core/types';

export interface ZipAnalysis {
  hasHtmlFiles: boolean;
  hasJsonFiles: boolean;
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
  format: 'json' | 'html' | 'unknown';
}

/**
 * `following.json` / `followers_3.html` and the like, anywhere in the archive.
 *
 * These two files are what the format question is actually about — they are the
 * only ones any answer is computed from — so they are what decides it. Matched
 * on the whole name after the last slash so that a `following.json.bak` or a
 * `my-following.json` cannot vote.
 */
const RELATIONSHIP_FILE = /(^|\/)(following|followers_\d+)\.(json|html)$/i;

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
  let relationshipJson = false;
  let relationshipHtml = false;
  for (const name of allFiles) {
    const match = RELATIONSHIP_FILE.exec(name);
    if (!match) continue;
    if (match[3]?.toLowerCase() === 'json') relationshipJson = true;
    else relationshipHtml = true;
  }

  const format = resolveFormat({
    relationshipJson,
    relationshipHtml,
    hasJsonFiles,
    hasHtmlFiles,
  });

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
    hasHtmlFiles,
    hasJsonFiles,
    hasConnections,
    hasFollowersFolder,
    basePath,
    topLevelFolders,
    format,
  };
}

/**
 * The relationship files decide; the archive-wide extension counts are the
 * fallback for an archive that has no relationship file at all, where the old
 * answer is still the best available one and is what every existing diagnostic
 * was written against.
 *
 * Written as guard clauses rather than a ternary chain because there are four
 * of them and a nested ternary of that depth is the shape this project's style
 * rules forbid, for the reason on display here: the order of the tests IS the
 * rule, and it has to be readable to be reviewable.
 */
function resolveFormat({
  relationshipJson,
  relationshipHtml,
  hasJsonFiles,
  hasHtmlFiles,
}: {
  relationshipJson: boolean;
  relationshipHtml: boolean;
  hasJsonFiles: boolean;
  hasHtmlFiles: boolean;
}): ZipAnalysis['format'] {
  // JSON wins a genuinely mixed set of relationship files: it is the format
  // this tool has always read, so a half-merged archive degrades to today's
  // behaviour rather than to a newer path.
  if (relationshipJson) return 'json';
  if (relationshipHtml) return 'html';
  if (hasJsonFiles) return 'json';
  if (hasHtmlFiles) return 'html';
  return 'unknown';
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
  if (!analysis.hasConnections && !analysis.hasFollowersFolder) {
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

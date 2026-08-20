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
}

/**
 * Analyze ZIP file structure to determine format and validity
 */
export function analyzeZipStructure(allFiles: string[]): ZipAnalysis {
  const hasHtmlFiles = allFiles.some(f => f.endsWith('.html'));
  const hasJsonFiles = allFiles.some(f => f.endsWith('.json'));
  const hasConnections = allFiles.some(f => f.includes('connections/'));
  const hasFollowersFolder = allFiles.some(f => f.includes('followers_and_following'));

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
  };
}

/**
 * Create detailed error message based on ZIP analysis
 */
export function createCriticalError(analysis: ZipAnalysis): ParseWarning {
  if (analysis.hasHtmlFiles && !analysis.hasJsonFiles) {
    return {
      code: 'HTML_FORMAT',
      message: 'Wrong format: You uploaded HTML format, but JSON is required.',
      severity: 'error',
      fix: 'Re-request your data from Instagram and select JSON format instead of HTML. Go to Settings › Meta Accounts Center › Your information and permissions › Download your information › Select JSON format.',
    };
  }

  if (!analysis.hasConnections && !analysis.hasFollowersFolder) {
    return {
      code: 'NOT_INSTAGRAM_EXPORT',
      message: "This doesn't appear to be an Instagram data export.",
      severity: 'error',
      fix: `Found folders: ${analysis.topLevelFolders.join(', ') || 'none'}. Please download your data from Instagram Settings › Download Your Data › Select JSON format › Include "Followers and following".`,
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

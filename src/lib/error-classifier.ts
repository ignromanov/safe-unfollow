/**
 * Error Classifier
 *
 * Classifies errors by message text when structured error codes are unavailable.
 * A fallback only: it reads English keywords, so it cannot classify anything
 * that has already been through i18n. Failures this app raises itself must
 * carry a `code` and reach `extractErrorCode` structured — see GH#35, where two
 * guards threw their own translated message and had it binned as UNKNOWN.
 *
 * The "82% to <5%" figure this comment used to carry was never reproduced by
 * anything in the repository and was false in production regardless: most rules
 * could not match a real message at all.
 */

import type { DiagnosticErrorCode } from '@/core/types';
import { mapWarningToDiagnosticCode } from '@/core/types';

/**
 * Pattern matching rule: keywords to error code mapping.
 *
 * The two fields exist because the rules mix two different intents, and a
 * single list evaluated one way silently kills half of them (GH#35). `anyOf`
 * holds synonyms — one is enough, because a thrower emits one of them, never
 * all. `qualifiedBy` holds words that must ALSO be present, and exists only to
 * scope an ambiguous synonym: 'crash' means WORKER_CRASHED when 'worker' is in
 * the same message and nothing in particular otherwise.
 */
interface ClassificationRule {
  anyOf: string[];
  qualifiedBy?: string;
  code: DiagnosticErrorCode;
}

/**
 * Classification rules in priority order.
 * First matching rule wins.
 *
 * Order carries meaning where two rules can both match: 'database connection
 * failed' is an INDEXEDDB_ERROR rather than a NETWORK_ERROR because the
 * IndexedDB block is listed first.
 */
const CLASSIFICATION_RULES: ClassificationRule[] = [
  // ZIP/File errors
  {
    anyOf: [
      'not a valid zip',
      'corrupted',
      'bad local file header',
      "can't find end of central directory",
      // zip.js's own wording, which shares not one keyword with JSZip's above.
      // Until these were listed, a damaged local header or an unsupported
      // compression method fell through every rule to UNKNOWN — a code that
      // is in REPORTABLE_ERROR_CODES, so the reader was pointed at the issue
      // tracker for a file they should simply download again.
      'end of central directory not found',
      'file format is not recognized',
      'split zip file',
      'local file header not found',
      'compression method not supported',
      'invalid compressed data',
    ],
    code: 'CORRUPTED_ZIP',
  },
  { anyOf: ['encrypted', 'password'], code: 'ZIP_ENCRYPTED' },
  { anyOf: ['file is empty', '0 byte'], code: 'EMPTY_FILE' },
  {
    // The first three are ours, and stopped being produced when the 500 MB
    // ceiling was deleted. The rest are what an engine says when it cannot
    // hold the file, which is what this code now describes in ten locales.
    // Only the allocation that *throws* is covered — a tab the OS kills
    // outright reaches no catch block anywhere, and nothing here claims it.
    anyOf: [
      'too large',
      'exceeds',
      'maximum size',
      'allocation failed',
      'out of memory',
      'invalid string length',
    ],
    code: 'FILE_TOO_LARGE',
  },

  // JSON errors
  { anyOf: ['unexpected token', 'syntax error', 'parse error', 'json'], code: 'JSON_PARSE_ERROR' },

  // Worker errors
  { anyOf: ['timeout', 'took too long'], code: 'WORKER_TIMEOUT' },
  { anyOf: ['init', 'create', 'start'], qualifiedBy: 'worker', code: 'WORKER_INIT_ERROR' },
  { anyOf: ['crash', 'terminate', 'died'], qualifiedBy: 'worker', code: 'WORKER_CRASHED' },

  // IndexedDB errors
  { anyOf: ['quota', 'storage full', 'quotaexceeded'], code: 'QUOTA_EXCEEDED' },
  { anyOf: ['not supported'], qualifiedBy: 'indexeddb', code: 'IDB_NOT_SUPPORTED' },
  { anyOf: ['denied', 'storage'], qualifiedBy: 'permission', code: 'IDB_PERMISSION_DENIED' },
  { anyOf: ['indexeddb', 'database', 'transaction'], code: 'INDEXEDDB_ERROR' },

  // Cancel/Abort
  { anyOf: ['cancel', 'abort'], code: 'UPLOAD_CANCELLED' },

  // Crypto
  { anyOf: ['crypto', 'subtle'], code: 'CRYPTO_NOT_AVAILABLE' },

  // Network
  { anyOf: ['network', 'fetch', 'connection'], code: 'NETWORK_ERROR' },

  // Instagram-specific (check after generic checks)
  { anyOf: ['html format', 'wrong format'], code: 'HTML_FORMAT' },
  { anyOf: ['not an instagram', 'not instagram'], code: 'NOT_INSTAGRAM_EXPORT' },
];

/**
 * Check whether a rule matches the message.
 */
function matchesRule(lower: string, rule: ClassificationRule): boolean {
  if (rule.qualifiedBy !== undefined && !lower.includes(rule.qualifiedBy)) {
    return false;
  }
  return rule.anyOf.some(keyword => lower.includes(keyword));
}

/**
 * Classifies error by message text.
 * Used as fallback when error has no structured code.
 */
export function classifyErrorMessage(message: string): DiagnosticErrorCode {
  const lower = message.toLowerCase();

  // Find first matching rule
  const matchedRule = CLASSIFICATION_RULES.find(rule => matchesRule(lower, rule));

  return matchedRule?.code ?? 'UNKNOWN';
}

/**
 * Extracts error code from structured error or classifies by text.
 */
export function extractErrorCode(error: unknown): DiagnosticErrorCode {
  // Structured error with code property
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string') {
      return mapWarningToDiagnosticCode(code);
    }
  }

  // Fallback: classify by message text
  const message = error instanceof Error ? error.message : String(error);
  return classifyErrorMessage(message);
}

import { describe, it, expect } from 'vitest';
import { classifyErrorMessage, extractErrorCode } from '@/lib/error-classifier';

describe('error-classifier', () => {
  describe('classifyErrorMessage', () => {
    describe('ZIP errors', () => {
      /**
       * GH#35 — the keyword lists are synonyms, and any one of them identifies
       * the failure. JSZip raises exactly one of these four phrases, never all
       * four in the same message, so a rule that demanded all four could not
       * fire against anything JSZip actually throws.
       */
      it.each([
        ['not a valid zip file', 'CORRUPTED_ZIP'],
        ['file appears corrupted', 'CORRUPTED_ZIP'],
        ['bad local file header', 'CORRUPTED_ZIP'],
        ["can't find end of central directory", 'CORRUPTED_ZIP'],
      ])('classifies "%s" as %s', (message, expected) => {
        expect(classifyErrorMessage(message)).toBe(expected);
      });

      it.each([
        ['encrypted file needs password', 'ZIP_ENCRYPTED'],
        ['password required for encrypted archive', 'ZIP_ENCRYPTED'],
        ['this archive is encrypted', 'ZIP_ENCRYPTED'],
      ])('classifies "%s" as %s', (message, expected) => {
        expect(classifyErrorMessage(message)).toBe(expected);
      });

      it.each([
        // EMPTY_FILE: either 'file is empty' OR '0 byte' (separate rules)
        ['file is empty', 'EMPTY_FILE'],
        ['0 byte file uploaded', 'EMPTY_FILE'],
      ])('classifies "%s" as %s', (message, expected) => {
        expect(classifyErrorMessage(message)).toBe(expected);
      });

      /**
       * GH#35 — the first row is the string this app produces, from
       * `diagnostic.errors.FILE_TOO_LARGE.message`. It was binned as UNKNOWN in
       * production for the whole measured window, because it says 'exceeds' and
       * the rule also demanded 'too large' and 'maximum size'.
       */
      it.each([
        ['File is 502MB, which exceeds the 500MB limit.', 'FILE_TOO_LARGE'],
        ['file too large', 'FILE_TOO_LARGE'],
        ['exceeds maximum size', 'FILE_TOO_LARGE'],
      ])('classifies "%s" as %s', (message, expected) => {
        expect(classifyErrorMessage(message)).toBe(expected);
      });
    });

    describe('JSON errors', () => {
      it.each([
        // JSON_PARSE_ERROR rule 1: requires 'unexpected token', 'syntax error', AND 'parse error'
        // JSON_PARSE_ERROR rule 2: just requires 'json'
        ['invalid json format', 'JSON_PARSE_ERROR'],
        ['json parsing failed', 'JSON_PARSE_ERROR'],
        ['problem with json data', 'JSON_PARSE_ERROR'],
      ])('classifies "%s" as %s', (message, expected) => {
        expect(classifyErrorMessage(message)).toBe(expected);
      });
    });

    describe('Worker errors', () => {
      it.each([
        ['timeout occurred, took too long to process', 'WORKER_TIMEOUT'],
        ['operation took too long, timeout', 'WORKER_TIMEOUT'],
        // GH#35 — either phrase alone names the same failure
        ['parse timeout', 'WORKER_TIMEOUT'],
        ['the operation took too long', 'WORKER_TIMEOUT'],
      ])('classifies "%s" as %s (timeout)', (message, expected) => {
        expect(classifyErrorMessage(message)).toBe(expected);
      });

      it.each([
        // WORKER_INIT_ERROR requires both 'worker' AND 'init'
        ['worker init failed', 'WORKER_INIT_ERROR'],
        ['init error in worker', 'WORKER_INIT_ERROR'],
        // Also: 'worker' AND 'create', 'worker' AND 'start'
        ['failed to create worker', 'WORKER_INIT_ERROR'],
        ['worker could not start', 'WORKER_INIT_ERROR'],
      ])('classifies "%s" as %s (init)', (message, expected) => {
        expect(classifyErrorMessage(message)).toBe(expected);
      });

      it.each([
        // WORKER_CRASHED requires 'worker' AND ('crash' OR 'terminate' OR 'died')
        ['worker crashed unexpectedly', 'WORKER_CRASHED'],
        ['worker terminated with error', 'WORKER_CRASHED'],
        ['worker died during processing', 'WORKER_CRASHED'],
      ])('classifies "%s" as %s (crash)', (message, expected) => {
        expect(classifyErrorMessage(message)).toBe(expected);
      });
    });

    describe('IndexedDB errors', () => {
      /**
       * GH#35 — `QuotaExceededError` is the DOMException name the browser
       * raises; it arrives on its own, never alongside the words 'quota' and
       * 'storage full' in one sentence. Demanding all three made the rule
       * unreachable from any real quota failure.
       */
      it.each([
        ['quota storage full quotaexceedederror thrown', 'QUOTA_EXCEEDED'],
        ['quota exceeded', 'QUOTA_EXCEEDED'],
        ['storage full', 'QUOTA_EXCEEDED'],
        ['quotaexceedederror', 'QUOTA_EXCEEDED'],
      ])('classifies "%s" as %s (quota)', (message, expected) => {
        expect(classifyErrorMessage(message)).toBe(expected);
      });

      it.each([
        // IDB_NOT_SUPPORTED requires both 'indexeddb' AND 'not supported'
        ['indexeddb not supported in this browser', 'IDB_NOT_SUPPORTED'],
        ['indexeddb is not supported', 'IDB_NOT_SUPPORTED'],
      ])('classifies "%s" as %s (not supported)', (message, expected) => {
        expect(classifyErrorMessage(message)).toBe(expected);
      });

      it.each([
        // IDB_PERMISSION_DENIED requires 'permission' AND 'denied' OR 'permission' AND 'storage'
        ['permission denied for storage', 'IDB_PERMISSION_DENIED'],
        ['storage permission was denied', 'IDB_PERMISSION_DENIED'],
      ])('classifies "%s" as %s (permission)', (message, expected) => {
        expect(classifyErrorMessage(message)).toBe(expected);
      });

      it.each([
        // INDEXEDDB_ERROR: 'indexeddb', 'database', or 'transaction'
        ['indexeddb error occurred', 'INDEXEDDB_ERROR'],
        ['database connection failed', 'INDEXEDDB_ERROR'],
        ['transaction aborted unexpectedly', 'INDEXEDDB_ERROR'],
      ])('classifies "%s" as %s (general)', (message, expected) => {
        expect(classifyErrorMessage(message)).toBe(expected);
      });
    });

    describe('Cancel/Abort errors', () => {
      it.each([
        // UPLOAD_CANCELLED: 'cancel' or 'abort'
        ['upload cancelled by user', 'UPLOAD_CANCELLED'],
        ['operation was cancelled', 'UPLOAD_CANCELLED'],
        ['aborted by user action', 'UPLOAD_CANCELLED'],
        ['request aborted', 'UPLOAD_CANCELLED'],
      ])('classifies "%s" as %s', (message, expected) => {
        expect(classifyErrorMessage(message)).toBe(expected);
      });
    });

    describe('Crypto errors', () => {
      it.each([
        // CRYPTO_NOT_AVAILABLE: 'crypto' or 'subtle'
        ['crypto API unavailable', 'CRYPTO_NOT_AVAILABLE'],
        ['subtle not available', 'CRYPTO_NOT_AVAILABLE'],
      ])('classifies "%s" as %s', (message, expected) => {
        expect(classifyErrorMessage(message)).toBe(expected);
      });
    });

    describe('Network errors', () => {
      it.each([
        // NETWORK_ERROR: 'network', 'fetch', or 'connection'
        ['network error during upload', 'NETWORK_ERROR'],
        ['fetch failed', 'NETWORK_ERROR'],
        ['connection refused by server', 'NETWORK_ERROR'],
      ])('classifies "%s" as %s', (message, expected) => {
        expect(classifyErrorMessage(message)).toBe(expected);
      });
    });

    describe('Instagram-specific errors', () => {
      it.each([
        ['detected html format when wrong format was uploaded', 'HTML_FORMAT'],
        ['html format detected', 'HTML_FORMAT'],
        ['wrong format uploaded', 'HTML_FORMAT'],
      ])('classifies "%s" as %s (html format)', (message, expected) => {
        expect(classifyErrorMessage(message)).toBe(expected);
      });

      /**
       * GH#35 — 'not an instagram' and 'not instagram' are two spellings of one
       * phrase, and no string contains both: "not an instagram" does not have
       * "not instagram" as a substring. Requiring both made the rule matchable
       * only by a sentence written to satisfy it.
       */
      it.each([
        ['this is not an instagram export and not instagram data', 'NOT_INSTAGRAM_EXPORT'],
        ['not an instagram export', 'NOT_INSTAGRAM_EXPORT'],
        ['this is not instagram data', 'NOT_INSTAGRAM_EXPORT'],
      ])('classifies "%s" as %s (not instagram)', (message, expected) => {
        expect(classifyErrorMessage(message)).toBe(expected);
      });
    });

    describe('Fallback behavior', () => {
      it('returns UNKNOWN for unrecognized messages', () => {
        expect(classifyErrorMessage('some completely random error')).toBe('UNKNOWN');
        expect(classifyErrorMessage('xyz123 unknown issue')).toBe('UNKNOWN');
      });

      it('returns UNKNOWN for empty string', () => {
        expect(classifyErrorMessage('')).toBe('UNKNOWN');
      });

      it('is case-insensitive', () => {
        // Using messages that match single-keyword rules
        expect(classifyErrorMessage('NETWORK ERROR')).toBe('NETWORK_ERROR');
        expect(classifyErrorMessage('DATABASE failure')).toBe('INDEXEDDB_ERROR');
        expect(classifyErrorMessage('FILE IS EMPTY')).toBe('EMPTY_FILE');
      });
    });

    describe('rule priority', () => {
      it('prioritizes specific rules over generic ones', () => {
        // "indexeddb not supported" should match IDB_NOT_SUPPORTED, not INDEXEDDB_ERROR
        expect(classifyErrorMessage('indexeddb not supported')).toBe('IDB_NOT_SUPPORTED');

        // "worker init failed" should match WORKER_INIT_ERROR
        expect(classifyErrorMessage('worker init error')).toBe('WORKER_INIT_ERROR');
      });

      it('matches generic rules when specific ones do not apply', () => {
        // Generic 'indexeddb' rule matches simple indexeddb errors
        expect(classifyErrorMessage('indexeddb failed')).toBe('INDEXEDDB_ERROR');

        // Generic 'database' rule also matches
        expect(classifyErrorMessage('database connection lost')).toBe('INDEXEDDB_ERROR');
      });
    });

    describe('multi-keyword rules', () => {
      it('requires ALL keywords to match for multi-keyword rules', () => {
        // "worker" alone shouldn't match WORKER_INIT_ERROR (needs "worker" AND "init")
        expect(classifyErrorMessage('worker error')).toBe('UNKNOWN');

        // Both keywords present
        expect(classifyErrorMessage('worker init error')).toBe('WORKER_INIT_ERROR');
      });

      it('matches multi-keyword rules regardless of word order', () => {
        expect(classifyErrorMessage('init failed for worker')).toBe('WORKER_INIT_ERROR');
        expect(classifyErrorMessage('permission storage denied')).toBe('IDB_PERMISSION_DENIED');
      });
    });
  });

  describe('extractErrorCode', () => {
    describe('structured errors with code property', () => {
      it('extracts code from object with valid code', () => {
        const error = { code: 'NOT_ZIP', message: 'test error' };
        expect(extractErrorCode(error)).toBe('NOT_ZIP');
      });

      it('extracts code for all valid DiagnosticErrorCodes', () => {
        const validCodes = [
          'NOT_ZIP',
          'HTML_FORMAT',
          'NOT_INSTAGRAM_EXPORT',
          'INCOMPLETE_EXPORT',
          'NO_DATA_FILES',
          'MISSING_FOLLOWING',
          'MISSING_FOLLOWERS',
          'CORRUPTED_ZIP',
          'ZIP_ENCRYPTED',
          'EMPTY_FILE',
          'FILE_TOO_LARGE',
          'JSON_PARSE_ERROR',
          'INVALID_DATA_STRUCTURE',
          'WORKER_TIMEOUT',
          'WORKER_INIT_ERROR',
          'WORKER_CRASHED',
          'INDEXEDDB_ERROR',
          'QUOTA_EXCEEDED',
          'IDB_NOT_SUPPORTED',
          'IDB_PERMISSION_DENIED',
          'UPLOAD_CANCELLED',
          'CRYPTO_NOT_AVAILABLE',
          'NETWORK_ERROR',
        ];

        validCodes.forEach(code => {
          const error = { code, message: 'test' };
          expect(extractErrorCode(error)).toBe(code);
        });
      });

      it('returns UNKNOWN for invalid code property', () => {
        const error = { code: 'INVALID_CODE_XYZ', message: 'test' };
        expect(extractErrorCode(error)).toBe('UNKNOWN');
      });

      it('handles non-string code property by falling back to String(error)', () => {
        // When code is not a string, it falls through to the fallback
        // The fallback uses String(error) for non-Error objects, which gives "[object Object]"
        // This doesn't match any rule, so returns UNKNOWN
        const error = { code: 123, message: 'network error' };
        expect(extractErrorCode(error)).toBe('UNKNOWN');
      });
    });

    describe('Error instances', () => {
      it('classifies Error by message when no code', () => {
        // Use a message that matches a single-keyword rule
        const error = new Error('network connection failed');
        expect(extractErrorCode(error)).toBe('NETWORK_ERROR');
      });

      it('classifies Error with database message', () => {
        const error = new Error('database error occurred');
        expect(extractErrorCode(error)).toBe('INDEXEDDB_ERROR');
      });

      it('returns UNKNOWN for Error with unrecognized message', () => {
        const error = new Error('Something went wrong');
        expect(extractErrorCode(error)).toBe('UNKNOWN');
      });
    });

    describe('non-Error values', () => {
      it('classifies string errors by content', () => {
        // String values are passed directly to classifyErrorMessage
        // Use messages that match single-keyword rules
        expect(extractErrorCode('network error')).toBe('NETWORK_ERROR');
        expect(extractErrorCode('database failure')).toBe('INDEXEDDB_ERROR');
        expect(extractErrorCode('random string')).toBe('UNKNOWN');
      });

      it('returns UNKNOWN for null', () => {
        expect(extractErrorCode(null)).toBe('UNKNOWN');
      });

      it('returns UNKNOWN for undefined', () => {
        expect(extractErrorCode(undefined)).toBe('UNKNOWN');
      });

      it('returns UNKNOWN for number', () => {
        expect(extractErrorCode(42)).toBe('UNKNOWN');
      });

      it('returns UNKNOWN for boolean', () => {
        expect(extractErrorCode(true)).toBe('UNKNOWN');
        expect(extractErrorCode(false)).toBe('UNKNOWN');
      });

      it('handles object without code by converting to string', () => {
        const obj = { message: 'timeout error' };
        // String(obj) = "[object Object]", which doesn't match anything
        expect(extractErrorCode(obj)).toBe('UNKNOWN');
      });
    });

    describe('edge cases', () => {
      it('handles empty Error message', () => {
        const error = new Error('');
        expect(extractErrorCode(error)).toBe('UNKNOWN');
      });

      it('handles object with empty code', () => {
        const error = { code: '', message: 'test' };
        expect(extractErrorCode(error)).toBe('UNKNOWN');
      });

      it('prefers code property over message classification', () => {
        // Even if message contains "corrupted", the code takes precedence
        const error = { code: 'QUOTA_EXCEEDED', message: 'corrupted file error' };
        expect(extractErrorCode(error)).toBe('QUOTA_EXCEEDED');
      });
    });
  });
});

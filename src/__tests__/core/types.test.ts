import { describe, it, expect } from 'vitest';
import { createUploadState, mapWarningToDiagnosticCode, createDiagnosticError } from '@/core/types';

describe('UploadState Factory', () => {
  describe('createUploadState', () => {
    it('should create idle state', () => {
      const state = createUploadState('idle', null, null);

      expect(state).toEqual({
        status: 'idle',
        error: null,
        fileName: null,
      });
    });

    it('should create loading state with fileName', () => {
      const state = createUploadState('loading', 'test.zip', null);

      expect(state).toEqual({
        status: 'loading',
        error: null,
        fileName: 'test.zip',
      });
    });

    it('should create loading state with empty string if fileName is null', () => {
      const state = createUploadState('loading', null, null);

      expect(state).toEqual({
        status: 'loading',
        error: null,
        fileName: '',
      });
    });

    it('should create success state', () => {
      const state = createUploadState('success', 'test.zip', null);

      expect(state).toEqual({
        status: 'success',
        error: null,
        fileName: 'test.zip',
      });
    });

    it('should create success state with empty string if fileName is null', () => {
      const state = createUploadState('success', null, null);

      expect(state).toEqual({
        status: 'success',
        error: null,
        fileName: '',
      });
    });

    it('should create error state with message', () => {
      const state = createUploadState('error', 'test.zip', 'Invalid file');

      expect(state).toEqual({
        status: 'error',
        error: 'Invalid file',
        fileName: 'test.zip',
      });
    });

    it('should create error state with null fileName', () => {
      const state = createUploadState('error', null, 'Invalid file');

      expect(state).toEqual({
        status: 'error',
        error: 'Invalid file',
        fileName: null,
      });
    });

    it('should use default error message if null', () => {
      const state = createUploadState('error', null, null);

      expect(state).toEqual({
        status: 'error',
        error: 'Unknown error',
        fileName: null,
      });
    });
  });
});

describe('Diagnostic Error Mapping', () => {
  describe('mapWarningToDiagnosticCode', () => {
    it('should map known warning codes', () => {
      expect(mapWarningToDiagnosticCode('HTML_FORMAT')).toBe('HTML_FORMAT');
      expect(mapWarningToDiagnosticCode('NOT_INSTAGRAM_EXPORT')).toBe('NOT_INSTAGRAM_EXPORT');
      expect(mapWarningToDiagnosticCode('INCOMPLETE_EXPORT')).toBe('INCOMPLETE_EXPORT');
      expect(mapWarningToDiagnosticCode('NO_DATA_FILES')).toBe('NO_DATA_FILES');
      expect(mapWarningToDiagnosticCode('MISSING_FOLLOWING')).toBe('MISSING_FOLLOWING');
      expect(mapWarningToDiagnosticCode('MISSING_FOLLOWERS')).toBe('MISSING_FOLLOWERS');
    });

    it('never tells a reader with an intact export to re-download it (GH#21 Task 3)', () => {
      // These two fire when the ZIP is fine and we are the ones who cannot read
      // it. Left unmapped they fall through to UNKNOWN, whose fix is "Try
      // uploading the file again... make sure the ZIP file is not corrupted" —
      // advice that is false here and costs the reader a days-long re-export.
      for (const code of ['UNRESOLVED_ENTRIES_FOLLOWING', 'UNRESOLVED_ENTRIES_FOLLOWERS']) {
        const mapped = mapWarningToDiagnosticCode(code);
        expect(mapped).toBe('INVALID_DATA_STRUCTURE');
        expect(createDiagnosticError(mapped).fix).not.toMatch(/again|corrupt/i);
      }
    });

    it('should return UNKNOWN for unmapped codes', () => {
      expect(mapWarningToDiagnosticCode('SOME_RANDOM_CODE')).toBe('UNKNOWN');
      expect(mapWarningToDiagnosticCode('NOT_MAPPED')).toBe('UNKNOWN');
      expect(mapWarningToDiagnosticCode('')).toBe('UNKNOWN');
    });
  });

  describe('createDiagnosticError', () => {
    it('should create NOT_ZIP error', () => {
      const error = createDiagnosticError('NOT_ZIP');

      expect(error.code).toBe('NOT_ZIP');
      expect(error.title).toBe('Not a ZIP File');
      expect(error.icon).toBe('zip');
      expect(error.severity).toBe('error');
      expect(error.message).toContain('ZIP archive');
      expect(error.fix).toContain('.zip');
    });

    it('should create HTML_FORMAT error', () => {
      const error = createDiagnosticError('HTML_FORMAT');

      expect(error.code).toBe('HTML_FORMAT');
      expect(error.title).toBe('Wrong Format: HTML');
      expect(error.icon).toBe('html');
      expect(error.message).toContain('HTML format');
      expect(error.fix).toContain('JSON');
    });

    it('should create NOT_INSTAGRAM_EXPORT error', () => {
      const error = createDiagnosticError('NOT_INSTAGRAM_EXPORT');

      expect(error.code).toBe('NOT_INSTAGRAM_EXPORT');
      expect(error.title).toBe('Not an Instagram Export');
      expect(error.icon).toBe('folder');
      expect(error.message).toContain('Instagram data export');
    });

    it('should create INCOMPLETE_EXPORT error', () => {
      const error = createDiagnosticError('INCOMPLETE_EXPORT');

      expect(error.code).toBe('INCOMPLETE_EXPORT');
      expect(error.title).toBe('Incomplete Export');
      expect(error.severity).toBe('error');
      expect(error.message).toContain('Followers and following');
    });

    it('should create NO_DATA_FILES error', () => {
      const error = createDiagnosticError('NO_DATA_FILES');

      expect(error.code).toBe('NO_DATA_FILES');
      expect(error.title).toBe('No Follower Data Found');
      expect(error.icon).toBe('file');
    });

    it('should create MISSING_FOLLOWING warning', () => {
      const error = createDiagnosticError('MISSING_FOLLOWING');

      expect(error.code).toBe('MISSING_FOLLOWING');
      expect(error.severity).toBe('warning');
      expect(error.message).toContain('following.json');
    });

    it('should create MISSING_FOLLOWERS warning', () => {
      const error = createDiagnosticError('MISSING_FOLLOWERS');

      expect(error.code).toBe('MISSING_FOLLOWERS');
      expect(error.severity).toBe('warning');
      expect(error.message).toContain('followers_*.json');
    });

    it('should create UNKNOWN error', () => {
      const error = createDiagnosticError('UNKNOWN');

      expect(error.code).toBe('UNKNOWN');
      expect(error.title).toBe('Upload Error');
      expect(error.icon).toBe('unknown');
      expect(error.message).toContain('unexpected error');
    });

    it('should use custom message when provided', () => {
      const customMessage = 'Custom error message';
      const error = createDiagnosticError('NOT_ZIP', customMessage);

      expect(error.message).toBe(customMessage);
      expect(error.title).toBe('Not a ZIP File');
    });

    it('should use custom message for UNKNOWN error', () => {
      const customMessage = 'Network timeout';
      const error = createDiagnosticError('UNKNOWN', customMessage);

      expect(error.message).toBe(customMessage);
    });

    it('should fall back to default message for UNKNOWN without custom message', () => {
      const error = createDiagnosticError('UNKNOWN');

      expect(error.message).toBe('An unexpected error occurred while processing your file.');
    });
  });

  describe('createDiagnosticError - new error codes', () => {
    const newErrorCodes = [
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
    ] as const;

    it.each(newErrorCodes)('should create diagnostic error for %s', code => {
      const error = createDiagnosticError(code);

      expect(error.code).toBe(code);
      expect(error.title).toBeDefined();
      expect(error.title.length).toBeGreaterThan(0);
      expect(error.message).toBeDefined();
      expect(error.message.length).toBeGreaterThan(0);
      expect(error.fix).toBeDefined();
      expect(error.fix.length).toBeGreaterThan(0);
      expect(error.icon).toBeDefined();
      expect(['error', 'warning']).toContain(error.severity);
    });

    it.each(newErrorCodes)('should allow custom message override for %s', code => {
      const customMessage = 'Custom error message for testing';
      const error = createDiagnosticError(code, customMessage);

      expect(error.message).toBe(customMessage);
      // Other fields should remain default
      expect(error.code).toBe(code);
      expect(error.title).toBeDefined();
    });

    describe('specific error details', () => {
      it('should have correct details for CORRUPTED_ZIP', () => {
        const error = createDiagnosticError('CORRUPTED_ZIP');

        expect(error.title).toBe('Corrupted ZIP File');
        expect(error.icon).toBe('zip');
        expect(error.severity).toBe('error');
        expect(error.message).toContain('damaged');
      });

      it('should have correct details for ZIP_ENCRYPTED', () => {
        const error = createDiagnosticError('ZIP_ENCRYPTED');

        expect(error.title).toBe('Password-Protected ZIP');
        expect(error.icon).toBe('zip');
        expect(error.severity).toBe('error');
      });

      it('should have correct details for EMPTY_FILE', () => {
        const error = createDiagnosticError('EMPTY_FILE');

        expect(error.title).toBe('Empty File');
        expect(error.icon).toBe('file');
        expect(error.message).toContain('0 bytes');
      });

      it('does not advise a desktop browser, which never helped', () => {
        const error = createDiagnosticError('FILE_TOO_LARGE');

        // The ceiling was a constant, so a machine with 64GB was rejected at
        // 501MB exactly like a phone. The advice never worked for anyone.
        expect(error.fix.toLowerCase()).not.toContain('desktop');
        expect(error.fix.toLowerCase()).not.toContain('memory');
      });

      it('does not quote a limit that no longer exists', () => {
        const error = createDiagnosticError('FILE_TOO_LARGE');

        expect(error.title).toBe('File Too Large');
        expect(error.message).not.toContain('500');
      });

      it('should have correct details for JSON_PARSE_ERROR', () => {
        const error = createDiagnosticError('JSON_PARSE_ERROR');

        expect(error.title).toBe('Invalid Data Format');
        expect(error.message).toContain('JSON');
      });

      it('should have correct details for WORKER_TIMEOUT', () => {
        const error = createDiagnosticError('WORKER_TIMEOUT');

        expect(error.title).toBe('Processing Timeout');
        expect(error.message).toContain('60 seconds');
      });

      it('should have correct details for WORKER_CRASHED', () => {
        const error = createDiagnosticError('WORKER_CRASHED');

        expect(error.title).toBe('Processing Crashed');
        expect(error.severity).toBe('error');
      });

      it('should have correct details for QUOTA_EXCEEDED', () => {
        const error = createDiagnosticError('QUOTA_EXCEEDED');

        expect(error.title).toBe('Storage Full');
        expect(error.fix).toContain('Clear');
      });

      it('should have correct details for IDB_NOT_SUPPORTED', () => {
        const error = createDiagnosticError('IDB_NOT_SUPPORTED');

        expect(error.title).toBe('Storage Not Available');
        expect(error.fix).toContain('incognito');
      });

      it('should have correct details for UPLOAD_CANCELLED', () => {
        const error = createDiagnosticError('UPLOAD_CANCELLED');

        expect(error.title).toBe('Upload Cancelled');
        expect(error.severity).toBe('warning');
      });

      it('should have correct details for CRYPTO_NOT_AVAILABLE', () => {
        const error = createDiagnosticError('CRYPTO_NOT_AVAILABLE');

        expect(error.title).toBe('Security Feature Unavailable');
        expect(error.message).toContain('crypto.subtle');
      });

      it('should have correct details for NETWORK_ERROR', () => {
        const error = createDiagnosticError('NETWORK_ERROR');

        expect(error.title).toBe('Network Error');
        expect(error.fix).toContain('internet connection');
      });
    });
  });

  describe('mapWarningToDiagnosticCode - new codes', () => {
    const newMappings = [
      ['CORRUPTED_ZIP', 'CORRUPTED_ZIP'],
      ['ZIP_ENCRYPTED', 'ZIP_ENCRYPTED'],
      ['EMPTY_FILE', 'EMPTY_FILE'],
      ['FILE_TOO_LARGE', 'FILE_TOO_LARGE'],
      ['JSON_PARSE_ERROR', 'JSON_PARSE_ERROR'],
      ['INVALID_DATA_STRUCTURE', 'INVALID_DATA_STRUCTURE'],
      ['WORKER_TIMEOUT', 'WORKER_TIMEOUT'],
      ['WORKER_INIT_ERROR', 'WORKER_INIT_ERROR'],
      ['WORKER_CRASHED', 'WORKER_CRASHED'],
      ['INDEXEDDB_ERROR', 'INDEXEDDB_ERROR'],
      ['QUOTA_EXCEEDED', 'QUOTA_EXCEEDED'],
      ['IDB_NOT_SUPPORTED', 'IDB_NOT_SUPPORTED'],
      ['IDB_PERMISSION_DENIED', 'IDB_PERMISSION_DENIED'],
      ['UPLOAD_CANCELLED', 'UPLOAD_CANCELLED'],
      ['CRYPTO_NOT_AVAILABLE', 'CRYPTO_NOT_AVAILABLE'],
      ['NETWORK_ERROR', 'NETWORK_ERROR'],
    ] as const;

    it.each(newMappings)('should map %s to %s', (input, expected) => {
      expect(mapWarningToDiagnosticCode(input)).toBe(expected);
    });
  });
});

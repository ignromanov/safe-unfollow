// === Diagnostic Error Types ===

/** Error codes for diagnostic UI */
export type DiagnosticErrorCode =
  // Existing - File format errors
  | 'NOT_ZIP' // File is not a ZIP archive
  | 'HTML_FORMAT' // ZIP contains HTML instead of JSON
  | 'NOT_INSTAGRAM_EXPORT' // ZIP is not Instagram export
  | 'INCOMPLETE_EXPORT' // Missing followers_and_following folder
  | 'NO_DATA_FILES' // No following.json or followers files
  | 'MISSING_FOLLOWING' // following.json not found
  | 'MISSING_FOLLOWERS' // followers_*.json not found
  | 'INVALID_FOLLOWING_FORMAT' // following.json found, but shape unrecognized (GH#21)
  | 'INVALID_FOLLOWERS_FORMAT' // followers_*.json found, but shape unrecognized (GH#21)
  // New - ZIP/File errors
  | 'CORRUPTED_ZIP' // the ZIP reader failed to open it
  | 'ZIP_ENCRYPTED' // ZIP is password-protected
  | 'EMPTY_FILE' // File is empty (0 bytes)
  | 'FILE_TOO_LARGE' // The browser refused the allocation; no ceiling of ours
  // New - Parsing errors
  | 'JSON_PARSE_ERROR' // Invalid JSON
  | 'INVALID_DATA_STRUCTURE' // JSON exists but wrong structure
  // New - Worker errors
  | 'WORKER_TIMEOUT' // 60s timeout exceeded
  | 'WORKER_INIT_ERROR' // Worker failed to initialize
  | 'WORKER_CRASHED' // Worker crashed during processing
  // New - Storage errors
  | 'INDEXEDDB_ERROR' // General IDB error
  | 'QUOTA_EXCEEDED' // Storage quota exceeded
  | 'IDB_NOT_SUPPORTED' // IndexedDB unavailable (incognito)
  | 'IDB_PERMISSION_DENIED' // Storage permission denied
  // New - Other errors
  | 'UPLOAD_CANCELLED' // User cancelled upload
  | 'CRYPTO_NOT_AVAILABLE' // crypto.subtle unavailable
  | 'NETWORK_ERROR' // Network failure
  | 'UNKNOWN'; // Fallback

/** Diagnostic error with rich metadata for UI */
export interface DiagnosticError {
  code: DiagnosticErrorCode;
  title: string;
  message: string;
  fix: string;
  icon: 'html' | 'zip' | 'folder' | 'file' | 'unknown';
  severity: 'error' | 'warning';
}

/** Map ParseWarning code to DiagnosticErrorCode */
export function mapWarningToDiagnosticCode(code: string): DiagnosticErrorCode {
  const mapping: Record<string, DiagnosticErrorCode> = {
    // Existing
    NOT_ZIP: 'NOT_ZIP',
    HTML_FORMAT: 'HTML_FORMAT',
    NOT_INSTAGRAM_EXPORT: 'NOT_INSTAGRAM_EXPORT',
    INCOMPLETE_EXPORT: 'INCOMPLETE_EXPORT',
    NO_DATA_FILES: 'NO_DATA_FILES',
    MISSING_FOLLOWING: 'MISSING_FOLLOWING',
    MISSING_FOLLOWERS: 'MISSING_FOLLOWERS',
    INVALID_FOLLOWING_FORMAT: 'INVALID_FOLLOWING_FORMAT',
    INVALID_FOLLOWERS_FORMAT: 'INVALID_FOLLOWERS_FORMAT',
    // Entry-level drift (GH#21): the file was found, its wrapper parsed, and
    // the records inside were unreadable. Mapped onto INVALID_DATA_STRUCTURE
    // rather than earning entries of their own, weighed as follows.
    //
    // What is gained: `createDiagnosticError` overrides `message` with the
    // warning's own, so the reader still sees which file drifted and how many
    // records were lost. And the fix here — "Instagram may have changed their
    // export format. Please report this issue." — at least does not send
    // someone whose export is perfectly good back to Instagram for another
    // one, which is exactly what the UNKNOWN fallback would have done.
    //
    // What it costs, so nobody concludes this was overlooked: the warnings
    // carry a `fix` saying the export is fine and re-requesting will not help,
    // and the screen renders the DIAGNOSTIC's fix, not the warning's — so that
    // sentence reaches telemetry and any future diagnostics UI, but not this
    // screen. Buying it back means a new code with new copy in errors.ts and
    // ten locales, and errors.ts is already over the 300-line ceiling. Do not
    // reword INVALID_DATA_STRUCTURE in place to recover it: that copy is shared
    // with unrelated failures where "your export is fine" would be false.
    UNRESOLVED_ENTRIES_FOLLOWING: 'INVALID_DATA_STRUCTURE',
    UNRESOLVED_ENTRIES_FOLLOWERS: 'INVALID_DATA_STRUCTURE',
    // New - ZIP/File
    CORRUPTED_ZIP: 'CORRUPTED_ZIP',
    ZIP_ENCRYPTED: 'ZIP_ENCRYPTED',
    EMPTY_FILE: 'EMPTY_FILE',
    FILE_TOO_LARGE: 'FILE_TOO_LARGE',
    // New - Parsing
    JSON_PARSE_ERROR: 'JSON_PARSE_ERROR',
    INVALID_DATA_STRUCTURE: 'INVALID_DATA_STRUCTURE',
    // New - Worker
    WORKER_TIMEOUT: 'WORKER_TIMEOUT',
    WORKER_INIT_ERROR: 'WORKER_INIT_ERROR',
    WORKER_CRASHED: 'WORKER_CRASHED',
    // New - Storage
    INDEXEDDB_ERROR: 'INDEXEDDB_ERROR',
    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
    IDB_NOT_SUPPORTED: 'IDB_NOT_SUPPORTED',
    IDB_PERMISSION_DENIED: 'IDB_PERMISSION_DENIED',
    // New - Other
    UPLOAD_CANCELLED: 'UPLOAD_CANCELLED',
    CRYPTO_NOT_AVAILABLE: 'CRYPTO_NOT_AVAILABLE',
    NETWORK_ERROR: 'NETWORK_ERROR',
  };
  return mapping[code] ?? 'UNKNOWN';
}

/** Create DiagnosticError from error code */
export function createDiagnosticError(
  code: DiagnosticErrorCode,
  customMessage?: string
): DiagnosticError {
  const errors: Record<DiagnosticErrorCode, Omit<DiagnosticError, 'code'>> = {
    // Existing errors
    NOT_ZIP: {
      title: 'Not a ZIP File',
      message: 'Please upload the ZIP archive from Instagram, not a folder or other file type.',
      fix: 'Look for a file ending in .zip in your Downloads folder. It should be named something like "instagram-username-date.zip".',
      icon: 'zip',
      severity: 'error',
    },
    HTML_FORMAT: {
      title: 'Wrong Format: HTML',
      message:
        'You downloaded your data in HTML format, but this tool requires JSON format to work.',
      fix: 'Go back to Instagram Settings → Download Your Data → Select "JSON" format (not HTML) → Request download again.',
      icon: 'html',
      severity: 'error',
    },
    NOT_INSTAGRAM_EXPORT: {
      title: 'Not an Instagram Export',
      message: "This ZIP file doesn't appear to be an Instagram data export.",
      fix: 'Make sure you\'re uploading the ZIP file from Instagram\'s "Download Your Data" feature, not a random ZIP file.',
      icon: 'folder',
      severity: 'error',
    },
    INCOMPLETE_EXPORT: {
      title: 'Incomplete Export',
      message: 'The export is missing the "Followers and following" data.',
      fix: 'Re-request your data from Instagram and make sure to select "Followers and following" in the data types.',
      icon: 'folder',
      severity: 'error',
    },
    NO_DATA_FILES: {
      title: 'No Follower Data Found',
      message: 'Could not find following.json or followers files in the expected location.',
      fix: 'Make sure you selected "Followers and following" when requesting your data, and that you\'re uploading the correct ZIP file.',
      icon: 'file',
      severity: 'error',
    },
    MISSING_FOLLOWING: {
      title: 'Missing Following Data',
      message: 'following.json not found — cannot detect who you follow.',
      fix: 'Re-request your data and ensure "Followers and following" is selected.',
      icon: 'file',
      severity: 'warning',
    },
    MISSING_FOLLOWERS: {
      title: 'Missing Followers Data',
      message: 'followers_*.json files not found — cannot detect who follows you.',
      fix: 'Re-request your data and ensure "Followers and following" is selected.',
      icon: 'file',
      severity: 'warning',
    },
    INVALID_FOLLOWING_FORMAT: {
      title: 'Unrecognized Following Data',
      message:
        'following.json was found, but its structure does not match any known Instagram export format.',
      fix: 'Instagram may have changed their export format. Please report this issue on GitHub so we can add support.',
      icon: 'file',
      severity: 'error',
    },
    INVALID_FOLLOWERS_FORMAT: {
      title: 'Unrecognized Followers Data',
      message:
        'followers_*.json was found, but its structure does not match any known Instagram export format.',
      fix: 'Instagram may have changed their export format. Please report this issue on GitHub so we can add support.',
      icon: 'file',
      severity: 'error',
    },
    // New - ZIP/File errors
    CORRUPTED_ZIP: {
      title: 'Corrupted ZIP File',
      message: 'The ZIP file appears to be damaged or corrupted and cannot be opened.',
      fix: 'Try downloading your Instagram data again. Make sure the download completed fully before uploading.',
      icon: 'zip',
      severity: 'error',
    },
    ZIP_ENCRYPTED: {
      title: 'Password-Protected ZIP',
      message: 'The ZIP file is password-protected, but Instagram exports are not encrypted.',
      fix: 'This may not be a valid Instagram data export. Request a new export from Instagram Settings.',
      icon: 'zip',
      severity: 'error',
    },
    EMPTY_FILE: {
      title: 'Empty File',
      message: 'The uploaded file is empty (0 bytes).',
      fix: 'The download may have been interrupted. Try downloading your data again from Instagram.',
      icon: 'file',
      severity: 'error',
    },
    FILE_TOO_LARGE: {
      title: 'File Too Large',
      message: 'Your browser could not open this export — it is too large for this device.',
      fix: 'Ask Instagram for just the part this tool needs: Download your information → Some of your information → Followers and Following → JSON.',
      icon: 'file',
      severity: 'error',
    },
    // New - Parsing errors
    JSON_PARSE_ERROR: {
      title: 'Invalid Data Format',
      message: 'One or more JSON files in the export are malformed or corrupted.',
      fix: 'This may indicate a corrupted download. Request a fresh data export from Instagram.',
      icon: 'file',
      severity: 'error',
    },
    INVALID_DATA_STRUCTURE: {
      title: 'Unexpected Data Structure',
      message: 'The JSON files exist but have an unexpected structure.',
      fix: 'Instagram may have changed their export format. Please report this issue.',
      icon: 'file',
      severity: 'error',
    },
    // New - Worker errors
    WORKER_TIMEOUT: {
      title: 'Processing Timeout',
      message: 'The file took too long to process (over 60 seconds).',
      fix: 'Try closing other browser tabs to free up resources, or use a smaller export file.',
      icon: 'unknown',
      severity: 'error',
    },
    WORKER_INIT_ERROR: {
      title: 'Processing Failed to Start',
      message: 'Could not initialize the file processor.',
      fix: 'Try refreshing the page. If the problem persists, try a different browser.',
      icon: 'unknown',
      severity: 'error',
    },
    WORKER_CRASHED: {
      title: 'Processing Crashed',
      message: 'The file processor crashed unexpectedly.',
      fix: 'This may be due to insufficient memory. Try closing other tabs or using a smaller file.',
      icon: 'unknown',
      severity: 'error',
    },
    // New - Storage errors
    INDEXEDDB_ERROR: {
      title: 'Storage Error',
      message: 'Could not save data to browser storage.',
      fix: 'Try clearing browser cache or using a different browser. Private/incognito mode may have limited storage.',
      icon: 'unknown',
      severity: 'error',
    },
    QUOTA_EXCEEDED: {
      title: 'Storage Full',
      message: 'Browser storage quota has been exceeded.',
      fix: 'Clear some browser data in Settings, or try a different browser profile.',
      icon: 'unknown',
      severity: 'error',
    },
    IDB_NOT_SUPPORTED: {
      title: 'Storage Not Available',
      message: 'IndexedDB storage is not available in this browser.',
      fix: 'This app requires IndexedDB. Disable incognito/private mode, or try Chrome/Firefox/Safari.',
      icon: 'unknown',
      severity: 'error',
    },
    IDB_PERMISSION_DENIED: {
      title: 'Storage Permission Denied',
      message: 'The browser denied access to storage.',
      fix: 'Check browser settings to allow storage for this site, or disable strict privacy mode.',
      icon: 'unknown',
      severity: 'error',
    },
    // New - Other errors
    UPLOAD_CANCELLED: {
      title: 'Upload Cancelled',
      message: 'The upload was cancelled.',
      fix: 'Click "Try Again" to upload your file.',
      icon: 'unknown',
      severity: 'warning',
    },
    CRYPTO_NOT_AVAILABLE: {
      title: 'Security Feature Unavailable',
      message: 'Your browser does not support secure hashing (crypto.subtle).',
      fix: 'Please use a modern browser (Chrome 37+, Firefox 34+, Safari 11+) with HTTPS.',
      icon: 'unknown',
      severity: 'error',
    },
    NETWORK_ERROR: {
      title: 'Network Error',
      message: 'A network error occurred during upload.',
      fix: 'Check your internet connection and try again.',
      icon: 'unknown',
      severity: 'error',
    },
    // Fallback
    UNKNOWN: {
      title: 'Upload Error',
      message: customMessage ?? 'An unexpected error occurred while processing your file.',
      fix: 'Try uploading the file again. If the problem persists, make sure the ZIP file is not corrupted.',
      icon: 'unknown',
      severity: 'error',
    },
  };

  const errorData = errors[code];
  return {
    code,
    ...errorData,
    message: customMessage ?? errorData.message,
  };
}

/** All diagnostic error codes for dev preview */
export const ALL_DIAGNOSTIC_ERROR_CODES: DiagnosticErrorCode[] = [
  'NOT_ZIP',
  'HTML_FORMAT',
  'NOT_INSTAGRAM_EXPORT',
  'INCOMPLETE_EXPORT',
  'NO_DATA_FILES',
  'MISSING_FOLLOWING',
  'MISSING_FOLLOWERS',
  'INVALID_FOLLOWING_FORMAT',
  'INVALID_FOLLOWERS_FORMAT',
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
  'UNKNOWN',
];

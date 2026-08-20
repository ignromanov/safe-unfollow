import type { DiagnosticError, DiagnosticErrorCode } from '@/core/types';
import { Code2, FileArchive, FileQuestion, FileX2, FolderX } from 'lucide-react';

/**
 * Error codes that warrant GitHub issue reporting.
 *
 * The two format codes are the strongest case in the list: they fire only when a
 * required relationship file is present but its top-level shape matches nothing we
 * know (GH#21), which means Instagram changed the export and every user is about to
 * hit it. Analytics tells us it happened; the report tells us what the new shape is,
 * and only the user has that file. Note this Set is not exhaustive over
 * `DiagnosticErrorCode`, so the compiler will not remind anyone to revisit it.
 */
export const REPORTABLE_ERROR_CODES: Set<DiagnosticErrorCode> = new Set([
  'INVALID_FOLLOWING_FORMAT',
  'INVALID_FOLLOWERS_FORMAT',
  'CORRUPTED_ZIP',
  'JSON_PARSE_ERROR',
  'INVALID_DATA_STRUCTURE',
  'WORKER_TIMEOUT',
  'WORKER_INIT_ERROR',
  'WORKER_CRASHED',
  'INDEXEDDB_ERROR',
  'IDB_NOT_SUPPORTED',
  'IDB_PERMISSION_DENIED',
  'CRYPTO_NOT_AVAILABLE',
  'UNKNOWN',
]);

export function shouldShowReportIssue(code: DiagnosticErrorCode): boolean {
  return REPORTABLE_ERROR_CODES.has(code);
}

/**
 * Generates a pre-filled GitHub issue URL for error reporting.
 */
export function generateGitHubIssueUrl(error: DiagnosticError): string {
  const repo = 'ignromanov/safe-unfollow';
  const title = encodeURIComponent(`[Bug] Upload error: ${error.code}`);

  const body = encodeURIComponent(`## Error Details

- **Error Code**: \`${error.code}\`
- **Error Title**: ${error.title}
- **Error Message**: ${error.message}

## Environment

- **Browser**: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'}
- **Timestamp**: ${new Date().toISOString()}

## Steps to Reproduce

1. Uploaded Instagram data export ZIP file
2. Got error: ${error.code}

## Expected Behavior

File should be processed successfully.

## Additional Context

<!-- Add any other context about the problem here -->
`);

  return `https://github.com/${repo}/issues/new?title=${title}&body=${body}&labels=bug,upload-error`;
}

/**
 * Generates error details string for clipboard.
 */
export function generateErrorDetails(error: DiagnosticError): string {
  return `Error Code: ${error.code}
Title: ${error.title}
Message: ${error.message}
Browser: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'}
Timestamp: ${new Date().toISOString()}`;
}

/** Get icon component for error type */
export function getErrorIcon(icon: DiagnosticError['icon']): React.ReactElement {
  const iconProps = { size: 48, strokeWidth: 1.5 };

  switch (icon) {
    case 'html':
      return <Code2 {...iconProps} />;
    case 'zip':
      return <FileArchive {...iconProps} />;
    case 'folder':
      return <FolderX {...iconProps} />;
    case 'file':
      return <FileX2 {...iconProps} />;
    default:
      return <FileQuestion {...iconProps} />;
  }
}

/**
 * Failures the reader can fix themselves, in under five minutes, with an action
 * we can name. These paint amber: nothing broke, the file is intact, and the
 * next step is one radio button in someone else's dialog.
 *
 * This is a SEPARATE axis from `severity`, deliberately. Lowering HTML_FORMAT to
 * severity 'warning' would paint it amber and also stop the screen rendering at
 * all: UploadZone.tsx:44-47 gates DiagnosticErrorScreen on
 * `parseWarnings.some(w => w.severity === 'error')`, which is 18.7% of uploads.
 * Nothing tests that combination, so the regression would be silent.
 *
 * Keep this set small. Amber stops carrying information the moment a code that
 * the reader cannot act on is added to it.
 */
const RECOVERABLE: ReadonlySet<DiagnosticErrorCode> = new Set(['HTML_FORMAT']);

/** Whether the reader can fix this error themselves. See `RECOVERABLE` above. */
export function isRecoverable(code: DiagnosticErrorCode): boolean {
  return RECOVERABLE.has(code);
}

/** Colour scheme: amber for what the reader can fix, rose for what they cannot. */
export function getColorScheme(error: Pick<DiagnosticError, 'code' | 'severity'>): {
  bg: string;
  border: string;
  icon: string;
  title: string;
  text: string;
} {
  if (error.severity === 'warning' || RECOVERABLE.has(error.code)) {
    return {
      bg: 'bg-amber-50 dark:bg-amber-950/20',
      border: 'border-amber-200 dark:border-amber-900/50',
      icon: 'text-amber-500',
      title: 'text-amber-700 dark:text-amber-400',
      text: 'text-amber-600 dark:text-amber-300',
    };
  }

  return {
    bg: 'bg-rose-50 dark:bg-rose-950/20',
    border: 'border-rose-200 dark:border-rose-900/50',
    icon: 'text-rose-500',
    title: 'text-rose-700 dark:text-rose-400',
    text: 'text-rose-600 dark:text-rose-300',
  };
}

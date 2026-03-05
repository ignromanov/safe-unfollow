import type { DiagnosticError, DiagnosticErrorCode } from '@/core/types';
import { Code2, FileArchive, FileQuestion, FileX2, FolderX } from 'lucide-react';

/** Error codes that warrant GitHub issue reporting */
export const REPORTABLE_ERROR_CODES: Set<DiagnosticErrorCode> = new Set([
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

/** Get color scheme for error severity */
export function getColorScheme(severity: DiagnosticError['severity']): {
  bg: string;
  border: string;
  icon: string;
  title: string;
  text: string;
} {
  if (severity === 'warning') {
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

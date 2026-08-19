import { DiagnosticErrorScreen } from 'safe-unfollow';

// The error CODE is the variant axis: it drives icon, severity colour scheme
// (rose for 'error', amber for 'warning'), and whether the "Report this
// issue" link appears (only for codes in REPORTABLE_ERROR_CODES). Real copy
// comes from createDiagnosticError() inside the component itself — these
// three codes are the dominant real failure (HTML_FORMAT, 48% of upload
// errors), a warning-severity code, and a reportable error-severity code.

export function HtmlFormat() {
  return (
    <div className="max-w-2xl">
      <DiagnosticErrorScreen
        errorCode="HTML_FORMAT"
        onTryAgain={() => {}}
        onOpenWizard={() => {}}
      />
    </div>
  );
}

export function MissingFollowing() {
  return (
    <div className="max-w-2xl">
      <DiagnosticErrorScreen
        errorCode="MISSING_FOLLOWING"
        onTryAgain={() => {}}
        onOpenWizard={() => {}}
      />
    </div>
  );
}

export function CorruptedZip() {
  return (
    <div className="max-w-2xl">
      <DiagnosticErrorScreen
        errorCode="CORRUPTED_ZIP"
        onTryAgain={() => {}}
        onOpenWizard={() => {}}
      />
    </div>
  );
}

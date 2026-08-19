import { AlertTriangle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from 'safe-unfollow';

export function PrivacyNotice() {
  return (
    <div className="max-w-lg">
      <Alert>
        <AlertTitle>No login required</AlertTitle>
        <AlertDescription>
          This tool never asks for your Instagram password. It only reads the official data export
          you download from Meta yourself, and everything is processed locally in your browser.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export function FormatError() {
  return (
    <div className="max-w-lg">
      <Alert variant="destructive">
        <AlertTriangle aria-hidden="true" />
        <AlertTitle>Wrong export format</AlertTitle>
        <AlertDescription>
          You downloaded your data in HTML format, but this tool requires JSON format to work. Go
          back to Instagram Settings → Download Your Data → select &ldquo;JSON&rdquo; format (not
          HTML) → request the download again.
        </AlertDescription>
      </Alert>
    </div>
  );
}

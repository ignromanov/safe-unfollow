import { useState } from 'react';
import { UploadZone } from 'safe-unfollow';

// UploadZone composes FormatQuiz internally, which reads localStorage on
// mount (see FormatQuiz.tsx for why). Cleared here so this story's card
// shows the real first-visit composition rather than whatever a previous
// component's capture left in the shared browser origin.
function useSeedCleanQuiz() {
  useState(() => {
    try {
      localStorage.removeItem('format-quiz-answer');
      localStorage.removeItem('format-quiz-dismissed');
    } catch {
      // localStorage unavailable
    }
    return null;
  });
}

export function Default() {
  useSeedCleanQuiz();
  return <UploadZone onUploadStart={() => {}} onOpenWizard={() => {}} />;
}

export function Processing() {
  useSeedCleanQuiz();
  return <UploadZone onUploadStart={() => {}} onOpenWizard={() => {}} isProcessing={true} />;
}

// The dominant real failure (HTML_FORMAT is 48% of all upload errors) routes
// UploadZone to its embedded DiagnosticErrorScreen branch instead of the
// normal upload UI — this is the one composition FormatQuiz never reaches,
// so no seeding needed.
export function WithCriticalError() {
  useSeedCleanQuiz();
  return (
    <UploadZone
      onUploadStart={() => {}}
      onOpenWizard={() => {}}
      parseWarnings={[
        {
          code: 'HTML_FORMAT',
          message:
            'You downloaded your data in HTML format, but this tool requires JSON format to work.',
          severity: 'error',
          fix: 'Go back to Instagram Settings → Download Your Data → Select "JSON" format (not HTML) → Request download again.',
        },
      ]}
    />
  );
}

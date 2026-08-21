import { UploadZone } from 'safe-unfollow';

// The /upload page's whole body: headline, the touch/desktop drop zone, the
// loading tips and the affiliate block, plus a two-card sidebar that appears
// from `lg` up. On a 390px card only the single-column mobile composition
// renders, which is the one 85% of readers get.
export function Default() {
  return <UploadZone onUploadStart={() => {}} onOpenWizard={() => {}} />;
}

export function Processing() {
  return <UploadZone onUploadStart={() => {}} onOpenWizard={() => {}} isProcessing={true} />;
}

// The dominant real failure — HTML_FORMAT is 55.2% of every upload error —
// routes UploadZone to its embedded DiagnosticErrorScreen branch instead of
// the normal upload UI, so this card shows a different screen rather than a
// variant of the one above.
//
// Only `code` and `severity` decide what renders. `severity: 'error'` is what
// sends UploadZone down this branch at all, and the screen then resolves every
// visible string from the locale by code (DiagnosticErrorScreen.tsx:128,
// `diagnostic.errors.<code>.*`) — a fixture cannot put words on this card. So
// `message` is the locale's own, verbatim, rather than an invented copy that
// silently stops matching the product.
export function WithCriticalError() {
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
        },
      ]}
    />
  );
}

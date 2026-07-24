import { Download } from 'lucide-react';
import { Suspense, lazy, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useProExport } from '@/hooks/useProExport';
import { analytics } from '@/lib/stats';

// Lazy: the paywall, the export dialog and everything they pull in (export
// builders, the worker) are needed only after a click. Keeping them out of the
// main bundle spares the ~99% of visitors who never open them.
const ExportDialog = lazy(() =>
  import('./ExportDialog').then(module => ({ default: module.ExportDialog }))
);
const PaywallModal = lazy(() =>
  import('./PaywallModal').then(module => ({ default: module.PaywallModal }))
);
const LicenseDialog = lazy(() =>
  import('./LicenseDialog').then(module => ({ default: module.LicenseDialog }))
);

export interface ResultsExportControlsProps {
  /** IndexedDB file hash for data lookup */
  fileHash: string;
  /** Currently visible account indices, or null for "all accounts" */
  indices: number[] | null;
  /** Total number of accounts in this dataset */
  totalCount: number;
  /** Base name for the generated file, without extension */
  filename: string;
}

/**
 * Download button plus its modals.
 *
 * Owns the modal open/close state on purpose: keeping it here means opening the
 * paywall re-renders this control instead of the whole results view (and its
 * virtualized account list).
 */
export function ResultsExportControls({
  fileHash,
  indices,
  totalCount,
  filename,
}: ResultsExportControlsProps) {
  const { t } = useTranslation('results');
  const { isEnabled, isUnlocked, startCheckout } = useProExport();
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isLicenseDialogOpen, setIsLicenseDialogOpen] = useState(false);

  if (!isEnabled) return null;

  // Warm the chunk on intent so the modal is ready by the time it is clicked
  const preloadModal = (): void => {
    void (isUnlocked ? import('./ExportDialog') : import('./PaywallModal'));
  };

  const handleDownloadClick = (): void => {
    analytics.exportClick(isUnlocked);
    if (isUnlocked) {
      setIsExportDialogOpen(true);
    } else {
      analytics.paywallView();
      setIsPaywallOpen(true);
    }
  };

  const label = t('export.downloadAriaLabel', { defaultValue: 'Export accounts' });
  const rowCount = indices === null ? totalCount : indices.length;

  return (
    <>
      <Button
        onClick={handleDownloadClick}
        onMouseEnter={preloadModal}
        onFocus={preloadModal}
        variant="outline"
        size="icon"
        className="p-3.5 h-auto w-auto rounded-2xl shrink-0"
        aria-label={label}
        title={label}
      >
        <Download size={20} />
      </Button>

      <Suspense fallback={null}>
        {isPaywallOpen ? (
          <PaywallModal
            open={isPaywallOpen}
            onOpenChange={setIsPaywallOpen}
            onCheckout={startCheckout}
            onManualEntry={() => {
              setIsPaywallOpen(false);
              setIsLicenseDialogOpen(true);
            }}
          />
        ) : null}
        {isExportDialogOpen ? (
          <ExportDialog
            open={isExportDialogOpen}
            onOpenChange={setIsExportDialogOpen}
            fileHash={fileHash}
            indices={indices}
            rowCount={rowCount}
            filename={filename}
          />
        ) : null}
        {isLicenseDialogOpen ? (
          <LicenseDialog
            open={isLicenseDialogOpen}
            onOpenChange={setIsLicenseDialogOpen}
            initialKey={null}
            source="manual"
          />
        ) : null}
      </Suspense>
    </>
  );
}

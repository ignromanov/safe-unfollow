import { Download } from 'lucide-react';
import { Suspense, lazy, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useAdViewability } from '@/hooks/useAdViewability';
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
 * Export trigger plus its modals.
 *
 * Owns the modal open/close state on purpose: keeping it here means opening the
 * paywall re-renders this control instead of the whole results view (and its
 * virtualized account list).
 *
 * The trigger states its price. Every reviewed competitor leaves export
 * unpriced, but their click downloads a real file — ours opens a paywall, and a
 * bare download glyph that bills you is exactly the kind of trick this product
 * sells the absence of. Pricing the trigger also moves the filter one step
 * earlier: the same sales need a ~3.3% click-through against a pre-qualified
 * paywall instead of 17% against a cold one.
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
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Above the early return by necessity: hooks placed after it would change in
  // count the moment `isEnabled` flips, which React rejects. Harmless when
  // disabled — nothing mounts, so the ref stays null and the hook no-ops.
  useAdViewability(triggerRef, isEnabled, () => analytics.exportTriggerViewable(isUnlocked));

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

  const rowCount = indices === null ? totalCount : indices.length;

  return (
    <>
      {/* No aria-label: the visible text is the accessible name. An aria-label
          would silently replace it, leaving a voice-control user saying the
          words on the button and matching nothing (WCAG 2.5.3 Label in Name).
          `min-h-11` keeps the 44px touch target the icon button got from its
          padding. */}
      <Button
        ref={triggerRef}
        onClick={handleDownloadClick}
        onMouseEnter={preloadModal}
        onFocus={preloadModal}
        variant="outline"
        className="h-auto min-h-11 gap-2 rounded-2xl px-4 py-2.5 font-semibold shrink-0"
      >
        <Download size={18} />
        {t('export.trigger')}
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

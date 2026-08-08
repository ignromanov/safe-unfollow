import { Download } from 'lucide-react';
import { Suspense, lazy, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useAdViewability } from '@/hooks/useAdViewability';
import { useProExport } from '@/hooks/useProExport';
import { downloadBlob } from '@/lib/export/download';
import { capIndicesForFreeExport, isFreeExportCapped } from '@/lib/export/free-tier';
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
 * The trigger does not state a price, because its click delivers a file. The
 * rule is "either the click gives you something, or the button says what it
 * costs": a bare download glyph that bills you is the kind of trick this
 * product sells the absence of. Phase 1 satisfied that rule with a price on the
 * button; this satisfies it with a real ten-row sample, which also puts the
 * filter after the value instead of before it.
 */
export function ResultsExportControls({
  fileHash,
  indices,
  totalCount,
  filename,
}: ResultsExportControlsProps) {
  const { t, i18n } = useTranslation('results');
  const { isEnabled, isUnlocked, startCheckout } = useProExport();
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isLicenseDialogOpen, setIsLicenseDialogOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [hasError, setHasError] = useState(false);
  // What the last free export actually put on disk. Snapshotted rather than
  // recomputed at render: the reader can change the filters right after the
  // download, and a receipt is only worth anything if it describes the file.
  const [saved, setSaved] = useState<{ filename: string; total: number; capped: boolean } | null>(
    null
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  // A ref, not `isBusy`: two clicks in the same tick both read the state from
  // before the re-render and both start a build. Same reason LicenseDialog
  // guards `activate` with a ref — state says what to draw, a ref says what is
  // already running.
  const isRunningRef = useRef(false);

  // Above the early return by necessity: hooks placed after it would change in
  // count the moment `isEnabled` flips, which React rejects. Harmless when
  // disabled — nothing mounts, so the ref stays null and the hook no-ops.
  useAdViewability(triggerRef, isEnabled, () => analytics.exportTriggerViewable(isUnlocked));

  if (!isEnabled) return null;

  const rowCount = indices === null ? totalCount : indices.length;

  // Warm the chunks on intent. A locked click now does real work before it
  // shows anything, so the CSV builder is on that path too, not just the modal.
  const preloadModal = (): void => {
    if (isUnlocked) {
      void import('./ExportDialog');
      return;
    }
    void import('./PaywallModal');
    void import('@/lib/export/csv');
  };

  /**
   * The locked path: hand over a real file, then ask.
   *
   * Deliberately not a paywall-first flow. A trigger whose click produces
   * nothing has to be labelled with its price to stay honest, and a price on a
   * button is a filter applied before the reader has seen the goods. Giving the
   * sample first moves the filter after the value and lets the button go back
   * to saying what it does.
   */
  const runFreeExport = async (): Promise<void> => {
    isRunningRef.current = true;
    setIsBusy(true);
    setHasError(false);
    setSaved(null);
    try {
      // Dynamic: the builder reaches into IndexedDB, and a static import would
      // put that in the main bundle for every visitor who never exports.
      const { buildExportCsv } = await import('@/lib/export/csv');

      const capped = isFreeExportCapped(indices, totalCount);
      const blob = await buildExportCsv(
        fileHash,
        capIndicesForFreeExport(indices, totalCount),
        totalCount
      );

      // The modal is gone once dismissed; the filename is still in the
      // Downloads folder next week saying the file stops short.
      const savedFilename = `${filename}${capped ? '-sample' : ''}.csv`;
      downloadBlob(blob, savedFilename);
      // One name, used for the file and for whatever names it back. A receipt
      // pointing at a different file than the one on disk is worse than none.
      setSaved({ filename: savedFilename, total: rowCount, capped });
      analytics.freeExportDownload(capped);

      if (capped) {
        analytics.paywallView();
        setIsPaywallOpen(true);
      }
    } catch {
      setHasError(true);
      analytics.exportError('csv');
    } finally {
      isRunningRef.current = false;
      setIsBusy(false);
    }
  };

  // Reached from the paywall only. A standing "Already purchased?" link beside
  // the trigger was shown to every reader, of whom none had purchased, and it
  // disclosed that the product is paid from under a button that says "Export".
  // The cost of moving it: a buyer setting up a second device now takes one
  // unwanted ten-row sample on the way here. Acceptable, because the purchase
  // email's ?license_key= link activates on its own — manual entry only serves
  // the device that does not have that email open.
  const openLicenseDialog = (): void => {
    setIsPaywallOpen(false);
    setIsLicenseDialogOpen(true);
  };

  const handleDownloadClick = (): void => {
    if (isRunningRef.current) return;
    analytics.exportClick(isUnlocked);
    if (isUnlocked) {
      setIsExportDialogOpen(true);
      return;
    }
    void runFreeExport();
  };

  return (
    <>
      {/* No aria-label: the visible text is the accessible name. An aria-label
          would silently replace it, leaving a voice-control user saying the
          words on the button and matching nothing (WCAG 2.5.3 Label in Name).
          `min-h-11` keeps the 44px touch target the icon button got from its
          padding. */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <Button
          ref={triggerRef}
          onClick={handleDownloadClick}
          onMouseEnter={preloadModal}
          onFocus={preloadModal}
          disabled={isBusy}
          aria-busy={isBusy}
          variant="outline"
          className="h-auto min-h-11 gap-2 rounded-2xl px-4 py-2.5 font-semibold"
        >
          <Download size={18} />
          {t('export.trigger')}
        </Button>
        {/* A dead click is the worst outcome at the narrowest step of the
            funnel, and IndexedDB here has a known hang with no timeout. Reuses
            the export dialog's message rather than adding a tenth translation
            of the same sentence. */}
        {hasError && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {t('export.dialog.error')}
          </p>
        )}

        {/* The uncapped path opens no paywall, so without this a click produces
            a file and nothing else — and on iOS Safari, where the download can
            be silent, possibly nothing at all as far as the reader can tell.
            The capped path says the same thing inside the paywall instead. */}
        {saved && !saved.capped && (
          <p
            role="status"
            className="max-w-[16rem] text-end text-xs break-words text-muted-foreground"
          >
            {t('export.saved.full', {
              filename: saved.filename,
              total: saved.total.toLocaleString(i18n.language),
            })}
          </p>
        )}
      </div>

      <Suspense fallback={null}>
        {isPaywallOpen && saved ? (
          <PaywallModal
            open={isPaywallOpen}
            onOpenChange={setIsPaywallOpen}
            onCheckout={startCheckout}
            onManualEntry={openLicenseDialog}
            savedFilename={saved.filename}
            totalRows={saved.total}
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

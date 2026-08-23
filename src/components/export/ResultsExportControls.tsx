import { Download } from 'lucide-react';
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useAdViewability } from '@/hooks/useAdViewability';
import { useProExport } from '@/hooks/useProExport';
import { downloadBlob } from '@/lib/export/download';
import { registerExportOpener } from '@/lib/export/export-opener';
import {
  capIndicesForFreeExport,
  FREE_EXPORT_ROWS,
  isFreeExportCapped,
} from '@/lib/export/free-tier';
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
  const { isEnabled, isUnlocked, checkoutState, startCheckout, resetCheckout } = useProExport();
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

  // The redirect back from checkout is captured in Layout, which cannot reach
  // this state — see lib/export/export-opener.ts. Registering here is what lets
  // that dialog end in "Choose a format" instead of a closed sheet, which is
  // the one activation path a buyer who has actually paid takes.
  //
  // Above the early return for the same reason as useAdViewability: the hook
  // count may not change when `isEnabled` flips. Guarded rather than skipped —
  // with the feature off there is no format dialog to hand anything to, and a
  // registration would make the other side offer a button that opens nothing.
  useEffect(() => {
    if (!isEnabled) return;
    return registerExportOpener(() => setIsExportDialogOpen(true));
  }, [isEnabled]);

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
    // The reader already has this file. 59 sessions collected two or more
    // unrequested sample CSVs and one collected nine, because nothing
    // remembered that the ten rows had already been written. The paywall
    // still opens — the offer is not what is being capped — but it opens
    // against the receipt that exists rather than making another.
    //
    // `saved.total === rowCount` is the test for "same view". It is a proxy:
    // two different filters can select the same number of rows, in which
    // case the reader gets the earlier file's receipt. The cost of that
    // collision is one stale filename in a modal; the cost of getting it
    // wrong the other way is another unwanted file.
    //
    // Two more limits on this guard, both deliberate:
    // - `saved` is component state (`useState`), so the cap only holds within
    //   one mount. Navigating off `/results` and back resets it, and a repeat
    //   press there writes a second file.
    // - The guard also requires `saved.capped`, so it covers capped views
    //   only. An uncapped view — a small list where the free file is the
    //   whole export and no paywall ever appears — is not covered at all;
    //   repeat presses there still rebuild and re-download. That is outside
    //   the measured harm (the repeat downloads seen were all capped sample
    //   CSVs), so the narrower scope is intentional, just unwritten until now.
    if (saved !== null && saved.capped && saved.total === rowCount) {
      analytics.paywallView(i18n.language, rowCount);
      setIsPaywallOpen(true);
      return;
    }

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
        analytics.paywallView(i18n.language, rowCount);
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

  // Passed to the dialog's onOpenChange, which Radix calls only for the X
  // button, Escape, and an overlay click — the three ways a reader leaves
  // without choosing anything. `onCheckout` navigates away without touching
  // this prop, and `onManualEntry` above closes the paywall by calling
  // `setIsPaywallOpen` directly rather than through this handler, so neither
  // purchase path is at risk of also counting as a dismiss.
  const handlePaywallOpenChange = (open: boolean): void => {
    // `saved` is what the modal's headline counts, so it is what the dismiss
    // reports; no `saved` means no modal, and therefore nothing to dismiss.
    if (!open && saved) {
      analytics.paywallDismiss(i18n.language, saved.total);
      // The modal is what draws the checkout state, so a dismissal has to clear
      // it. Without this a reader who leaves during a slow redirect and reopens
      // the paywall meets a disabled button explaining a checkout they already
      // walked away from.
      resetCheckout();
    }
    setIsPaywallOpen(open);
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
        {/* Filled primary, and it is only honest because of Phase 2. While the
            click opened an invoice, the loudest button on the page would have
            been a lure: maximum pull toward a paywall the reader had been given
            no reason to trust. Since the click builds and hands over a real
            ten-row CSV first — and the paywall appears afterwards, only when
            the file was actually capped — the loudest action here is a free one
            that delivers. Revert Phase 2 and this treatment has to go back to
            `outline` in the same commit.

            The text colour used to be overridden here, because
            `--primary-foreground` on `--primary` measured 3.95:1 in light mode
            and this 14px label needs 4.5:1. That premise is gone: the token was
            flipped to near-black in both themes, so the variant's own pairing
            now measures 5.00:1 flat and 5.85:1 on hover. Keeping the override
            would leave this button the one element in the app that does not
            read its colour from the variant — which is how the next palette
            change silently misses it. */}
        <Button
          ref={triggerRef}
          onClick={handleDownloadClick}
          onMouseEnter={preloadModal}
          onFocus={preloadModal}
          disabled={isBusy}
          aria-busy={isBusy}
          variant="default"
          className="h-auto min-h-11 gap-2 rounded-2xl px-4 py-2.5 font-bold"
        >
          <Download size={18} />
          {t('export.trigger')}
        </Button>
        {/* Answers the one uncertainty a reader has before the first click:
            what it costs. Gone the moment there is evidence either way — once
            unlocked (the operator's rule: a buyer told their click is free is
            being told something irrelevant), and once a receipt is on screen
            (this seat's addition: an uncapped receipt says "all {{total}}
            rows" right below, and "the first {{rows}}" above it would then be
            false). $7 stays out of this line on purpose — see
            `runFreeExport`'s docstring above. */}
        {!isUnlocked && !saved && (
          <p className="text-end text-xs text-muted-foreground">
            {t('export.freeHint', { rows: FREE_EXPORT_ROWS })}
          </p>
        )}
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
            onOpenChange={handlePaywallOpenChange}
            onCheckout={() => startCheckout(i18n.language, saved.total)}
            onManualEntry={openLicenseDialog}
            savedFilename={saved.filename}
            totalRows={saved.total}
            checkoutState={checkoutState}
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
            onContinue={() => {
              setIsLicenseDialogOpen(false);
              setIsExportDialogOpen(true);
            }}
          />
        ) : null}
      </Suspense>
    </>
  );
}

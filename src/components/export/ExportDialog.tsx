import { Check, CircleAlert, FileJson, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExportSheet } from '@/components/export/ExportSheet';
import { RevokedLicenseNotice, SupportMailtoLink } from '@/components/export/RevokedLicenseNotice';
import { useExportWorker } from '@/hooks/useExportWorker';
import { downloadBlob } from '@/lib/export/download';
import { validateLicense } from '@/lib/export/license';
import type { ExportFormat, ExportProgress } from '@/lib/export/types';
import {
  clearLicense,
  getStoredLicense,
  markValidatedThisSession,
  shouldValidateThisSession,
} from '@/lib/export/unlock';
import { analytics } from '@/lib/stats';

export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileHash: string;
  indices: number[] | null;
  rowCount: number;
  filename: string;
}

function toPercent(progress: ExportProgress | null): number {
  if (!progress || progress.total === 0) return 0;
  return Math.min(100, Math.round((progress.processed / progress.total) * 100));
}

// Progress fires roughly once per 1000 rows (CHUNK_SIZE in lib/export/data.ts), which
// is on the order of a thousand `onProgress` calls for a 1M-row export. The bar above
// stays at full resolution — it is aria-hidden and visual-only — but a screen reader
// announcing every one of those calls would be unusable. Rounding to the nearest 10%
// before it reaches the live region means the announced text only changes on a real
// milestone, so the DOM text is unchanged (and nothing is announced) between them.
function toMilestonePercent(progress: ExportProgress | null): number {
  return Math.floor(toPercent(progress) / 10) * 10;
}

export function ExportDialog({
  open,
  onOpenChange,
  fileHash,
  indices,
  rowCount,
  filename,
}: ExportDialogProps) {
  const { t, i18n } = useTranslation('results');
  const { buildExport } = useExportWorker();
  const [pendingFormat, setPendingFormat] = useState<ExportFormat | null>(null);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [hasFailed, setHasFailed] = useState(false);
  const [isRevoked, setIsRevoked] = useState(false);
  const [savedFilename, setSavedFilename] = useState<string | null>(null);

  // The export stays usable while this runs: validate is bounded at 4s, and
  // blocking both buttons on it would leave a paying user staring at two
  // disabled buttons on a slow connection to defend against the narrow case
  // of a license disabled within that same window. The design already fails
  // open on every ambiguous answer, so nothing here can hand out the file to
  // someone who did not pay — it can only ever revoke.
  useEffect(() => {
    if (!shouldValidateThisSession()) return;

    const license = getStoredLicense();
    if (license === null) return;

    let isCurrent = true;

    void validateLicense(license.key, license.instanceId).then(result => {
      // Fail open: only an explicit negative revokes. A network problem must not
      // take the export away from someone who paid for it.
      const revoked = !result.ok && (result.reason === 'disabled' || result.reason === 'not_found');
      if (revoked) {
        clearLicense();
        analytics.licenseRevoked();
      }
      // Act on the verdict even if the dialog was closed before this resolved —
      // skipping it would let a revoked license keep working for the rest of
      // the browser session, since shouldValidateThisSession() only allows one
      // check per session. Only the React state update below is conditional.
      markValidatedThisSession();
      if (!isCurrent) return;
      if (revoked) setIsRevoked(true);
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  const handleExport = async (format: ExportFormat): Promise<void> => {
    setPendingFormat(format);
    setHasFailed(false);
    setProgress(null);

    try {
      const blob = await buildExport(format, fileHash, indices, rowCount, setProgress);

      const outputName = `${filename}.${format}`;
      downloadBlob(blob, outputName);
      analytics.download(format, rowCount);
      // Not onOpenChange(false). A blob download on iOS Safari can be silent, and 85%
      // of sessions are mobile — closing the dialog leaves a reader who has paid with
      // no statement that a file exists at all.
      setSavedFilename(outputName);
    } catch {
      // A paid export failing silently is the worst outcome — surface it and
      // leave the dialog open so the user can retry.
      setHasFailed(true);
      analytics.exportError(format);
    } finally {
      setPendingFormat(null);
      setProgress(null);
    }
  };

  const isPending = pendingFormat !== null;

  const renderIcon = (format: ExportFormat) => {
    if (pendingFormat === format) {
      // Wrapper div, not the svg: browsers hardware-accelerate transforms on
      // regular elements but not reliably on SVG nodes.
      return (
        <div className="animate-spin">
          <Loader2 className="h-4 w-4" />
        </div>
      );
    }
    return format === 'csv' ? (
      <FileSpreadsheet className="h-4 w-4" />
    ) : (
      <FileJson className="h-4 w-4" />
    );
  };

  // One screen at a time, and the header is the screen. Before this the sheet drew a
  // permanent "Export accounts" header and stacked the state's own header underneath
  // it, so the build screen carried two titles and the success screen still announced
  // itself as the offer the reader had already accepted. Precedence is the order a
  // reader travels: a file already written outranks everything, a build in flight
  // outranks a revocation that arrived while it ran (the file is not taken back
  // mid-write), and revocation outranks the offer.
  const view =
    savedFilename !== null ? 'saved' : isPending ? 'building' : isRevoked ? 'revoked' : 'idle';

  return (
    <ExportSheet open={open} onOpenChange={onOpenChange}>
      {/* `text-start` everywhere in this flow, overriding DialogHeader's
          `text-center sm:text-start`. Below 640px — 85% of sessions — the base rule
          centred this title while every body under it was left-aligned, and on a
          full-width bottom sheet that misalignment is the first thing visible. */}
      {view === 'idle' ? (
        <DialogHeader className="text-start pe-8">
          <DialogTitle>{t('export.dialog.title')}</DialogTitle>
          <DialogDescription>{t('export.dialog.rowCount', { count: rowCount })}</DialogDescription>
        </DialogHeader>
      ) : null}

      {view === 'building' ? (
        <div className="flex flex-col gap-3">
          <DialogHeader className="text-start pe-8">
            <DialogTitle>{t('export.dialog.buildingTitle')}</DialogTitle>
            <DialogDescription>{t('export.dialog.buildingNote')}</DialogDescription>
          </DialogHeader>

          {/* aria-hidden, and the sr-only status below carries the same fact in
              words: a bar read aloud is a shape nobody can see. Same split the
              paywall's proportion bar uses. */}
          <div aria-hidden="true" className="flex h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="shrink-0 bg-primary transition-[width] duration-200"
              style={{ width: `${toPercent(progress)}%` }}
            />
          </div>

          {/* The one visible statement of progress. The bar shows the proportion and
              this shows the count, which is the part the bar cannot say; the percentage
              was a third rendering of the same fact and is now announced only.
              `tabular-nums` because this figure changes about once per 1000 rows and
              proportional digits make the whole line shift on every tick. */}
          <p className="text-xs tabular-nums text-muted-foreground">
            {t('export.dialog.progress', {
              done: (progress?.processed ?? 0).toLocaleString(i18n.language),
              total: rowCount.toLocaleString(i18n.language),
            })}
          </p>

          <p role="status" aria-live="polite" className="sr-only">
            {t('export.dialog.generating', { percent: toMilestonePercent(progress) })}
          </p>
        </div>
      ) : null}

      {view === 'saved' && savedFilename !== null ? (
        <div role="status" aria-live="polite" className="flex flex-col gap-3">
          <DialogHeader className="text-start pe-8">
            {/* The same emerald check the paywall's receipt uses, so "a file exists"
                looks identical wherever the reader meets it. The icon adds no text, so
                the accessible name Radix builds from this title is unchanged. */}
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 shrink-0 text-emerald-500" />
              {t('export.dialog.savedTitle')}
            </DialogTitle>
            <DialogDescription className="break-words">
              {t('export.dialog.savedBody', {
                filename: savedFilename,
                total: rowCount.toLocaleString(i18n.language),
              })}
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs leading-normal text-muted-foreground">
            {t('export.dialog.savedWhere')}
          </p>
        </div>
      ) : null}

      {/* Reuses LicenseDialog's revoked screen rather than a bare red sentence: a
          licence disabled mid-session is the same dead end as one that never
          activated, and the mailto-support footer below is the only action that
          resolves either. It brings its own header, which is now the sheet's only
          title in this state. Shown only ahead of a first save — a file already
          delivered this session is not retroactively taken away. */}
      {view === 'revoked' ? <RevokedLicenseNotice /> : null}

      {hasFailed && view === 'idle' ? (
        <p role="alert" className="flex items-start gap-2 text-sm leading-normal text-destructive">
          {/* Same icon the two terminal licence screens wear, so a failure is
              recognisable as one before the sentence is read — the counterpart to
              the emerald check on the receipt. */}
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0">{t('export.dialog.error')}</span>
        </p>
      ) : null}

      <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
        {view === 'idle' || view === 'building' ? (
          <>
            <Button
              variant="outline"
              size="lg"
              className="min-h-12 flex-col items-start gap-0.5 rounded-2xl py-2 text-start"
              disabled={isPending}
              aria-busy={pendingFormat === 'csv'}
              onClick={() => void handleExport('csv')}
            >
              <span className="flex items-center gap-2 font-bold">
                {renderIcon('csv')}
                {t('export.dialog.csv')}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {t('export.dialog.csvHint')}
              </span>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="min-h-12 flex-col items-start gap-0.5 rounded-2xl py-2 text-start"
              disabled={isPending}
              aria-busy={pendingFormat === 'json'}
              onClick={() => void handleExport('json')}
            >
              <span className="flex items-center gap-2 font-bold">
                {renderIcon('json')}
                {t('export.dialog.json')}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {t('export.dialog.jsonHint')}
              </span>
            </Button>
          </>
        ) : null}

        {view === 'revoked' ? <SupportMailtoLink /> : null}

        {view === 'saved' ? (
          <>
            {/* "Export again" is the whole point of having paid (design.md §4.4), so
                it is the primary action and comes first — matching both the paywall's
                CTA-then-dismiss order and LicenseDialog's own primary-first footer. */}
            <Button
              size="lg"
              className="min-h-12 rounded-2xl font-bold"
              onClick={() => setSavedFilename(null)}
            >
              {t('export.dialog.again')}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="min-h-12 rounded-2xl font-bold"
              onClick={() => onOpenChange(false)}
            >
              {t('export.dialog.done')}
            </Button>
          </>
        ) : null}
      </DialogFooter>
    </ExportSheet>
  );
}

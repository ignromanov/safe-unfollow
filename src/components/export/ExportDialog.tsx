import { FileJson, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExportSheet } from '@/components/export/ExportSheet';
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

  return (
    <ExportSheet open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{t('export.dialog.title')}</DialogTitle>
        <DialogDescription>{t('export.dialog.rowCount', { count: rowCount })}</DialogDescription>
      </DialogHeader>

      {isPending ? (
        <div className="flex flex-col gap-3">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>{t('export.dialog.buildingTitle')}</DialogTitle>
            <DialogDescription>{t('export.dialog.buildingNote')}</DialogDescription>
          </DialogHeader>

          {/* aria-hidden, and the role="status" line below carries the same fact in
              words: a bar read aloud is a shape nobody can see. Same split the
              paywall's proportion bar uses. */}
          <div aria-hidden="true" className="flex h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="shrink-0 bg-primary transition-[width] duration-200"
              style={{ width: `${toPercent(progress)}%` }}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {t('export.dialog.progress', {
              done: (progress?.processed ?? 0).toLocaleString(i18n.language),
              total: rowCount.toLocaleString(i18n.language),
            })}
          </p>
        </div>
      ) : null}

      {isPending ? (
        <div role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
          {t('export.dialog.generating', { percent: toPercent(progress) })}
        </div>
      ) : null}

      {savedFilename !== null ? (
        <div role="status" aria-live="polite" className="flex flex-col gap-3">
          <DialogHeader className="text-start sm:text-start">
            <DialogTitle>{t('export.dialog.savedTitle')}</DialogTitle>
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

      {hasFailed ? (
        <p role="alert" className="text-sm text-destructive">
          {t('export.dialog.error')}
        </p>
      ) : null}

      {isRevoked ? (
        <p role="alert" className="text-sm text-destructive">
          {t('export.license.revoked')}
        </p>
      ) : null}

      <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
        {savedFilename === null ? (
          <>
            <Button
              variant="outline"
              size="lg"
              className="min-h-12 flex-col items-start gap-0.5 py-2 text-start"
              disabled={isPending || isRevoked}
              aria-busy={pendingFormat === 'csv'}
              onClick={() => void handleExport('csv')}
            >
              <span className="flex items-center gap-2 font-semibold">
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
              className="min-h-12 flex-col items-start gap-0.5 py-2 text-start"
              disabled={isPending || isRevoked}
              aria-busy={pendingFormat === 'json'}
              onClick={() => void handleExport('json')}
            >
              <span className="flex items-center gap-2 font-semibold">
                {renderIcon('json')}
                {t('export.dialog.json')}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {t('export.dialog.jsonHint')}
              </span>
            </Button>
          </>
        ) : null}

        {savedFilename !== null ? (
          <>
            <Button size="lg" className="min-h-12" onClick={() => onOpenChange(false)}>
              {t('export.dialog.done')}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="min-h-12"
              onClick={() => setSavedFilename(null)}
            >
              {t('export.dialog.again')}
            </Button>
          </>
        ) : null}
      </DialogFooter>
    </ExportSheet>
  );
}

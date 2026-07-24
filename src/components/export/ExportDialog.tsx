import { FileJson, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  const { t } = useTranslation('results');
  const { buildExport } = useExportWorker();
  const [pendingFormat, setPendingFormat] = useState<ExportFormat | null>(null);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [hasFailed, setHasFailed] = useState(false);
  const [isRevoked, setIsRevoked] = useState(false);

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

      downloadBlob(blob, `${filename}.${format}`);
      analytics.download(format, rowCount);
      onOpenChange(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('export.dialog.title')}</DialogTitle>
          <DialogDescription>{t('export.dialog.rowCount', { count: rowCount })}</DialogDescription>
        </DialogHeader>

        <div role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
          {isPending ? t('export.dialog.generating', { percent: toPercent(progress) }) : ''}
        </div>

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
          <Button
            variant="outline"
            size="lg"
            disabled={isPending || isRevoked}
            aria-busy={pendingFormat === 'csv'}
            onClick={() => void handleExport('csv')}
          >
            {renderIcon('csv')}
            {t('export.dialog.csv')}
          </Button>
          <Button
            variant="outline"
            size="lg"
            disabled={isPending || isRevoked}
            aria-busy={pendingFormat === 'json'}
            onClick={() => void handleExport('json')}
          >
            {renderIcon('json')}
            {t('export.dialog.json')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

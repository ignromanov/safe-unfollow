import { FileJson, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useState } from 'react';
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
import { buildExportCsv } from '@/lib/export/csv';
import { buildExportJson } from '@/lib/export/json';
import { downloadBlob } from '@/lib/export/download';
import { analytics } from '@/lib/stats';

export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileHash: string;
  indices: number[] | null;
  rowCount: number;
  filename: string;
}

type ExportFormat = 'csv' | 'json';

export function ExportDialog({
  open,
  onOpenChange,
  fileHash,
  indices,
  rowCount,
  filename,
}: ExportDialogProps) {
  const { t } = useTranslation('results');
  const [pendingFormat, setPendingFormat] = useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat): Promise<void> => {
    setPendingFormat(format);
    try {
      const blob =
        format === 'csv'
          ? await buildExportCsv(fileHash, indices, rowCount)
          : await buildExportJson(fileHash, indices, rowCount);

      downloadBlob(blob, `${filename}.${format}`);
      analytics.download(format, rowCount);
      onOpenChange(false);
    } finally {
      setPendingFormat(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('export.dialog.title')}</DialogTitle>
          <DialogDescription>{t('export.dialog.rowCount', { count: rowCount })}</DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
          <Button
            variant="outline"
            size="lg"
            disabled={pendingFormat !== null}
            onClick={() => void handleExport('csv')}
          >
            {pendingFormat === 'csv' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            {t('export.dialog.csv')}
          </Button>
          <Button
            variant="outline"
            size="lg"
            disabled={pendingFormat !== null}
            onClick={() => void handleExport('json')}
          >
            {pendingFormat === 'json' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileJson className="h-4 w-4" />
            )}
            {t('export.dialog.json')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

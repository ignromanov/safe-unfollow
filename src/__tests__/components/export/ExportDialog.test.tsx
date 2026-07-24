import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import resultsEN from '@/locales/en/results.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(resultsEN));

const buildExport = vi.fn();
vi.mock('@/hooks/useExportWorker', () => ({
  useExportWorker: () => ({ buildExport }),
}));

vi.mock('@/lib/export/download', () => ({ downloadBlob: vi.fn() }));

vi.mock('@/lib/stats', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/stats')>();
  return {
    ...actual,
    analytics: { ...actual.analytics, download: vi.fn(), exportError: vi.fn() },
  };
});

import { ExportDialog } from '@/components/export/ExportDialog';
import { downloadBlob } from '@/lib/export/download';
import { analytics } from '@/lib/stats';

const blob = new Blob(['csv'], { type: 'text/csv;charset=utf-8' });

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  fileHash: 'hash1',
  indices: null,
  rowCount: 42,
  filename: 'my-export',
};

describe('ExportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildExport.mockResolvedValue(blob);
  });

  it('should download the generated file when a format is chosen', async () => {
    const user = userEvent.setup();
    render(<ExportDialog {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: resultsEN.export.dialog.csv }));

    await waitFor(() => {
      expect(vi.mocked(downloadBlob)).toHaveBeenCalledWith(blob, 'my-export.csv');
    });
    expect(vi.mocked(analytics.download)).toHaveBeenCalledWith('csv', 42);
  });

  it('should close the dialog after a successful export', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<ExportDialog {...defaultProps} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole('button', { name: resultsEN.export.dialog.json }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  // A silent failure is the worst outcome here: the user has paid and gets
  // nothing back, with no explanation and no retry.
  it('should show an error and keep the dialog open when generation fails', async () => {
    buildExport.mockRejectedValueOnce(new Error('idb exploded'));
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<ExportDialog {...defaultProps} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole('button', { name: resultsEN.export.dialog.csv }));

    expect(await screen.findByRole('alert')).toHaveTextContent(resultsEN.export.dialog.error);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(vi.mocked(downloadBlob)).not.toHaveBeenCalled();
  });

  it('should report the failure to analytics', async () => {
    buildExport.mockRejectedValueOnce(new Error('idb exploded'));
    const user = userEvent.setup();
    render(<ExportDialog {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: resultsEN.export.dialog.csv }));

    await waitFor(() => {
      expect(vi.mocked(analytics.exportError)).toHaveBeenCalledWith('csv');
    });
  });

  it('should let the user retry after a failure', async () => {
    buildExport.mockRejectedValueOnce(new Error('idb exploded'));
    const user = userEvent.setup();
    render(<ExportDialog {...defaultProps} />);

    const csvButton = screen.getByRole('button', { name: resultsEN.export.dialog.csv });
    await user.click(csvButton);
    await screen.findByRole('alert');

    await user.click(csvButton);

    await waitFor(() => {
      expect(vi.mocked(downloadBlob)).toHaveBeenCalledWith(blob, 'my-export.csv');
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should mark the pressed button as busy while generating', async () => {
    let resolveBuild: (value: Blob) => void = () => {};
    buildExport.mockImplementationOnce(
      () =>
        new Promise<Blob>(resolve => {
          resolveBuild = resolve;
        })
    );
    const user = userEvent.setup();
    render(<ExportDialog {...defaultProps} />);

    const csvButton = screen.getByRole('button', { name: resultsEN.export.dialog.csv });
    await user.click(csvButton);

    expect(csvButton).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: resultsEN.export.dialog.json })).toBeDisabled();

    resolveBuild(blob);
    await waitFor(() => {
      expect(csvButton).toHaveAttribute('aria-busy', 'false');
    });
  });

  it('should announce generation progress in a live region', async () => {
    buildExport.mockImplementationOnce(
      async (
        _format: string,
        _hash: string,
        _indices: number[] | null,
        _total: number,
        onProgress?: (p: { processed: number; total: number }) => void
      ) => {
        onProgress?.({ processed: 21, total: 42 });
        return blob;
      }
    );
    const user = userEvent.setup();
    render(<ExportDialog {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: resultsEN.export.dialog.csv }));

    const status = await screen.findByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });
});

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

vi.mock('@/lib/export/license', () => ({ validateLicense: vi.fn() }));

vi.mock('@/lib/stats', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/stats')>();
  return {
    ...actual,
    analytics: {
      ...actual.analytics,
      download: vi.fn(),
      exportError: vi.fn(),
      licenseRevoked: vi.fn(),
    },
  };
});

import { ExportDialog } from '@/components/export/ExportDialog';
import { downloadBlob } from '@/lib/export/download';
import { validateLicense } from '@/lib/export/license';
import {
  getStoredLicense,
  resetUnlockCache,
  resetValidationFlag,
  storeLicense,
} from '@/lib/export/unlock';
import { analytics } from '@/lib/stats';

const blob = new Blob(['csv'], { type: 'text/csv;charset=utf-8' });

// Each format button now carries a second line explaining what the format is
// for (Step 7), which becomes part of its accessible name — so lookups match
// on the label as a substring rather than the full (label + hint) string.
const csvButtonName = new RegExp(resultsEN.export.dialog.csv, 'i');
const jsonButtonName = new RegExp(resultsEN.export.dialog.json, 'i');

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

    await user.click(screen.getByRole('button', { name: csvButtonName }));

    await waitFor(() => {
      expect(vi.mocked(downloadBlob)).toHaveBeenCalledWith(blob, 'my-export.csv');
    });
    expect(vi.mocked(analytics.download)).toHaveBeenCalledWith('csv', 42);
  });

  it('should confirm the file instead of closing', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    buildExport.mockResolvedValue(new Blob(['a,b']));

    render(<ExportDialog {...defaultProps} onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole('button', { name: csvButtonName }));

    expect(await screen.findByText(resultsEN.export.dialog.savedTitle)).toBeInTheDocument();
    expect(screen.getByText(/\.csv/)).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(downloadBlob).toHaveBeenCalledOnce();
  });

  // A silent failure is the worst outcome here: the user has paid and gets
  // nothing back, with no explanation and no retry.
  it('should show an error and keep the dialog open when generation fails', async () => {
    buildExport.mockRejectedValueOnce(new Error('idb exploded'));
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<ExportDialog {...defaultProps} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole('button', { name: csvButtonName }));

    expect(await screen.findByRole('alert')).toHaveTextContent(resultsEN.export.dialog.error);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(vi.mocked(downloadBlob)).not.toHaveBeenCalled();
  });

  it('should report the failure to analytics', async () => {
    buildExport.mockRejectedValueOnce(new Error('idb exploded'));
    const user = userEvent.setup();
    render(<ExportDialog {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: csvButtonName }));

    await waitFor(() => {
      expect(vi.mocked(analytics.exportError)).toHaveBeenCalledWith('csv');
    });
  });

  it('should let the user retry after a failure', async () => {
    buildExport.mockRejectedValueOnce(new Error('idb exploded'));
    const user = userEvent.setup();
    render(<ExportDialog {...defaultProps} />);

    const csvButton = screen.getByRole('button', { name: csvButtonName });
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

    const csvButton = screen.getByRole('button', { name: csvButtonName });
    await user.click(csvButton);

    expect(csvButton).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: jsonButtonName })).toBeDisabled();

    // The busy button itself is replaced by the receipt on success (Step 6/7)
    // rather than flipping back to idle, so what "no longer busy" means here
    // is the receipt taking its place.
    resolveBuild(blob);
    await waitFor(() => {
      expect(screen.getByText(resultsEN.export.dialog.savedTitle)).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: csvButtonName }));

    const status = await screen.findByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  describe('per-session validation', () => {
    beforeEach(() => {
      localStorage.clear();
      resetUnlockCache();
      resetValidationFlag();
      storeLicense('38b1460a-5104-4067-a91d-77b872934d51', 'f90ec370-fd83-46a5-8bbd-44a241e78665');
    });

    it('should keep the export available when validation fails on the network', async () => {
      vi.mocked(validateLicense).mockResolvedValue({ ok: false, reason: 'network' });

      render(<ExportDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: csvButtonName })).toBeEnabled();
      });
      expect(getStoredLicense()).not.toBeNull();
    });

    it('should revoke the unlock when the license is disabled', async () => {
      vi.mocked(validateLicense).mockResolvedValue({ ok: false, reason: 'disabled' });

      render(<ExportDialog {...defaultProps} />);

      expect(await screen.findByRole('alert')).toHaveTextContent(resultsEN.export.license.revoked);
      expect(getStoredLicense()).toBeNull();
      expect(analytics.licenseRevoked).toHaveBeenCalled();
    });

    it('should not block the export buttons while validation is in flight', async () => {
      // Never resolves within the test — proves the buttons don't wait for it.
      vi.mocked(validateLicense).mockImplementationOnce(() => new Promise(() => {}));

      render(<ExportDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: csvButtonName })).toBeEnabled();
      expect(screen.getByRole('button', { name: jsonButtonName })).toBeEnabled();
    });

    it('should clear a revoked license even if the dialog unmounts before validation resolves', async () => {
      // Closing the dialog within the 4s validate window must not let a
      // revoked license keep working for the rest of the session — only the
      // React state update (which would touch an unmounted component) is
      // allowed to be skipped, not the revocation itself.
      let resolveValidate: (result: { ok: false; reason: 'disabled' }) => void = () => {};
      vi.mocked(validateLicense).mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveValidate = resolve;
          })
      );

      const { unmount } = render(<ExportDialog {...defaultProps} />);
      unmount();

      resolveValidate({ ok: false, reason: 'disabled' });

      await waitFor(() => {
        expect(getStoredLicense()).toBeNull();
      });
      expect(analytics.licenseRevoked).toHaveBeenCalled();
    });

    it('should validate only once per session', async () => {
      vi.mocked(validateLicense).mockResolvedValue({ ok: true });

      const first = render(<ExportDialog {...defaultProps} />);
      await waitFor(() => expect(validateLicense).toHaveBeenCalledTimes(1));
      first.unmount();

      render(<ExportDialog {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: csvButtonName })).toBeEnabled();
      });
      expect(validateLicense).toHaveBeenCalledTimes(1);
    });
  });

  it('should tell the reader what each format is for', () => {
    render(<ExportDialog {...defaultProps} />);
    expect(screen.getByText(resultsEN.export.dialog.csvHint)).toBeInTheDocument();
    expect(screen.getByText(resultsEN.export.dialog.jsonHint)).toBeInTheDocument();
  });

  it('should offer another export from the receipt', async () => {
    const user = userEvent.setup();
    buildExport.mockResolvedValue(new Blob(['a,b']));

    render(<ExportDialog {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: csvButtonName }));
    await user.click(await screen.findByRole('button', { name: resultsEN.export.dialog.again }));

    expect(screen.getByRole('button', { name: csvButtonName })).toBeInTheDocument();
  });
});

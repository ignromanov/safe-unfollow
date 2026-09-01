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

  // The sheet used to draw a permanent "Export accounts" header and stack each
  // state's own header under it, so the build and receipt screens carried two
  // DialogTitles — ambiguous `aria-labelledby` (GH#140), and visibly a stale
  // headline over the screen that replaced it. The header is the state now, and
  // this is the assertion that keeps it that way.
  describe('one title per state', () => {
    it('should show only the offer title while idle', () => {
      render(<ExportDialog {...defaultProps} />);

      expect(screen.getAllByRole('heading')).toHaveLength(1);
      expect(screen.getByRole('heading')).toHaveTextContent(resultsEN.export.dialog.title);
    });

    it('should replace the offer title with the receipt, not stack them', async () => {
      const user = userEvent.setup();
      render(<ExportDialog {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: csvButtonName }));

      await waitFor(() => {
        expect(screen.getByRole('heading')).toHaveTextContent(resultsEN.export.dialog.savedTitle);
      });
      expect(screen.getAllByRole('heading')).toHaveLength(1);
      expect(screen.queryByText(resultsEN.export.dialog.title)).not.toBeInTheDocument();
    });

    // The build screen is the state the reader looks at longest, and it was one
    // of the two that stacked a second title before ddc5661. Nothing asserted it
    // afterwards: the two tests above cover the states either side of it.
    it('should replace the offer title while the file is being built', async () => {
      buildExport.mockImplementation(() => new Promise(() => {}));
      const user = userEvent.setup();
      render(<ExportDialog {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: csvButtonName }));

      await waitFor(() => {
        expect(screen.getByRole('heading')).toHaveTextContent(
          resultsEN.export.dialog.buildingTitle
        );
      });
      expect(screen.getAllByRole('heading')).toHaveLength(1);
    });

    // The fourth view, and the only one whose title comes from another file
    // (RevokedLicenseNotice, shared with LicenseDialog) — so a change there can
    // break this dialog with nothing in either file to show it.
    it('should replace the offer title with the revocation notice', async () => {
      localStorage.clear();
      resetUnlockCache();
      resetValidationFlag();
      storeLicense('38b1460a-5104-4067-a91d-77b872934d51', 'f90ec370-fd83-46a5-8bbd-44a241e78665');
      vi.mocked(validateLicense).mockResolvedValue({ ok: false, reason: 'disabled' });

      render(<ExportDialog {...defaultProps} />);

      expect(await screen.findByText(resultsEN.export.license.revokedTitle)).toBeInTheDocument();
      expect(screen.getAllByRole('heading')).toHaveLength(1);
      expect(screen.queryByText(resultsEN.export.dialog.title)).not.toBeInTheDocument();
    });
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

  it('should round the announced progress to 10% steps instead of every chunk', async () => {
    // Progress fires roughly once per 1000 rows — a thousand-plus calls on a
    // large export. The announced text must only change on a real milestone, or
    // a screen reader hears one announcement per chunk.
    let resolveBuild: (value: Blob) => void = () => {};
    buildExport.mockImplementationOnce(
      (
        _format: string,
        _hash: string,
        _indices: number[] | null,
        _total: number,
        onProgress?: (p: { processed: number; total: number }) => void
      ) => {
        onProgress?.({ processed: 1, total: 1000 }); // 0.1% -> milestone 0
        onProgress?.({ processed: 25, total: 1000 }); // 2.5% -> milestone 0
        onProgress?.({ processed: 340, total: 1000 }); // 34% -> milestone 30
        return new Promise<Blob>(resolve => {
          resolveBuild = resolve;
        });
      }
    );
    const user = userEvent.setup();
    render(<ExportDialog {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: csvButtonName }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(
      resultsEN.export.dialog.generating.replace('{{percent}}', '30')
    );
    expect(status).not.toHaveTextContent('2%');
    expect(status).not.toHaveTextContent('34%');

    resolveBuild(blob);
    await waitFor(() => {
      expect(screen.getByText(resultsEN.export.dialog.savedTitle)).toBeInTheDocument();
    });
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

      // Full terminal screen, not a red sentence: the format buttons disappear
      // entirely (a paying user with a revoked key cannot start a build that will
      // only fail later) and the one action that can resolve it — email support,
      // key pre-filled via mailto — replaces them.
      expect(await screen.findByRole('alert')).toHaveTextContent(
        resultsEN.export.license.revokedTitle
      );
      expect(screen.queryByRole('button', { name: csvButtonName })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: jsonButtonName })).not.toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: resultsEN.export.license.emailSupport })
      ).toHaveAttribute('href', expect.stringContaining('mailto:refunds@safeunfollow.app'));
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

  it('should make "Export again" the primary action on the receipt, not "Done"', async () => {
    // design.md §4.4: "Export again" is "the whole point of having paid" — the
    // emphasis and order were inverted before this fix (Done was primary and
    // first, Export again was demoted to `variant="outline"` and listed second).
    const user = userEvent.setup();
    buildExport.mockResolvedValue(new Blob(['a,b']));

    render(<ExportDialog {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: csvButtonName }));
    await screen.findByText(resultsEN.export.dialog.savedTitle);

    const buttons = screen.getAllByRole('button');
    const againButton = screen.getByRole('button', { name: resultsEN.export.dialog.again });
    const doneButton = screen.getByRole('button', { name: resultsEN.export.dialog.done });

    expect(buttons.indexOf(againButton)).toBeLessThan(buttons.indexOf(doneButton));
    expect(doneButton.className).toMatch(/\bborder\b/);
  });
});

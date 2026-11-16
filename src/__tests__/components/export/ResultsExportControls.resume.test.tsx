import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import resultsEN from '@/locales/en/results.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

/**
 * The page that a chunk-failure reload produced. The reader had clicked export, the sample
 * was saved, and the paywall never drew. This page reopens what they had asked for.
 */

vi.mock('react-i18next', () => createI18nMock(resultsEN));
vi.mock('@/hooks/useProExport');
vi.mock('@/lib/export/download', () => ({ downloadBlob: vi.fn() }));
const buildExport = vi.fn();
vi.mock('@/hooks/useExportWorker', () => ({ useExportWorker: () => ({ buildExport }) }));
vi.mock('@/lib/stats', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/stats')>();
  return {
    ...actual,
    analytics: {
      ...actual.analytics,
      paywallView: vi.fn(),
      exportTriggerViewable: vi.fn(),
      freeExportDownload: vi.fn(),
    },
  };
});
// Stubbed: the real modals pull in checkout and the worker. What is under test is that the
// controls open them, not what they draw.
vi.mock('@/components/export/PaywallModal', () => ({
  PaywallModal: ({ savedFilename, totalRows }: { savedFilename: string; totalRows: number }) => (
    <div role="dialog">{`paywall ${savedFilename} ${totalRows}`}</div>
  ),
}));
vi.mock('@/components/export/ExportDialog', () => ({
  ExportDialog: () => <div role="dialog">format dialog</div>,
}));

import { ResultsExportControls } from '@/components/export/ResultsExportControls';
import { useProExport } from '@/hooks/useProExport';
import { downloadBlob } from '@/lib/export/download';
import { rememberExportModal, takeExportResume } from '@/lib/export/export-resume';
import { analytics } from '@/lib/stats';

const props = {
  fileHash: 'hash1',
  indices: null,
  totalCount: 42,
  filters: [],
  searchApplied: false,
};
const saved = { filename: 'safeunfollow-sample.html', total: 42, capped: true };

function asReader(isUnlocked: boolean): void {
  vi.mocked(useProExport).mockReturnValue({
    isEnabled: true,
    isUnlocked,
    checkoutState: 'idle',
    startCheckout: vi.fn(),
    resetCheckout: vi.fn(),
  });
}

describe('ResultsExportControls after a chunk-failure reload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('reopens the paywall against the sample already saved, without a second download', async () => {
    asReader(false);
    rememberExportModal({ modal: 'paywall', fileHash: 'hash1', saved });

    render(<ResultsExportControls {...props} />);

    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'paywall safeunfollow-sample.html 42'
    );
    expect(buildExport).not.toHaveBeenCalled();
    expect(downloadBlob).not.toHaveBeenCalled();
    // The view was counted on the click that failed to draw it; one reader, one view.
    expect(analytics.paywallView).not.toHaveBeenCalled();
    // Mounted, so consumed: a later reload of this tab does not reopen it.
    expect(takeExportResume('hash1')).toBeNull();
  });

  it('reopens the format dialog for an unlocked reader', async () => {
    asReader(true);
    rememberExportModal({ modal: 'export', fileHash: 'hash1' });

    render(<ResultsExportControls {...props} />);

    expect(await screen.findByRole('dialog')).toHaveTextContent('format dialog');
  });

  it('opens nothing for another file', () => {
    asReader(false);
    rememberExportModal({ modal: 'paywall', fileHash: 'other', saved });

    render(<ResultsExportControls {...props} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // Written at the click, erased once the modal is up: a normal open must leave nothing
  // behind, or an ordinary reload of /results would pop the paywall at the reader.
  it('leaves nothing behind after a paywall that loaded', async () => {
    asReader(false);
    buildExport.mockResolvedValue(new Blob(['<!doctype html>']));
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    render(<ResultsExportControls {...props} />);

    await user.click(screen.getByRole('button', { name: resultsEN.export.trigger }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(takeExportResume('hash1')).toBeNull();
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import resultsEN from '@/locales/en/results.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

/**
 * The paywall chunk fails to load on the click that should open it.
 *
 * Production, 2026-10-30 → 11-16: 22 `error_boundary` events reading "Importing a module
 * script failed.", 21 of them iOS, almost all on the export → paywall step, and not stale
 * deploys — the chunk was live when it failed. stale-chunk-recovery already reloads the page
 * once, and 19 of those sessions carried on after it. What they saw first was the app-wide
 * "Something went wrong" screen at the step that pays, and after the reload their click was
 * gone. These tests pin both halves of the fix: a quiet failure while the reload is coming,
 * and the open paywall written down so the reloaded page can put it back.
 */

vi.mock('react-i18next', () => createI18nMock(resultsEN));
vi.mock('@/hooks/useProExport');
vi.mock('@/lib/export/download', () => ({ downloadBlob: vi.fn() }));
const buildExport = vi.fn();
vi.mock('@/hooks/useExportWorker', () => ({ useExportWorker: () => ({ buildExport }) }));
vi.mock('@/lib/analytics', () => ({ analytics: { errorBoundary: vi.fn() } }));

let reloadPending = false;
vi.mock('@/lib/stale-chunk-recovery', () => ({
  isStaleChunkReloadPending: () => reloadPending,
}));

// The chunk itself: evaluating this module rejects, exactly as WebKit rejects the import.
vi.mock('@/components/export/PaywallModal', () => {
  throw new TypeError('Importing a module script failed.');
});

import { ResultsExportControls } from '@/components/export/ResultsExportControls';
import { useProExport } from '@/hooks/useProExport';
import { analytics } from '@/lib/analytics';
import { takeExportResume } from '@/lib/export/export-resume';

const props = {
  fileHash: 'hash1',
  indices: null,
  totalCount: 42,
  filters: [],
  searchApplied: false,
};

async function clickExport(): Promise<void> {
  const user = userEvent.setup();
  render(<ResultsExportControls {...props} />);
  await user.click(screen.getByRole('button', { name: resultsEN.export.trigger }));
  await waitFor(() => expect(analytics.errorBoundary).toHaveBeenCalled());
}

describe('ResultsExportControls when the paywall chunk fails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    sessionStorage.clear();
    reloadPending = false;
    // 42 rows against a 10-row free tier: capped, so the paywall is what opens.
    buildExport.mockResolvedValue(new Blob(['<!doctype html>']));
    vi.mocked(useProExport).mockReturnValue({
      isEnabled: true,
      isUnlocked: false,
      checkoutState: 'idle',
      startCheckout: vi.fn(),
      resetCheckout: vi.fn(),
    });
  });

  it('keeps the page and stays quiet while the reload it triggered is on its way', async () => {
    reloadPending = true;

    await clickExport();

    // Still measured: the event is the only instrument this failure has ever had.
    // Exactly once, and only the chunk failure — vitest wraps a throwing mock factory in its
    // own message, so the WebKit text is not what arrives here.
    expect(analytics.errorBoundary).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: resultsEN.export.trigger })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says the export failed, under the button, when no reload is coming', async () => {
    await clickExport();

    expect(await screen.findByRole('alert')).toHaveTextContent(resultsEN.export.dialog.error);
    expect(screen.getByRole('button', { name: resultsEN.export.trigger })).toBeInTheDocument();
  });

  it('writes the open paywall down, with its receipt, for the reloaded page', async () => {
    reloadPending = true;

    await clickExport();

    // The sample file is already on disk. Resuming must reopen the paywall against it,
    // not build and download a second one.
    expect(takeExportResume('hash1')).toEqual({
      modal: 'paywall',
      fileHash: 'hash1',
      saved: expect.objectContaining({ total: 42, capped: true }),
    });
  });
});

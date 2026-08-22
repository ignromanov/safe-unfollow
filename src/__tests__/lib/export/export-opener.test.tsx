import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import resultsEN from '@/locales/en/results.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(resultsEN));
vi.mock('@/hooks/useProExport');
// The real dialog reaches IndexedDB through a worker on mount. This file is
// about the handoff arriving, not about what the dialog then does.
vi.mock('@/components/export/ExportDialog', () => ({
  ExportDialog: () => <div data-testid="export-dialog" />,
}));

import { ResultsExportControls } from '@/components/export/ResultsExportControls';
import { useProExport } from '@/hooks/useProExport';
import {
  hasExportOpener,
  openExportDialog,
  registerExportOpener,
  subscribeExportOpener,
} from '@/lib/export/export-opener';

const mockUseProExport = vi.mocked(useProExport);

function proExport(isEnabled: boolean) {
  mockUseProExport.mockReturnValue({
    isEnabled,
    isUnlocked: true,
    checkoutState: 'idle',
    startCheckout: vi.fn(),
    resetCheckout: vi.fn(),
  });
}

describe('export-opener store', () => {
  it('reports nothing mounted until something registers, and again after it leaves', () => {
    expect(hasExportOpener()).toBe(false);

    const unregister = registerExportOpener(vi.fn());
    expect(hasExportOpener()).toBe(true);

    unregister();
    expect(hasExportOpener()).toBe(false);
  });

  // The label on the other side is derived from this, so a watcher that is not
  // told about a late registration leaves a buyer looking at "Done" on a page
  // that could have offered the handoff.
  it('notifies watchers on both register and unregister', () => {
    const watcher = vi.fn();
    const stopWatching = subscribeExportOpener(watcher);

    const unregister = registerExportOpener(vi.fn());
    expect(watcher).toHaveBeenCalledTimes(1);

    unregister();
    expect(watcher).toHaveBeenCalledTimes(2);

    stopWatching();
    registerExportOpener(vi.fn())();
    expect(watcher).toHaveBeenCalledTimes(2);
  });

  it('is a no-op when nothing is mounted, rather than throwing at the caller', () => {
    expect(() => {
      openExportDialog();
    }).not.toThrow();
  });
});

describe('ResultsExportControls as the handoff target', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the format dialog when the activation dialog hands off', async () => {
    proExport(true);
    render(
      <ResultsExportControls fileHash="hash1" indices={null} totalCount={42} filename="export" />
    );

    expect(screen.queryByTestId('export-dialog')).not.toBeInTheDocument();

    act(() => {
      openExportDialog();
    });

    // findBy, not getBy: the dialog is lazy, so it suspends for a tick even
    // with the module mocked.
    expect(await screen.findByTestId('export-dialog')).toBeInTheDocument();
  });

  // With the feature off this control renders nothing at all, so an opener
  // registered from here would let the redirect dialog offer a button that
  // opens a dialog nobody can see.
  it('registers no opener while the feature is disabled', () => {
    proExport(false);
    render(
      <ResultsExportControls fileHash="hash1" indices={null} totalCount={42} filename="export" />
    );

    expect(hasExportOpener()).toBe(false);
  });
});

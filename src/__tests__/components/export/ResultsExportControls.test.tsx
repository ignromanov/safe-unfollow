import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import resultsEN from '@/locales/en/results.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(resultsEN));

vi.mock('@/hooks/useProExport');

vi.mock('@/lib/stats', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/stats')>();
  return {
    ...actual,
    analytics: { ...actual.analytics, exportClick: vi.fn(), paywallView: vi.fn() },
  };
});

import { ResultsExportControls } from '@/components/export/ResultsExportControls';
import { useProExport } from '@/hooks/useProExport';
import { analytics } from '@/lib/stats';

const mockUseProExport = vi.mocked(useProExport);

const defaultProps = {
  fileHash: 'hash1',
  indices: null,
  totalCount: 42,
  filename: 'my-export',
};

const downloadLabel = resultsEN.export.downloadAriaLabel;

describe('ResultsExportControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing when the feature is disabled', () => {
    mockUseProExport.mockReturnValue({
      isEnabled: false,
      isUnlocked: false,
      startCheckout: vi.fn(),
    });

    render(<ResultsExportControls {...defaultProps} />);

    expect(screen.queryByLabelText(downloadLabel)).not.toBeInTheDocument();
  });

  it('should render the download button when the feature is enabled', () => {
    mockUseProExport.mockReturnValue({
      isEnabled: true,
      isUnlocked: false,
      startCheckout: vi.fn(),
    });

    render(<ResultsExportControls {...defaultProps} />);

    expect(screen.getByLabelText(downloadLabel)).toBeInTheDocument();
  });

  // The modals are lazy chunks, so they resolve asynchronously after the click.
  it('should open the paywall when locked', async () => {
    mockUseProExport.mockReturnValue({
      isEnabled: true,
      isUnlocked: false,
      startCheckout: vi.fn(),
    });
    const user = userEvent.setup();

    render(<ResultsExportControls {...defaultProps} />);
    await user.click(screen.getByLabelText(downloadLabel));

    expect(await screen.findByText(resultsEN.export.paywall.headline)).toBeInTheDocument();
    expect(vi.mocked(analytics.paywallView)).toHaveBeenCalled();
    expect(vi.mocked(analytics.exportClick)).toHaveBeenCalledWith(false);
  });

  it('should open the export dialog when unlocked', async () => {
    mockUseProExport.mockReturnValue({
      isEnabled: true,
      isUnlocked: true,
      startCheckout: vi.fn(),
    });
    const user = userEvent.setup();

    render(<ResultsExportControls {...defaultProps} />);
    await user.click(screen.getByLabelText(downloadLabel));

    expect(await screen.findByText(resultsEN.export.dialog.title)).toBeInTheDocument();
    expect(vi.mocked(analytics.paywallView)).not.toHaveBeenCalled();
    expect(vi.mocked(analytics.exportClick)).toHaveBeenCalledWith(true);
  });

  it('should not mount any modal before the button is clicked', () => {
    mockUseProExport.mockReturnValue({
      isEnabled: true,
      isUnlocked: true,
      startCheckout: vi.fn(),
    });

    render(<ResultsExportControls {...defaultProps} />);

    expect(screen.queryByText(resultsEN.export.dialog.title)).not.toBeInTheDocument();
    expect(screen.queryByText(resultsEN.export.paywall.headline)).not.toBeInTheDocument();
  });
});

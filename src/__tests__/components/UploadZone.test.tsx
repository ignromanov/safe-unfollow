import { fireEvent, render, screen } from '@tests/utils/testUtils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import uploadEN from '@/locales/en/upload.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(uploadEN));

// Mock analytics (V9: uploadDrop/filePickerCancel removed)
vi.mock('@/lib/analytics', () => ({
  analytics: {
    uploadClick: vi.fn(),
    diagnosticErrorView: vi.fn(),
  },
}));

import { analytics } from '@/lib/analytics';
import { UploadZone } from '@/components/UploadZone';

describe('UploadZone', () => {
  const mockOnUploadStart = vi.fn();
  const mockOnBack = vi.fn();
  const mockOnOpenWizard = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    render(<UploadZone onUploadStart={mockOnUploadStart} />);

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('should display upload title and description', () => {
    render(<UploadZone onUploadStart={mockOnUploadStart} />);

    // Title from translations: zone.title
    expect(screen.getByText(uploadEN.zone.title)).toBeInTheDocument();
    // Description from translations: zone.description
    expect(screen.getByText(uploadEN.zone.description)).toBeInTheDocument();
  });

  it('should have drag and drop area with file input', () => {
    render(<UploadZone onUploadStart={mockOnUploadStart} />);

    // File input should exist and accept .zip files
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('accept', '.zip');
  });

  it('should display drop here prompt', () => {
    render(<UploadZone onUploadStart={mockOnUploadStart} />);

    // zone.dropHere translation
    expect(screen.getByText(uploadEN.zone.dropHere)).toBeInTheDocument();
    // zone.orBrowse translation
    expect(screen.getByText(uploadEN.zone.orBrowse)).toBeInTheDocument();
  });

  it('should display JSON format warning badge', () => {
    render(<UploadZone onUploadStart={mockOnUploadStart} />);

    // zone.jsonOnly translation
    expect(screen.getByText(uploadEN.zone.jsonOnly)).toBeInTheDocument();
  });

  it('should display pre-upload checklist', () => {
    render(<UploadZone onUploadStart={mockOnUploadStart} />);

    // checklist.title translation
    expect(screen.getByText(uploadEN.checklist.title)).toBeInTheDocument();
    // Checklist items from translations
    expect(screen.getByText(uploadEN.checklist.format)).toBeInTheDocument();
    expect(screen.getByText(uploadEN.checklist.includes)).toBeInTheDocument();
  });

  it('should display common error hint section', () => {
    render(<UploadZone onUploadStart={mockOnUploadStart} onOpenWizard={mockOnOpenWizard} />);

    // errors.commonTitle translation
    expect(screen.getByText(uploadEN.errors.commonTitle)).toBeInTheDocument();
  });

  it('should render back button when onBack is provided', () => {
    render(<UploadZone onUploadStart={mockOnUploadStart} onBack={mockOnBack} />);

    // zone.back translation
    const backButton = screen.getByText(uploadEN.zone.back);
    expect(backButton).toBeInTheDocument();

    fireEvent.click(backButton);
    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it('should not render back button when onBack is not provided', () => {
    render(<UploadZone onUploadStart={mockOnUploadStart} />);

    expect(screen.queryByText(uploadEN.zone.back)).not.toBeInTheDocument();
  });

  it('should show processing state when isProcessing is true', () => {
    render(<UploadZone onUploadStart={mockOnUploadStart} isProcessing={true} />);

    // zone.processing translation
    expect(screen.getByText(uploadEN.zone.processing)).toBeInTheDocument();
    // zone.processingHint translation
    expect(screen.getByText(uploadEN.zone.processingHint)).toBeInTheDocument();
  });

  it('should disable file input when processing', () => {
    render(<UploadZone onUploadStart={mockOnUploadStart} isProcessing={true} />);

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeDisabled();
  });

  it('should call onUploadStart and track analytics when file is selected via input', () => {
    render(<UploadZone onUploadStart={mockOnUploadStart} />);

    const file = new File(['test'], 'test.zip', { type: 'application/zip' });
    const fileInput = document.querySelector('input[type="file"]');

    fireEvent.change(fileInput!, { target: { files: [file] } });

    expect(mockOnUploadStart).toHaveBeenCalledWith(file);
    expect(analytics.uploadClick).toHaveBeenCalled();
  });

  it('should call onUploadStart when zip file is dropped', () => {
    render(<UploadZone onUploadStart={mockOnUploadStart} />);

    const file = new File(['test'], 'data.zip', { type: 'application/zip' });
    const dropZone = document.querySelector('[class*="border-dashed"]');

    fireEvent.drop(dropZone!, {
      dataTransfer: { files: [file] },
    });

    expect(mockOnUploadStart).toHaveBeenCalledWith(file);
  });

  it('should not call onUploadStart when non-zip file is dropped', () => {
    render(<UploadZone onUploadStart={mockOnUploadStart} />);

    const file = new File(['test'], 'data.txt', { type: 'text/plain' });
    const dropZone = document.querySelector('[class*="border-dashed"]');

    fireEvent.drop(dropZone!, {
      dataTransfer: { files: [file] },
    });

    expect(mockOnUploadStart).not.toHaveBeenCalled();
  });

  it('should render learn fix button when onOpenWizard is provided', () => {
    render(<UploadZone onUploadStart={mockOnUploadStart} onOpenWizard={mockOnOpenWizard} />);

    // errors.learnFix translation
    const learnButton = screen.getByText(uploadEN.errors.learnFix);
    expect(learnButton).toBeInTheDocument();

    fireEvent.click(learnButton);
    expect(mockOnOpenWizard).toHaveBeenCalledTimes(1);
  });

  it('should have accessible file input with aria-label', () => {
    render(<UploadZone onUploadStart={mockOnUploadStart} />);

    const fileInput = document.querySelector('input[type="file"]');
    // zone.ariaLabel translation
    expect(fileInput).toHaveAttribute('aria-label', uploadEN.zone.ariaLabel);
  });

  // V8: drag enter/leave analytics tests removed - events no longer tracked

  it('should show screen reader announcement when processing', () => {
    render(<UploadZone onUploadStart={mockOnUploadStart} isProcessing={true} />);

    const srAnnouncement = screen.getByRole('status');
    expect(srAnnouncement).toBeInTheDocument();
    expect(srAnnouncement).toHaveClass('sr-only');
  });

  it('should show diagnostic screen when there are critical errors', () => {
    const parseWarnings = [
      { severity: 'error' as const, code: 'TEST_ERROR', message: 'Test error' },
    ];

    render(
      <UploadZone
        onUploadStart={mockOnUploadStart}
        parseWarnings={parseWarnings}
        onOpenWizard={mockOnOpenWizard}
        onBack={mockOnBack}
      />
    );

    // When there is a critical error, the diagnostic screen is shown
    // The main upload title should not be visible
    expect(screen.queryByText(uploadEN.zone.title)).not.toBeInTheDocument();
    // Analytics should track the diagnostic error view
    expect(analytics.diagnosticErrorView).toHaveBeenCalled();
  });
});

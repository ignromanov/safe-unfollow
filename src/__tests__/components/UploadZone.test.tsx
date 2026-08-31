import { fireEvent, renderWithRouter, screen } from '@/__tests__/test-utils';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import uploadEN from '@/locales/en/upload.json';
import wizardEN from '@/locales/en/wizard.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

// Two namespaces, one mock: UploadZone reads `upload`, the guide block it
// renders reads `wizard`, and createI18nMock ignores the namespace argument
// entirely — a single bundle would make every guide string resolve to its own
// key. `upload` is spread last so no assertion in this file changes meaning;
// the two bundles share no top-level key today.
vi.mock('react-i18next', () => createI18nMock({ ...wizardEN, ...uploadEN }));

// Mock analytics (V9: uploadDrop/filePickerCancel removed)
vi.mock('@/lib/analytics', () => ({
  analytics: {
    uploadClick: vi.fn(),
    diagnosticErrorView: vi.fn(),
    linkClick: vi.fn(),
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
    renderWithRouter(<UploadZone onUploadStart={mockOnUploadStart} />);

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('should display upload title and description', () => {
    renderWithRouter(<UploadZone onUploadStart={mockOnUploadStart} />);

    // Title from translations: zone.title
    expect(screen.getByText(uploadEN.zone.title)).toBeInTheDocument();
    // Description from translations: zone.description
    expect(screen.getByText(uploadEN.zone.description)).toBeInTheDocument();
  });

  it('should have drag and drop area with file input', () => {
    renderWithRouter(<UploadZone onUploadStart={mockOnUploadStart} />);

    // File input should exist and accept .zip files
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('accept', '.zip');
  });

  it('should display drop here prompt', () => {
    renderWithRouter(<UploadZone onUploadStart={mockOnUploadStart} />);

    // zone.dropHere translation
    expect(screen.getByText(uploadEN.zone.dropHere)).toBeInTheDocument();
    // zone.orBrowse translation
    expect(screen.getByText(uploadEN.zone.orBrowse)).toBeInTheDocument();
  });

  it('should display JSON format reminder inline text', () => {
    renderWithRouter(<UploadZone onUploadStart={mockOnUploadStart} />);

    // zone.jsonShort is shown as inline muted text (not a badge)
    expect(screen.getByText(uploadEN.zone.jsonShort)).toBeInTheDocument();
  });

  it('asks nothing before the file is chosen', () => {
    renderWithRouter(<UploadZone onUploadStart={mockOnUploadStart} />);

    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('names both formats in the pre-upload warning', () => {
    renderWithRouter(<UploadZone onUploadStart={mockOnUploadStart} />);

    // The short line is the only pre-upload format warning on mobile, so it has
    // to carry the contrast rather than just the required value: HTML is what
    // Instagram's dialog hands you by default and 48% of failed uploads are it.
    const warning = screen.getByText(uploadEN.zone.jsonShort);
    expect(warning).toHaveTextContent(/JSON/);
    expect(warning).toHaveTextContent(/HTML/);
  });

  it('puts the guide beside the upload, where the checklist duplicated it', () => {
    // The desktop sidebar used to carry a four-row checklist naming what to
    // pick in Instagram's dialog — the same rows RecipeCard renders inside
    // the guide block, one screen apart. Direction A (operator) replaces it
    // with the guide block itself, so the same component is mounted twice:
    // once for mobile flow, once as the desktop column. Only one is displayed
    // at any width, and `hidden` is display:none, so the other is out of the
    // accessibility tree rather than duplicated in it.
    //
    // ⚠️ `upload.checklist.*` is orphaned by this and deliberately not
    // deleted: `checklist.format` is one of the strings that tells readers to
    // pick JSON, which is a copy decision (lumen-cro), not a cleanup.
    renderWithRouter(<UploadZone onUploadStart={mockOnUploadStart} />);

    expect(screen.queryByText(uploadEN.checklist.title)).toBeNull();
    expect(screen.getAllByText(wizardEN.entry.recipe.title)).toHaveLength(2);
  });

  it('should display common error hint section', () => {
    renderWithRouter(
      <UploadZone onUploadStart={mockOnUploadStart} onOpenWizard={mockOnOpenWizard} />
    );

    // errors.commonTitle translation
    expect(screen.getByText(uploadEN.errors.commonTitle)).toBeInTheDocument();
  });

  it('should show processing state when isProcessing is true', () => {
    renderWithRouter(<UploadZone onUploadStart={mockOnUploadStart} isProcessing={true} />);

    // zone.processing translation
    expect(screen.getByText(uploadEN.zone.processing)).toBeInTheDocument();
    // zone.processingHint translation
    expect(screen.getByText(uploadEN.zone.processingHint)).toBeInTheDocument();
  });

  it('should disable file input when processing', () => {
    renderWithRouter(<UploadZone onUploadStart={mockOnUploadStart} isProcessing={true} />);

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeDisabled();
  });

  it('should call onUploadStart and track analytics when file is selected via input', () => {
    renderWithRouter(<UploadZone onUploadStart={mockOnUploadStart} />);

    const file = new File(['test'], 'test.zip', { type: 'application/zip' });
    const fileInput = document.querySelector('input[type="file"]');

    fireEvent.change(fileInput!, { target: { files: [file] } });

    expect(mockOnUploadStart).toHaveBeenCalledWith(file);
    expect(analytics.uploadClick).toHaveBeenCalled();
  });

  it('should call onUploadStart when zip file is dropped', () => {
    renderWithRouter(<UploadZone onUploadStart={mockOnUploadStart} />);

    const file = new File(['test'], 'data.zip', { type: 'application/zip' });
    const dropZone = document.querySelector('[class*="border-dashed"]');

    fireEvent.drop(dropZone!, {
      dataTransfer: { files: [file] },
    });

    expect(mockOnUploadStart).toHaveBeenCalledWith(file);
  });

  it('should not call onUploadStart when non-zip file is dropped', () => {
    renderWithRouter(<UploadZone onUploadStart={mockOnUploadStart} />);

    const file = new File(['test'], 'data.txt', { type: 'text/plain' });
    const dropZone = document.querySelector('[class*="border-dashed"]');

    fireEvent.drop(dropZone!, {
      dataTransfer: { files: [file] },
    });

    expect(mockOnUploadStart).not.toHaveBeenCalled();
  });

  it('should render learn fix button when onOpenWizard is provided', () => {
    renderWithRouter(
      <UploadZone onUploadStart={mockOnUploadStart} onOpenWizard={mockOnOpenWizard} />
    );

    // errors.learnFix translation
    const learnButton = screen.getByText(uploadEN.errors.learnFix);
    expect(learnButton).toBeInTheDocument();

    fireEvent.click(learnButton);
    expect(mockOnOpenWizard).toHaveBeenCalledTimes(1);
  });

  it('should have accessible file input with aria-label', () => {
    renderWithRouter(<UploadZone onUploadStart={mockOnUploadStart} />);

    const fileInput = document.querySelector('input[type="file"]');
    // zone.ariaLabel translation
    expect(fileInput).toHaveAttribute('aria-label', uploadEN.zone.ariaLabel);
  });

  // V8: drag enter/leave analytics tests removed - events no longer tracked

  it('should show screen reader announcement when processing', () => {
    renderWithRouter(<UploadZone onUploadStart={mockOnUploadStart} isProcessing={true} />);

    const srAnnouncement = screen.getByRole('status');
    expect(srAnnouncement).toBeInTheDocument();
    expect(srAnnouncement).toHaveClass('sr-only');
  });

  it('should show diagnostic screen when there are critical errors', () => {
    const parseWarnings = [
      { severity: 'error' as const, code: 'TEST_ERROR', message: 'Test error' },
    ];

    renderWithRouter(
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

  it('places the affiliate block after the drop zone, not against it', () => {
    const { container } = renderWithRouter(<UploadZone onUploadStart={vi.fn()} />);

    const block = container.querySelector('aside') as HTMLElement;
    const input = container.querySelector('input[type="file"]') as HTMLElement;
    expect(block).not.toBeNull();
    // The drop zone is an interaction target; an offer butted against it invites
    // accidental clicks.
    expect(input.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows no affiliate block on the diagnostic error screen', () => {
    const { container } = renderWithRouter(
      <UploadZone
        onUploadStart={vi.fn()}
        parseWarnings={[{ code: 'NOT_ZIP', message: 'nope', severity: 'error', fix: 'x' }]}
      />
    );

    // Positive proof the error screen actually rendered — without this, the
    // assertion below would also pass if UploadZone rendered nothing at all.
    expect(analytics.diagnosticErrorView).toHaveBeenCalled();
    expect(container.querySelector('aside')).toBeNull();
  });

  it('keeps the paid block above the loading tips, which mount all at once', () => {
    const { container } = renderWithRouter(
      <UploadZone onUploadStart={vi.fn()} isProcessing={true} />
    );

    // LoadingTips returns null until a parse starts, so the whole list arrives
    // in one frame and everything after it moves down by its full height. The
    // offer must not be in that set — on a 390px viewport the shift was enough
    // to push it off the screen entirely.
    const block = container.querySelector('aside') as HTMLElement;
    const firstTip = screen.getByText(uploadEN.loadingTips.localProcessing.title);
    expect(block).not.toBeNull();
    expect(block.compareDocumentPosition(firstTip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('offers the waiting state after the Accounts Center click, without hiding the drop zone', async () => {
    // The CTA opens a new tab, so this page survives the click — which is the
    // only reason a waiting state can exist here at all.
    const user = userEvent.setup();
    renderWithRouter(<UploadZone onUploadStart={vi.fn()} />);

    expect(screen.queryByText(uploadEN.waiting.title)).toBeNull();

    await user.click(screen.getAllByRole('link', { name: /accounts center/i })[0]!);

    expect(screen.getByText(uploadEN.waiting.title)).toBeInTheDocument();
    // Someone who clicks through and then finds the file in their email must
    // not have to undo a state to upload it.
    expect(document.querySelector('input[type="file"]')).toBeInTheDocument();
  });

  it('keeps the paid block above the guide', () => {
    // The order is the decision: drop zone -> offer -> guide. Putting the
    // guide above the offer was proposed and ruled against by the operator
    // (2026-08-25) — this is the page's only revenue surface. DOM order is
    // also the only part of that ruling anything here can check: jsdom
    // performs no layout, so the fold position is unmeasurable in this repo.
    const { container } = renderWithRouter(<UploadZone onUploadStart={vi.fn()} />);

    const block = container.querySelector('aside') as HTMLElement;
    // The first of the two mount points: the mobile flow, which is what the
    // ruling was about. The second is the desktop column, which sits beside
    // the drop zone rather than under the offer.
    const guide = screen.getAllByRole('heading', { level: 2, name: wizardEN.entry.title })[0]!;
    expect(block).not.toBeNull();
    expect(block.compareDocumentPosition(guide) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

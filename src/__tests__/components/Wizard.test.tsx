import { vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import wizardEN from '@/locales/en/wizard.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

// Mock react-router-dom with pathname tracking
let mockPathname = '/wizard';
const mockNavigate = vi.fn((path: string) => {
  // Update mockPathname when navigate is called
  if (typeof path === 'string') {
    mockPathname = path;
  }
});

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: mockPathname }),
  useNavigate: () => mockNavigate,
  // PrefixedLink renders <Link>; a real <a href> stub is enough since navigation
  // itself is exercised via mockNavigate above, not by following hrefs.
  Link: ({ to, children, ...props }: { to: string; children?: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

// Mock useLanguagePrefix — vi.fn() wrapper so individual tests can vary the
// locale prefix, matching the pattern in src/__tests__/pages/WizardPage.test.tsx
const mockUseLanguagePrefix = vi.fn(() => '');
vi.mock('@/hooks/useLanguagePrefix', () => ({
  useLanguagePrefix: () => mockUseLanguagePrefix(),
}));

vi.mock('react-i18next', () => createI18nMock(wizardEN));

import { Wizard } from '@/components/Wizard';
import { analytics } from '@/lib/analytics';

// Mock analytics module
vi.mock('@/lib/analytics', () => ({
  analytics: {
    guideEntryView: vi.fn(),
    wizardStepView: vi.fn(),
    wizardNextClick: vi.fn(),
    wizardBackClick: vi.fn(),
    wizardCancel: vi.fn(),
    wizardExternalLinkClick: vi.fn(),
  },
}));

describe('Wizard', () => {
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/wizard';
    mockUseLanguagePrefix.mockReturnValue('');
  });

  it('should render without crashing', () => {
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    expect(screen.getByText('Step 1 of 8')).toBeInTheDocument();
  });

  it('should render step indicator with progress dots', () => {
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    // Step counter text
    expect(screen.getByText('Step 1 of 8')).toBeInTheDocument();
  });

  it('should render the GuideEntry headline on step 1', () => {
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    expect(screen.getByRole('heading', { name: wizardEN.entry.title })).toBeInTheDocument();
  });

  it('should render navigation buttons', () => {
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    expect(screen.getByText('Next Step')).toBeInTheDocument();
    expect(screen.getByText('buttons.cancel')).toBeInTheDocument();
  });

  it('should render the GuideEntry CTA linking to Accounts Center on step 1', () => {
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    const cta = screen.getByRole('link', { name: new RegExp(wizardEN.entry.cta) });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute(
      'href',
      'https://accountscenter.instagram.com/info_and_permissions/dyi/?entry_point=app_settings'
    );
  });

  it('should call navigate to next step when Next is clicked', () => {
    mockPathname = '/wizard/step/1';
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    fireEvent.click(screen.getByText(wizardEN.buttons.next));

    expect(mockNavigate).toHaveBeenCalledWith('/wizard/step/2');
  });

  it('should call navigate to previous step when Back is clicked', () => {
    mockPathname = '/wizard/step/2';
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    expect(screen.getByText('Step 2 of 8')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Back'));

    expect(mockNavigate).toHaveBeenCalledWith('/wizard/step/1');
  });

  it('should call onCancel when close button is clicked', () => {
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    // Find the close button by its aria-label from translations
    const closeButton = screen.getByRole('button', { name: wizardEN.buttons.close });
    fireEvent.click(closeButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should show warning badge on step 4', () => {
    mockPathname = '/wizard/step/4';
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    expect(screen.getByText(wizardEN.format.warning)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: new RegExp('Followers and following') })
    ).toBeInTheDocument();
  });

  it('should call onComplete on last step when Done is clicked', () => {
    mockPathname = '/wizard/step/8';
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    expect(screen.getByText("Done, let's go!")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Done, let's go!"));

    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('should render step video with alt text as aria-label', () => {
    // Step 1 is GuideEntry now, which carries no video — step 2 still uses
    // the generic step card this behavior belongs to.
    mockPathname = '/wizard/step/2';
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    const video = screen.getByLabelText(wizardEN.steps['2'].alt);
    expect(video).toBeInTheDocument();
  });

  it('should navigate via goToStep when clicking Next', () => {
    mockPathname = '/wizard/step/1';
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    fireEvent.click(screen.getByText('Next Step'));

    // Navigation to step 2
    expect(mockNavigate).toHaveBeenCalledWith('/wizard/step/2');
  });

  it('should render correct step based on URL pathname', () => {
    // Test step 5
    mockPathname = '/wizard/step/5';
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    expect(screen.getByText('Step 5 of 8')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('should navigate to correct path when Next is clicked', () => {
    mockPathname = '/wizard/step/3';
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    fireEvent.click(screen.getByText(wizardEN.buttons.next));

    expect(mockNavigate).toHaveBeenCalledWith('/wizard/step/4');
  });

  it('should navigate to correct path when Back is clicked', () => {
    mockPathname = '/wizard/step/5';
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    fireEvent.click(screen.getByText('Back'));

    expect(mockNavigate).toHaveBeenCalledWith('/wizard/step/4');
  });

  it('should render "I already have my ZIP file" link on step 1', () => {
    mockPathname = '/wizard/step/1';
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    const alreadyHaveFileLink = screen.getByRole('link', {
      name: wizardEN.buttons.alreadyHaveFile,
    });
    expect(alreadyHaveFileLink).toBeInTheDocument();
  });

  it('should link "I already have my ZIP file" to /upload', () => {
    // Prerendered wizard step pages are inert until React hydrates, so this
    // control must be a real <a href> — not a button firing navigate() on
    // click — or it does nothing during that window. See PrefixedLink.tsx.
    mockPathname = '/wizard/step/1';
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    const alreadyHaveFileLink = screen.getByRole('link', {
      name: wizardEN.buttons.alreadyHaveFile,
    });

    expect(alreadyHaveFileLink).toHaveAttribute('href', '/upload');
  });

  it('should prefix the "I already have my ZIP file" href with the current locale', () => {
    mockPathname = '/ru/wizard/step/1';
    mockUseLanguagePrefix.mockReturnValue('/ru');
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    const alreadyHaveFileLink = screen.getByRole('link', {
      name: wizardEN.buttons.alreadyHaveFile,
    });

    expect(alreadyHaveFileLink).toHaveAttribute('href', '/ru/upload');
  });

  it('should not render "I already have my ZIP file" link on other steps', () => {
    mockPathname = '/wizard/step/2';
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    const alreadyHaveFileLink = screen.queryByRole('link', {
      name: wizardEN.buttons.alreadyHaveFile,
    });
    expect(alreadyHaveFileLink).not.toBeInTheDocument();
  });

  it('should not report wizardStepView for step 1 — GuideEntry owns its own view event', () => {
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    expect(analytics.wizardStepView).not.toHaveBeenCalled();
  });

  it('should report wizardStepView for step 2', () => {
    mockPathname = '/wizard/step/2';
    render(<Wizard onComplete={mockOnComplete} onCancel={mockOnCancel} />);

    expect(analytics.wizardStepView).toHaveBeenCalledWith(2);
  });
});

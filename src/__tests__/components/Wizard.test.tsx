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
  // PrefixedLink renders <Link>; a real <a href> stub is enough to assert hrefs and to
  // let Escape-key navigation (a real navigate() call, not a click) be exercised
  // separately via mockNavigate above.
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
  },
}));

function renderWizardAtStep(step: number) {
  mockPathname = `/wizard/step/${step}`;
  return render(<Wizard />);
}

describe('Wizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/wizard';
    mockUseLanguagePrefix.mockReturnValue('');
  });

  it('should render without crashing', () => {
    render(<Wizard />);

    expect(screen.getByText('Step 1 of 8')).toBeInTheDocument();
  });

  it('should render step indicator with progress dots', () => {
    render(<Wizard />);

    // Step counter text
    expect(screen.getByText('Step 1 of 8')).toBeInTheDocument();
  });

  it('should render the GuideEntry headline on step 1', () => {
    render(<Wizard />);

    expect(screen.getByRole('heading', { name: wizardEN.entry.title })).toBeInTheDocument();
  });

  it('should render navigation links', () => {
    render(<Wizard />);

    expect(screen.getByText('Next Step')).toBeInTheDocument();
    expect(screen.getByText('buttons.cancel')).toBeInTheDocument();
  });

  it('should render the GuideEntry CTA linking to Accounts Center on step 1', () => {
    render(<Wizard />);

    const cta = screen.getByRole('link', { name: new RegExp(wizardEN.entry.cta) });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute(
      'href',
      'https://accountscenter.instagram.com/info_and_permissions/dyi/?entry_point=app_settings'
    );
  });

  it('navigates by href, so the control works before hydration', () => {
    renderWizardAtStep(3);

    expect(screen.getByRole('link', { name: /next step/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/wizard/step/4')
    );
    expect(screen.getByRole('link', { name: /back/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/wizard/step/2')
    );
  });

  it('marks the current step without pretending to be a tablist', () => {
    renderWizardAtStep(3);

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { current: 'step' })).toHaveAccessibleName(/step 3/i);
  });

  it('should navigate back one step on Escape', () => {
    renderWizardAtStep(2);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockNavigate).toHaveBeenCalledWith('/wizard/step/1');
  });

  it('should navigate home on Escape when on the first step', () => {
    renderWizardAtStep(1);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('should link "Close guide" home', () => {
    render(<Wizard />);

    const closeLink = screen.getByRole('link', { name: wizardEN.buttons.close });
    expect(closeLink).toHaveAttribute('href', '/');
  });

  it('should show warning badge on step 4', () => {
    renderWizardAtStep(4);

    expect(screen.getByText(wizardEN.format.warning)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: new RegExp('Followers and following') })
    ).toBeInTheDocument();
  });

  it('should link "Done, let\'s go!" to /upload on the last step', () => {
    renderWizardAtStep(8);

    const doneLink = screen.getByRole('link', { name: "Done, let's go!" });
    expect(doneLink).toHaveAttribute('href', '/upload');
  });

  it('should render step video with alt text as aria-label', () => {
    // Step 1 is GuideEntry now, which carries no video — step 2 still uses
    // the generic step card this behavior belongs to.
    renderWizardAtStep(2);

    const video = screen.getByLabelText(wizardEN.steps['2'].alt);
    expect(video).toBeInTheDocument();
  });

  it('should render correct step based on URL pathname', () => {
    renderWizardAtStep(5);

    expect(screen.getByText('Step 5 of 8')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('should prefix step-indicator and Back/Next hrefs with the current locale', () => {
    mockUseLanguagePrefix.mockReturnValue('/ru');
    mockPathname = '/ru/wizard/step/3';
    render(<Wizard />);

    expect(screen.getByRole('link', { name: /next step/i })).toHaveAttribute(
      'href',
      '/ru/wizard/step/4'
    );
    expect(screen.getByRole('link', { name: /back/i })).toHaveAttribute(
      'href',
      '/ru/wizard/step/2'
    );
    expect(screen.getByRole('link', { current: 'step' })).toHaveAttribute(
      'href',
      '/ru/wizard/step/3'
    );
  });

  it('should render "I already have my ZIP file" link on step 1', () => {
    renderWizardAtStep(1);

    const alreadyHaveFileLink = screen.getByRole('link', {
      name: wizardEN.buttons.alreadyHaveFile,
    });
    expect(alreadyHaveFileLink).toBeInTheDocument();
  });

  it('should link "I already have my ZIP file" to /upload', () => {
    // Prerendered wizard step pages are inert until React hydrates, so this
    // control must be a real <a href> — not a button firing navigate() on
    // click — or it does nothing during that window. See PrefixedLink.tsx.
    renderWizardAtStep(1);

    const alreadyHaveFileLink = screen.getByRole('link', {
      name: wizardEN.buttons.alreadyHaveFile,
    });

    expect(alreadyHaveFileLink).toHaveAttribute('href', '/upload');
  });

  it('should prefix the "I already have my ZIP file" href with the current locale', () => {
    mockPathname = '/ru/wizard/step/1';
    mockUseLanguagePrefix.mockReturnValue('/ru');
    render(<Wizard />);

    const alreadyHaveFileLink = screen.getByRole('link', {
      name: wizardEN.buttons.alreadyHaveFile,
    });

    expect(alreadyHaveFileLink).toHaveAttribute('href', '/ru/upload');
  });

  it('should not render "I already have my ZIP file" link on other steps', () => {
    renderWizardAtStep(2);

    const alreadyHaveFileLink = screen.queryByRole('link', {
      name: wizardEN.buttons.alreadyHaveFile,
    });
    expect(alreadyHaveFileLink).not.toBeInTheDocument();
  });

  it('should not report wizardStepView for step 1 — GuideEntry owns its own view event', () => {
    render(<Wizard />);

    expect(analytics.wizardStepView).not.toHaveBeenCalled();
  });

  it('should report wizardStepView for step 2', () => {
    renderWizardAtStep(2);

    expect(analytics.wizardStepView).toHaveBeenCalledWith(2);
  });
});

import { vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
import { GUIDE_STEPS } from '@/config/wizard-steps';

// Mock analytics module
vi.mock('@/lib/analytics', () => ({
  analytics: {
    guideEntryView: vi.fn(),
    wizardStepView: vi.fn(),
    linkClick: vi.fn(),
    calendarReminderClick: vi.fn(),
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

  it('should render the guide block headline on step 1', () => {
    render(<Wizard />);

    expect(screen.getByRole('heading', { name: wizardEN.entry.title })).toBeInTheDocument();
  });

  it('should render navigation links', () => {
    render(<Wizard />);

    expect(screen.getByText('Next Step')).toBeInTheDocument();
    expect(screen.getByText(wizardEN.buttons.cancel)).toBeInTheDocument();
  });

  it('should render the guide block CTA linking to Accounts Center on step 1', () => {
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
    // Step 1 is the guide block now, which carries no video — route 2 still
    // uses the generic step card this behavior belongs to. Its copy key is
    // `steps.1`: the routes kept their numbering, the sections did not.
    renderWizardAtStep(2);

    const video = screen.getByLabelText(wizardEN.steps['1'].alt);
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

  // Step 1 emits no view event at all now. GuideEntry used to emit
  // guide_entry_view here and is gone; adding step 1 to wizard_step_view would
  // open a value in that series days before PR 3 deletes these routes. The
  // guide's replacement event, guide_open, lands in PR 4 on /upload.
  it('reports no view event for step 1', () => {
    render(<Wizard />);

    expect(analytics.wizardStepView).not.toHaveBeenCalled();
    expect(analytics.guideEntryView).not.toHaveBeenCalled();
  });

  it('should report wizardStepView for step 2', () => {
    renderWizardAtStep(2);

    expect(analytics.wizardStepView).toHaveBeenCalledWith(2);
  });

  // WizardPage never remounts across wizard URLs — one element serves every
  // :stepId (routes.tsx) — and the scroll lives in an inner container, so
  // useLayoutState's window reset cannot reach it.
  describe('scroll position across step changes', () => {
    it('sends the scroll container back to the top when the step changes', () => {
      mockPathname = '/wizard/step/1';
      const { rerender } = render(<Wizard />);
      const container = screen.getByRole('dialog').querySelector('.overflow-y-auto')!;
      const scrollTo = vi.fn();
      container.scrollTo = scrollTo;

      mockPathname = '/wizard/step/2';
      rerender(<Wizard />);

      expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
    });

    it('leaves the reader where they are on the first render', () => {
      const scrollTo = vi.spyOn(Element.prototype, 'scrollTo');

      renderWizardAtStep(1);

      // A non-zero scrollTop on mount is a position reached before hydration.
      // Resetting it there is the defect the bar's swap gate also guards.
      expect(scrollTo).not.toHaveBeenCalled();
      scrollTo.mockRestore();
    });
  });

  describe('bottom bar on step 1', () => {
    it('names the bar navigation region separately from the step-dot navigation', () => {
      renderWizardAtStep(1);

      expect(
        screen.getByRole('navigation', { name: wizardEN.footer.navigation })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('navigation', { name: wizardEN.header.stepNavigation })
      ).toBeInTheDocument();
    });

    // The bar used to swap both slots on step 1 once the in-flow Accounts
    // Center CTA scrolled out of view, driven by an IntersectionObserver and
    // gated on a post-hydration scroll. Step 1 is no longer a screen with one
    // action, so the mechanism is gone rather than relaxed — these assertions
    // are what is left of that suite: the bar is Back/Next on every step, and
    // there is exactly one Accounts Center link on the page.
    it('carries the normal step nav, and no second Accounts Center link', () => {
      renderWizardAtStep(1);

      const bar = screen.getByRole('navigation', { name: wizardEN.footer.navigation });
      expect(within(bar).getByText('Next Step')).toBeInTheDocument();
      expect(within(bar).getByText(wizardEN.buttons.cancel)).toBeInTheDocument();
      expect(within(bar).queryByText(wizardEN.entry.cta)).not.toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: /accounts center/i })).toHaveLength(1);
    });

    it('keeps exactly one Accounts Center link across step 1 -> 2 -> 1', () => {
      // Wizard never remounts across step changes (routes.tsx reuses one
      // element for every :stepId), only `currentStep` does.
      mockPathname = '/wizard/step/1';
      const { rerender } = render(<Wizard />);

      mockPathname = '/wizard/step/2';
      rerender(<Wizard />);
      mockPathname = '/wizard/step/1';
      rerender(<Wizard />);

      const bar = screen.getByRole('navigation', { name: wizardEN.footer.navigation });
      expect(within(bar).getByText('Next Step')).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: /accounts center/i })).toHaveLength(1);
    });

    it('does not reserve extra bar height on step 1 any more', () => {
      // `min-h-16` existed only to hold the swapped pair's two-line labels.
      renderWizardAtStep(1);

      const bar = screen.getByRole('navigation', { name: wizardEN.footer.navigation });
      expect(bar.querySelector('.min-h-16')).toBeNull();
    });
  });

  describe('calendar reminder', () => {
    // The control renders only on the last step (isLastStep, Wizard.tsx:218).
    it('reports the click before window.open, which a popup blocker may cancel', () => {
      // jsdom does not implement window.open and logs "Not implemented" noise.
      const open = vi.spyOn(window, 'open').mockReturnValue(null);
      renderWizardAtStep(GUIDE_STEPS.length + 1);

      fireEvent.click(screen.getByRole('button', { name: wizardEN.calendar.addReminder }));

      expect(analytics.calendarReminderClick).toHaveBeenCalledTimes(1);
      expect(open).toHaveBeenCalledTimes(1);
    });
  });
});

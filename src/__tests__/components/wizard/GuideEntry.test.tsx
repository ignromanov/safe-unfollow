import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';

import wizardEN from '@/locales/en/wizard.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';
import { renderWithRouter as render } from '@/__tests__/test-utils';
import { WIZARD_STEPS } from '@/config/wizard-steps';

vi.mock('react-i18next', () => createI18nMock(wizardEN));

vi.mock('@/lib/analytics', () => ({
  analytics: {
    guideEntryView: vi.fn(),
    wizardStepView: vi.fn(),
  },
}));

import { GuideEntry } from '@/components/wizard/GuideEntry';
import { analytics } from '@/lib/analytics';

describe('GuideEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers exactly one primary action', () => {
    render(<GuideEntry />);

    const primaries = screen.getAllByRole('link', { name: /accounts center/i });
    expect(primaries).toHaveLength(1);
  });

  it('puts the two highest-CTR messages under the button, not in cards', () => {
    render(<GuideEntry />);

    const cta = screen.getByRole('link', { name: /accounts center/i });
    const subtext = cta.parentElement!;
    expect(within(subtext).getByText(/no login/i)).toBeInTheDocument();
    expect(within(subtext).getByText(/never uploaded/i)).toBeInTheDocument();
  });

  it('states our cost and disclaims theirs, as two separate keys', () => {
    render(<GuideEntry />);

    expect(screen.getByText(/about 2 minutes/i)).toBeInTheDocument();
    expect(screen.getByText(/the wait is theirs/i)).toBeInTheDocument();
  });

  it('reports the entry view, not a wizard step view', () => {
    render(<GuideEntry />);

    expect(analytics.guideEntryView).toHaveBeenCalledTimes(1);
    expect(analytics.wizardStepView).not.toHaveBeenCalled();
  });

  it("never claims a ceiling on Instagram's clock", () => {
    render(<GuideEntry />);

    expect(screen.queryByText(/48 hours|up to a few hours|5-30/i)).not.toBeInTheDocument();
  });

  it('takes the CTA href from config, not a hardcoded URL', () => {
    render(<GuideEntry />);

    const cta = screen.getByRole('link', { name: /accounts center/i });
    expect(cta).toHaveAttribute('href', WIZARD_STEPS[0].externalLink);
  });

  it('reuses the existing "already have my file" shortcut, linking to /upload', () => {
    render(<GuideEntry />);

    const shortcut = screen.getByRole('link', { name: wizardEN.buttons.alreadyHaveFile });
    expect(shortcut).toHaveAttribute('href', '/upload');
  });

  it('renders the recipe card and the closed step accordion as reference material', () => {
    render(<GuideEntry />);

    expect(screen.getByRole('group', { name: /instagram's dialog/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /step-by-step/i })).toBeInTheDocument();
    // Accordion starts closed — its links are not reachable before the click.
    expect(screen.queryByRole('link', { name: /step 2/i })).not.toBeInTheDocument();
  });

  it('does not offer "try with sample" on this screen', () => {
    render(<GuideEntry />);

    expect(screen.queryByText(/try with sample/i)).not.toBeInTheDocument();
  });
});

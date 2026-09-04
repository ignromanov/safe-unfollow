import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import wizardEN from '@/locales/en/wizard.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';
import { renderWithRouter as render } from '@/__tests__/test-utils';
import { ACCOUNTS_CENTER_URL } from '@/config/wizard-steps';

vi.mock('react-i18next', () => createI18nMock(wizardEN));

vi.mock('@/lib/analytics', () => ({
  analytics: {
    linkClick: vi.fn(),
  },
}));

import { UploadGuideBlock } from '@/components/upload/UploadGuideBlock';
import { analytics } from '@/lib/analytics';

describe('UploadGuideBlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers one action: Instagram Accounts Center, in a new tab', () => {
    render(<UploadGuideBlock />);

    const links = screen.getAllByRole('link', { name: /accounts center/i });
    expect(links).toHaveLength(1);
    const cta = links[0];
    expect(cta).toHaveAttribute('target', '_blank');
    expect(cta).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(cta).toHaveAttribute('href', ACCOUNTS_CENTER_URL);
  });

  it('reports the click as meta_accounts', async () => {
    const user = userEvent.setup();
    render(<UploadGuideBlock />);

    await user.click(screen.getByRole('link', { name: /accounts center/i }));

    expect(analytics.linkClick).toHaveBeenCalledExactlyOnceWith('meta_accounts');
  });

  it('carries no "I already have my ZIP file" escape hatch', () => {
    // The drop zone is on the same page now; the link would point at itself.
    render(<UploadGuideBlock />);

    expect(screen.queryByRole('link', { name: /already have/i })).toBeNull();
  });

  it('puts the two highest-CTR messages under the button, not in cards', () => {
    render(<UploadGuideBlock />);

    const cta = screen.getByRole('link', { name: /accounts center/i });
    const subtext = cta.parentElement!;
    expect(within(subtext).getByText(/no login/i)).toBeInTheDocument();
    expect(within(subtext).getByText(/never uploaded/i)).toBeInTheDocument();
  });

  it('states our cost and disclaims theirs, as two separate keys', () => {
    render(<UploadGuideBlock />);

    expect(screen.getByText(/about 2 minutes/i)).toBeInTheDocument();
    expect(screen.getByText(/the wait is theirs/i)).toBeInTheDocument();
  });

  it('heads the section at level 2 — UploadZone owns the page heading', () => {
    render(<UploadGuideBlock />);

    expect(
      screen.getByRole('heading', { level: 2, name: wizardEN.entry.title })
    ).toBeInTheDocument();
  });

  it('renders the recipe card and the closed step accordion as reference material', () => {
    render(<UploadGuideBlock />);

    expect(screen.getByRole('group', { name: /instagram's dialog/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /step-by-step/i })).toBeInTheDocument();
    // Accordion starts closed — its links are not reachable before the click.
    expect(screen.queryByRole('link', { name: /step 2/i })).not.toBeInTheDocument();
  });
});

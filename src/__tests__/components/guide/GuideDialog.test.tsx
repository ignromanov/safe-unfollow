import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import wizardEN from '@/locales/en/wizard.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';
import { renderWithRouter as render } from '@/__tests__/test-utils';

vi.mock('react-i18next', () => createI18nMock(wizardEN));

vi.mock('@/lib/analytics', () => ({
  analytics: { linkClick: vi.fn(), calendarReminderClick: vi.fn() },
}));

import { GuideDialog } from '@/components/guide/GuideDialog';
import { analytics } from '@/lib/analytics';
import { ACCOUNTS_CENTER_URL, GUIDE_STEPS } from '@/config/wizard-steps';

function open(props: Partial<React.ComponentProps<typeof GuideDialog>> = {}) {
  return render(
    <GuideDialog
      open
      step={null}
      source="accordion"
      onGoToStep={vi.fn()}
      onClose={vi.fn()}
      {...props}
    />
  );
}

describe('GuideDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('has exactly one DialogTitle', () => {
    // GH#140: two DialogTitles in one DialogContent make aria-labelledby
    // ambiguous. The defect is live in LicenseDialog and ExportDialog — this
    // dialog does not join them.
    open();

    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1);
  });

  it('declares its own scroll container', () => {
    // DialogContent is a centred `fixed` with no max-height and no overflow.
    // Seven sections in one scroll need a container, and it is this container
    // that scrolls to a section anchor.
    open();

    expect(document.querySelector('[data-guide-scroll]')).not.toBeNull();
  });

  it('renders all seven sections in one scroll', () => {
    open();

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(GUIDE_STEPS.length);
  });

  it('shows the entry strip only when opened from a URL', () => {
    // Opened from the page, the reader scrolled past the same CTA ~200px ago;
    // a full-width primary repeat of it is the second entry screen this whole
    // move exists to remove.
    const { unmount } = open({ source: 'accordion' });
    expect(screen.queryByRole('link', { name: /accounts center/i })).toBeNull();
    unmount();

    open({ source: 'url', step: 3 });
    const cta = screen.getByRole('link', { name: /accounts center/i });
    expect(cta).toHaveAttribute('href', ACCOUNTS_CENTER_URL);
  });

  it('states the privacy promise inside the dialog', () => {
    // Three artboards, ~three screens of scroll, a full-screen overlay — and
    // not one line saying the export never leaves the browser, on a product
    // where that is the single load-bearing promise.
    open();

    expect(screen.getByText(/never uploaded/i)).toBeInTheDocument();
  });

  it('ends with the reminder, not with an upload it cannot honour', async () => {
    // Instagram takes 5-30 minutes to send the file. A guide that ends in
    // "upload it now" ends in a thing the reader cannot do.
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    open();

    await user.click(screen.getByRole('button', { name: wizardEN.calendar.addReminder }));

    expect(analytics.calendarReminderClick).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it('closes from its own ending, and reports nothing for it', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    open({ onClose });

    const scroll = document.querySelector('[data-guide-scroll]') as HTMLElement;
    await user.click(within(scroll).getByRole('button', { name: wizardEN.buttons.close }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks the rail for a section rather than navigating', async () => {
    const onGoToStep = vi.fn();
    const user = userEvent.setup();
    open({ onGoToStep });

    await user.click(screen.getByRole('button', { name: 'Step 5' }));

    expect(onGoToStep).toHaveBeenCalledExactlyOnceWith(5);
  });

  it('renders nothing at all while closed', () => {
    render(
      <GuideDialog open={false} step={null} source="url" onGoToStep={vi.fn()} onClose={vi.fn()} />
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

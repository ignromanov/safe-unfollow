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

  it('makes the scroll container reachable by keyboard in browsers that do not do this natively', () => {
    // Chrome focuses an overflow container by default; Firefox and Safari do
    // not, and the seven sections carry no interactive element of their own.
    open();

    const scroll = document.querySelector('[data-guide-scroll]') as HTMLElement;
    expect(scroll).toHaveAttribute('tabindex', '0');
    expect(scroll).toHaveAttribute('role', 'group');
    expect(scroll).toHaveAttribute(
      'aria-label',
      wizardEN.entry.accordion.trigger.replace('{{count}}', String(GUIDE_STEPS.length))
    );
  });

  it('moves focus to the newly claimed section, not just the viewport', () => {
    // A reader deep-linked to ?step=5 (or navigating between guide links
    // while the dialog stays open) would otherwise see section 5 while focus
    // stayed wherever Radix's own autofocus put it.
    //
    // Rendered via a step *change* rather than the initial mount: Radix's
    // Portal mounts its content in a second, layout-effect-driven commit, and
    // in this test harness our own scroll effect can run before that second
    // commit has attached `scrollRef` — a jsdom/testing-library ordering
    // artifact around Radix's two-pass Portal mount, not a claim about first
    // paint in a real browser. A step change onto an already-settled dialog
    // exercises the exact same scrollToStep/focus code the initial arrival
    // does, without depending on that ordering.
    const { rerender } = open({ step: 3, source: 'url' });
    rerender(<GuideDialog open step={5} source="url" onGoToStep={vi.fn()} onClose={vi.fn()} />);

    expect(document.activeElement).toBe(document.querySelector('#guide-step-5-heading'));
  });

  it('scrolls the section the rail is tapped for, even when it is the one already claimed', async () => {
    // Regression: tapping the rail segment for the current step used to be a
    // no-op, because the scroll effect keyed only on `step` and a tap on the
    // current step changes nothing in the URL.
    const scrollSpy = vi.fn();
    const originalScrollTo = Element.prototype.scrollTo;
    Element.prototype.scrollTo = scrollSpy;
    const user = userEvent.setup();
    open({ step: 5, source: 'url', onGoToStep: vi.fn() });
    scrollSpy.mockClear(); // drop the scroll from arrival itself

    await user.click(screen.getByRole('button', { name: 'Step 5' }));

    expect(scrollSpy).toHaveBeenCalled();
    Element.prototype.scrollTo = originalScrollTo;
  });

  it('renders nothing at all while closed', () => {
    render(
      <GuideDialog open={false} step={null} source="url" onGoToStep={vi.fn()} onClose={vi.fn()} />
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

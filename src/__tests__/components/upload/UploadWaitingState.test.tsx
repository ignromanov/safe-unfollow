import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import uploadEN from '@/locales/en/upload.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(uploadEN));

vi.mock('@/lib/analytics', () => ({ analytics: { calendarReminderClick: vi.fn() } }));

import { UploadWaitingState } from '@/components/upload/UploadWaitingState';
import { analytics } from '@/lib/analytics';

describe('UploadWaitingState', () => {
  beforeEach(() => vi.clearAllMocks());

  it('says the two operationally true things the design never said', () => {
    // Twelve upload.waiting.* keys have been translated into ten locales since
    // the wizard shipped with nothing in src/ rendering any of them. These two
    // sentences are why that mattered.
    const { container } = render(<UploadWaitingState onUploadNow={vi.fn()} onDismiss={vi.fn()} />);

    expect(container.textContent).toMatch(/spam/i);

    // The expiry sentence is inside a <Trans> (it bolds "Meta" and
    // "Instagram"), and createI18nMock's Trans renders the key rather than
    // resolving it — so the DOM can only show that the component asked for
    // this key, and the bundle has to show what the key says. Asserting one
    // without the other would pass on a component that rendered nothing.
    expect(container.textContent).toContain('waiting.proTipHint');
    expect(uploadEN.waiting.proTipHint).toMatch(/4 days/i);
  });

  it('reports the reminder on the same event as every other surface', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'open').mockReturnValue(null);
    render(<UploadWaitingState onUploadNow={vi.fn()} onDismiss={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: uploadEN.waiting.addReminder }));

    // One series, three surfaces. If they ever need telling apart, that is a
    // payload on this event, not a second event.
    expect(analytics.calendarReminderClick).toHaveBeenCalledTimes(1);
  });

  it('offers the file picker to someone who turns out to have the file', async () => {
    const onUploadNow = vi.fn();
    const user = userEvent.setup();
    render(<UploadWaitingState onUploadNow={onUploadNow} onDismiss={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: uploadEN.waiting.uploadNow }));

    expect(onUploadNow).toHaveBeenCalledTimes(1);
  });

  it('titles itself at the level the page leaves for it', () => {
    // /upload's heading order is h1 (UploadZone) - this - h2
    // (UploadGuideBlock), in that DOM order. An h3 here skipped a level in
    // the middle of the document, and nothing caught it: src/__tests__/a11y/
    // holds two contrast tests and no axe harness, so heading order is not
    // gated anywhere on this page.
    //
    // The level is pinned here rather than in UploadZone's test because
    // reaching this block through the page means clicking a target="_blank"
    // link, which jsdom answers with a "not implemented" navigation. What the
    // page owns is the ORDER; what this component owns is its own level.
    render(<UploadWaitingState onUploadNow={vi.fn()} onDismiss={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(uploadEN.waiting.title);
  });

  it('draws both of its closing choices as controls, at one target size', () => {
    // "Upload Now" opens the OS file picker and was 14px of underlined text;
    // "Skip for now" was 12px of grey. Neither had a min-height, so the block
    // ended in two things a thumb cannot reliably hit - the same defect the
    // guide dialog's closing card had.
    //
    // Subjects come out of the DOM rather than being named one by one: a third
    // choice added to this group is bound by this the day it appears. Naming
    // them by hand is the shape progress.md P1 row 14 describes. jsdom computes
    // no layout, so what is pinned is the class that produces the height.
    render(<UploadWaitingState onUploadNow={vi.fn()} onDismiss={vi.fn()} />);

    const group = screen
      .getByRole('button', { name: uploadEN.waiting.uploadNow })
      .closest('div') as HTMLElement;
    const controls = group.querySelectorAll('button');

    expect(controls).toHaveLength(2);
    for (const control of controls) {
      expect(control.className).toContain('min-h-[48px]');
    }
  });
});

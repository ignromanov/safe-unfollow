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
});

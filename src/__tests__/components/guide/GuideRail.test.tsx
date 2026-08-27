import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import wizardEN from '@/locales/en/wizard.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(wizardEN));

import { GuideRail } from '@/components/guide/GuideRail';
import { GUIDE_STEPS } from '@/config/wizard-steps';

describe('GuideRail', () => {
  it('exposes seven controls, not seven decorations', () => {
    // A segmented bar at the top of a mobile modal is one of the most tapped
    // non-controls in onboarding. A dead affordance is a defect, not
    // neutrality — and the anchors it needs exist already, for ?step.
    render(<GuideRail current={3} onSelect={vi.fn()} />);

    expect(screen.getAllByRole('button')).toHaveLength(GUIDE_STEPS.length);
  });

  it('meets the touch target floor', () => {
    // 44px is the floor. These seven sit side by side across a 390px
    // viewport: max-w-[calc(100%-2rem)] gives 358px, minus the header's
    // px-4 (16) and pe-12 (48) leaves a 294px content box, i.e. ~42px each
    // horizontally (37.7px at 360px) — narrower than the 44px floor, but
    // still clear of WCAG 2.5.8's 24px minimum. Height is the binding
    // dimension here, not width.
    render(<GuideRail current={1} onSelect={vi.fn()} />);

    expect(screen.getAllByRole('button')[0]!.className).toMatch(/min-h-\[44px\]|min-h-11/);
  });

  it('names its position for a screen reader', () => {
    render(<GuideRail current={3} onSelect={vi.fn()} />);

    expect(screen.getAllByRole('button')[2]).toHaveAttribute('aria-current', 'step');
    expect(screen.getAllByRole('button')[1]).not.toHaveAttribute('aria-current');
  });

  it('reports the section a tap asked for', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<GuideRail current={1} onSelect={onSelect} />);

    await user.click(screen.getAllByRole('button')[4]!);

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(5);
  });

  it('says where the reader is, in words as well as fill', () => {
    render(<GuideRail current={4} onSelect={vi.fn()} />);

    expect(screen.getByText(/step 4 of 7/i)).toBeInTheDocument();
  });

  it('counts nothing when no section is claimed', () => {
    // ?guide=1 opens the dialog with no claim to a section. A rail that
    // asserted "Step 1 of 7" there would be inventing a position.
    render(<GuideRail current={null} onSelect={vi.fn()} />);

    expect(screen.queryByText(/step \d+ of 7/i)).toBeNull();
    expect(screen.queryByRole('button', { current: 'step' })).toBeNull();
  });

  it('gives an unfilled segment a track that clears WCAG 1.4.11 contrast', () => {
    // bg-border measured 1.27:1 light / 1.18:1 dark against the card — far
    // short of the 3:1 floor for a non-text UI component. bg-muted-foreground
    // is the only option that clears it in both themes without an alpha
    // modifier washing it back out against the near-white card.
    render(<GuideRail current={3} onSelect={vi.fn()} />);

    const segments = screen.getAllByRole('button').map(button => button.querySelector('span'));
    expect(segments[6]!.className).toContain('bg-muted-foreground');
    expect(segments[6]!.className).not.toContain('bg-border');
    expect(segments[0]!.className).toContain('bg-primary');
  });
});

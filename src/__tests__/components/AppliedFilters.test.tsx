import { vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppliedFilters } from '@/components/AppliedFilters';
import { BADGE_CHIP_LABEL_CLASS, BADGE_CHIP_STYLES } from '@/constants/badge-styles';
import { BADGE_ORDER } from '@/core/badges';
import resultsEN from '@/locales/en/results.json';
import type { BadgeKey } from '@/core/types';

// react-i18next is already mocked globally in vitest.setup.ts

describe('AppliedFilters', () => {
  it('should render nothing when no filter is applied', () => {
    const { container } = render(
      <AppliedFilters selectedFilters={new Set()} onRemove={vi.fn()} onClearAll={vi.fn()} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('should name each applied filter', () => {
    render(
      <AppliedFilters
        selectedFilters={new Set<BadgeKey>(['unfollowed', 'pending'])}
        onRemove={vi.fn()}
        onClearAll={vi.fn()}
      />
    );

    expect(screen.getByText(resultsEN.badges.unfollowed)).toBeInTheDocument();
    expect(screen.getByText(resultsEN.badges.pending)).toBeInTheDocument();
  });

  // Pins WHERE the chip colours live. The contrast gate proves the pair is
  // legible; this proves the component reaches for the badge's own hue rather
  // than one shared fill. Derived from BADGE_CHIP_STYLES and BADGE_ORDER, so a
  // badge added without a chip style fails here as a missing class rather than
  // rendering an unstyled chip.
  it('gives each chip its own badge colour, not one shared blue', () => {
    render(
      <AppliedFilters
        selectedFilters={new Set<BadgeKey>(BADGE_ORDER)}
        onRemove={vi.fn()}
        onClearAll={vi.fn()}
      />
    );

    const chips = screen.getAllByRole('listitem').map(li => within(li).getByRole('button'));
    expect(chips).toHaveLength(BADGE_ORDER.length);

    BADGE_ORDER.forEach((badge, i) => {
      expect(chips[i], badge).toHaveClass(
        ...BADGE_CHIP_STYLES[badge].split(' '),
        ...BADGE_CHIP_LABEL_CLASS.split(' ')
      );
      expect(chips[i].className, badge).not.toContain('bg-primary');
    });
  });

  // Names the exact step expected here. It is no longer the only thing holding
  // it: `results-surface-contrast.test.ts` now reads this control's class list
  // off a render, so a revert to `text-rose-500` fails the contrast arithmetic
  // as well. Kept because this assertion says *which* colour was chosen, which
  // a ratio cannot.
  it('keeps the Reset control on the colour the contrast gate measured', () => {
    render(
      <AppliedFilters
        selectedFilters={new Set<BadgeKey>(['unfollowed'])}
        onRemove={vi.fn()}
        onClearAll={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: resultsEN.filters.reset })).toHaveClass(
      'text-rose-600',
      'dark:text-rose-400'
    );
  });

  it('should remove exactly the filter whose control was pressed', async () => {
    const onRemove = vi.fn();
    render(
      <AppliedFilters
        selectedFilters={new Set<BadgeKey>(['unfollowed', 'pending'])}
        onRemove={onRemove}
        onClearAll={vi.fn()}
      />
    );

    await userEvent.click(
      screen.getByRole('button', {
        name: resultsEN.filters.removeOne.replace('{{label}}', resultsEN.badges.pending),
      })
    );

    expect(onRemove).toHaveBeenCalledWith('pending');
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

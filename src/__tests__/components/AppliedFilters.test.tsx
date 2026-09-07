import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppliedFilters } from '@/components/AppliedFilters';
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

  // Pins WHERE the colour from `results-surface-contrast.test.ts` is applied.
  // That file only computes the arithmetic on the pinned oklch literals; a
  // revert of this class list would leave it green with nothing else to
  // notice the regression.
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

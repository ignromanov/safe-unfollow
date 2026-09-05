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

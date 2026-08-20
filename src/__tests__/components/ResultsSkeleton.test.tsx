import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { ResultsSkeleton } from '@/components/ResultsSkeleton';

describe('ResultsSkeleton', () => {
  it('should announce itself as busy rather than as content', () => {
    render(<ResultsSkeleton />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
  });

  it('should reuse the filter and list skeletons instead of drawing its own', () => {
    render(<ResultsSkeleton />);

    expect(screen.getByTestId('filter-chips-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('account-list-skeleton')).toBeInTheDocument();
  });

  it('should carry no text, so the prerendered document is identical in every locale', () => {
    // This is the load-bearing property, not a style preference. `/results` is prerendered
    // once per language; a skeleton that reads a translation would make ten documents that
    // differ, and would put i18n on the path of the one render that must not wait for it.
    const { container } = render(<ResultsSkeleton />);

    expect(container.textContent).toBe('');
  });

  it('should reserve the four stat cards the loaded page shows', () => {
    // The skeleton exists to hold the layout still across the swap. Dropping the cards
    // would shift everything below them by their height once the data arrives.
    render(<ResultsSkeleton />);

    expect(screen.getAllByTestId('stat-card-skeleton')).toHaveLength(4);
  });
});

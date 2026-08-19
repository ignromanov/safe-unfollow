import { vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterChips } from '@/components/FilterChips';
import type { BadgeKey } from '@/core/types';
import resultsEN from '@/locales/en/results.json';

// react-i18next is already mocked globally in vitest.setup.ts

describe('FilterChips Component', () => {
  const defaultFilterCounts: Record<BadgeKey, number> = {
    followers: 100,
    following: 150,
    mutuals: 50,
    notFollowingBack: 25,
    notFollowedBack: 10,
    unfollowed: 5,
    pending: 3,
    permanent: 2,
    restricted: 1,
    close: 8,
    dismissed: 0,
  };

  const defaultProps = {
    selectedFilters: new Set<BadgeKey>(),
    onFiltersChange: vi.fn(),
    filterCounts: defaultFilterCounts,
    isFiltering: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      render(<FilterChips {...defaultProps} />);

      expect(screen.getByText(resultsEN.filters.title)).toBeInTheDocument();
    });

    it('should render filter chips for badges with non-zero counts', () => {
      render(<FilterChips {...defaultProps} />);

      expect(screen.getByText(resultsEN.badges.followers)).toBeInTheDocument();
      expect(screen.getByText(resultsEN.badges.following)).toBeInTheDocument();
      expect(screen.getByText(resultsEN.badges.mutuals)).toBeInTheDocument();
      expect(screen.getByText(resultsEN.badges.notFollowingBack)).toBeInTheDocument();
    });

    it('should display badge counts', () => {
      render(<FilterChips {...defaultProps} />);

      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
    });

    it('should format large counts with locale separators', () => {
      const propsWithLargeCounts = {
        ...defaultProps,
        filterCounts: {
          ...defaultFilterCounts,
          followers: 1234567,
        },
      };

      render(<FilterChips {...propsWithLargeCounts} />);

      expect(screen.getByText('1,234,567')).toBeInTheDocument();
    });

    it('should show filter icon in header', () => {
      render(<FilterChips {...defaultProps} />);

      const filterIcon = document.querySelector('svg');
      expect(filterIcon).toBeInTheDocument();
    });
  });

  describe('filter interactions', () => {
    it('should call onFiltersChange when clicking a filter chip', () => {
      const mockOnFiltersChange = vi.fn();
      render(<FilterChips {...defaultProps} onFiltersChange={mockOnFiltersChange} />);

      const followersButton = screen.getByRole('button', { name: /followers/i });
      fireEvent.click(followersButton);

      expect(mockOnFiltersChange).toHaveBeenCalledTimes(1);
      const newFilters = mockOnFiltersChange.mock.calls[0][0];
      expect(newFilters.has('followers')).toBe(true);
    });

    it('should toggle filter off when clicking an active filter', () => {
      const mockOnFiltersChange = vi.fn();
      const selectedFilters = new Set<BadgeKey>(['followers']);

      render(
        <FilterChips
          {...defaultProps}
          selectedFilters={selectedFilters}
          onFiltersChange={mockOnFiltersChange}
        />
      );

      const followersButton = screen.getByRole('button', { name: /followers/i });
      fireEvent.click(followersButton);

      expect(mockOnFiltersChange).toHaveBeenCalledTimes(1);
      const newFilters = mockOnFiltersChange.mock.calls[0][0];
      expect(newFilters.has('followers')).toBe(false);
    });

    it('should have aria-pressed=true for active filters', () => {
      const selectedFilters = new Set<BadgeKey>(['followers']);

      render(<FilterChips {...defaultProps} selectedFilters={selectedFilters} />);

      const followersButton = screen.getByRole('button', { name: /followers/i });
      expect(followersButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should have aria-pressed=false for inactive filters', () => {
      render(<FilterChips {...defaultProps} />);

      const followersButton = screen.getByRole('button', { name: /followers/i });
      expect(followersButton).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('reset functionality', () => {
    it('should not show reset button when no filters are selected', () => {
      render(<FilterChips {...defaultProps} />);

      expect(screen.queryByText(resultsEN.filters.reset)).not.toBeInTheDocument();
    });

    it('should show reset button when filters are selected', () => {
      const selectedFilters = new Set<BadgeKey>(['followers']);

      render(<FilterChips {...defaultProps} selectedFilters={selectedFilters} />);

      expect(screen.getByText(resultsEN.filters.reset)).toBeInTheDocument();
    });

    it('should call onFiltersChange with empty set when reset is clicked', () => {
      const mockOnFiltersChange = vi.fn();
      const selectedFilters = new Set<BadgeKey>(['followers', 'following']);

      render(
        <FilterChips
          {...defaultProps}
          selectedFilters={selectedFilters}
          onFiltersChange={mockOnFiltersChange}
        />
      );

      const resetButton = screen.getByText(resultsEN.filters.reset);
      fireEvent.click(resetButton);

      expect(mockOnFiltersChange).toHaveBeenCalledWith(new Set());
    });
  });

  describe('empty categories', () => {
    it('should show empty categories toggle when some badges have zero count', () => {
      render(<FilterChips {...defaultProps} />);

      expect(screen.getByText(/Empty Categories/i)).toBeInTheDocument();
    });

    it('should not show empty categories section when all badges have counts', () => {
      const allNonZeroCounts: Record<BadgeKey, number> = {
        followers: 100,
        following: 150,
        mutuals: 50,
        notFollowingBack: 25,
        notFollowedBack: 10,
        unfollowed: 5,
        pending: 3,
        permanent: 2,
        restricted: 1,
        close: 8,
        dismissed: 1, // Now non-zero
      };

      render(<FilterChips {...defaultProps} filterCounts={allNonZeroCounts} />);

      expect(screen.queryByText(/Empty Categories/i)).not.toBeInTheDocument();
    });

    it('should toggle empty categories visibility when clicked', () => {
      render(<FilterChips {...defaultProps} />);

      const toggleButton = screen.getByText(/Empty Categories/i);

      const dismissedChips = screen.queryAllByText(resultsEN.badges.dismissed);
      expect(dismissedChips).toHaveLength(0);

      fireEvent.click(toggleButton);

      expect(screen.getByText(resultsEN.badges.dismissed)).toBeInTheDocument();
    });
  });

  describe('multiple filters', () => {
    it('should allow selecting multiple filters', () => {
      const mockOnFiltersChange = vi.fn();
      const selectedFilters = new Set<BadgeKey>(['followers']);

      render(
        <FilterChips
          {...defaultProps}
          selectedFilters={selectedFilters}
          onFiltersChange={mockOnFiltersChange}
        />
      );

      // Click on following (which is not selected)
      // Use exact aria-label pattern to avoid matching "Not following back"
      const followingButton = screen.getByRole('button', {
        name: /Add Following filter/i,
      });
      fireEvent.click(followingButton);

      expect(mockOnFiltersChange).toHaveBeenCalledTimes(1);
      const newFilters = mockOnFiltersChange.mock.calls[0][0];
      expect(newFilters.has('followers')).toBe(true);
      expect(newFilters.has('following')).toBe(true);
    });
  });

  describe('translations', () => {
    it('should use translated badge labels', () => {
      render(<FilterChips {...defaultProps} />);

      expect(screen.getByText(resultsEN.badges.followers)).toBeInTheDocument();
      expect(screen.getByText(resultsEN.badges.following)).toBeInTheDocument();
      expect(screen.getByText(resultsEN.badges.mutuals)).toBeInTheDocument();
      expect(screen.getByText(resultsEN.badges.notFollowingBack)).toBeInTheDocument();
    });

    it('should use translated filter title', () => {
      render(<FilterChips {...defaultProps} />);

      expect(screen.getByText(resultsEN.filters.title)).toBeInTheDocument();
    });
  });

  /**
   * The page-level notice explains the problem; the chip is where the wrong
   * number is actually read, and on a phone the two are a scroll apart.
   */
  describe('marks on counts that cannot be trusted', () => {
    const chipName = (fragment: string) =>
      screen.getByRole('button', { name: new RegExp(fragment, 'i') });

    const hint = resultsEN.caveat.followRequests.chipHint;
    const hintPattern = new RegExp(hint.slice(0, 20), 'i');
    const truncatedHint = resultsEN.caveat.truncated.followers.chipHint;
    const truncatedPattern = new RegExp(truncatedHint.slice(0, 20), 'i');

    it('marks the notFollowingBack chip when a follow-requests file was unreadable', () => {
      render(<FilterChips {...defaultProps} followRequestsUnreadable />);

      const chipLabel = resultsEN.filters.addFilter
        .replace('{{label}}', resultsEN.badges.notFollowingBack)
        .replace('{{count, number}}', '25');

      // The whole accessible name, not a fragment: the separator between the
      // two halves comes from `filters.chipWithHint`, which is what lets `ar`
      // and `ja` join them without the em dash their own copy avoids. A
      // hardcoded dash in the component would pass a fragment match and fail
      // this one.
      expect(chipName('Add Not following back filter')).toHaveAccessibleName(
        resultsEN.filters.chipWithHint.replace('{{label}}', chipLabel).replace('{{hint}}', hint)
      );
    });

    it('leaves every other chip alone', () => {
      render(<FilterChips {...defaultProps} followRequestsUnreadable />);

      expect(chipName('Add Followers filter')).not.toHaveAccessibleName(hintPattern);
    });

    it('marks nothing when the follow-requests files read fine', () => {
      render(<FilterChips {...defaultProps} />);

      expect(chipName('Add Not following back filter')).not.toHaveAccessibleName(hintPattern);
    });

    /**
     * Four chips, not one, and not the same four in both directions. A short
     * followers file drives notFollowingBack UP while driving followers,
     * mutuals and notFollowedBack DOWN, so the mark cannot mean "overstated"
     * and cannot be a single badge.
     */
    it('marks every chip a short followers file corrupts', () => {
      render(<FilterChips {...defaultProps} truncatedRelationshipFile="followers" />);

      for (const label of [
        'Add Not following back filter',
        'Add Not followed back filter',
        'Add Followers filter',
        'Add Mutuals filter',
      ]) {
        expect(chipName(label)).toHaveAccessibleName(truncatedPattern);
      }
    });

    it('marks the other set when the other file is the short one', () => {
      render(<FilterChips {...defaultProps} truncatedRelationshipFile="following" />);

      expect(chipName('Add Following filter')).toHaveAccessibleName(
        new RegExp(resultsEN.caveat.truncated.following.chipHint.slice(0, 20), 'i')
      );
      expect(chipName('Add Followers filter')).not.toHaveAccessibleName(truncatedPattern);
    });

    it('marks nothing when neither file looks short', () => {
      render(<FilterChips {...defaultProps} />);

      expect(chipName('Add Mutuals filter')).not.toHaveAccessibleName(truncatedPattern);
    });

    /**
     * Both causes can hit notFollowingBack at once. The chip carries one hint,
     * because its job is "this number cannot be trusted, read the notice", and
     * both notices are on the page — reciting two causes inside an aria-label
     * costs more than it explains.
     */
    it('gives one hint, not two, when both causes apply to the same chip', () => {
      render(
        <FilterChips
          {...defaultProps}
          followRequestsUnreadable
          truncatedRelationshipFile="followers"
        />
      );

      const name = chipName('Add Not following back filter');
      expect(name).toHaveAccessibleName(truncatedPattern);
      expect(name).not.toHaveAccessibleName(hintPattern);
    });
  });

  // An active chip fills with --primary. A literal white on it measures 3.95:1 in
  // light and 3.30:1 in dark; inside the bg-white/20 count pill it drops further,
  // to 2.97:1 and 2.53:1, which fails even the 3:1 allowance for graphics.
  describe('active chip drives its text from the token, not a literal colour', () => {
    const renderWithActiveChip = () =>
      render(<FilterChips {...defaultProps} selectedFilters={new Set<BadgeKey>(['following'])} />);

    const activeChip = () => screen.getByRole('button', { pressed: true, name: /following/i });

    it('has no literal text-white anywhere in the active chip', () => {
      renderWithActiveChip();

      const chip = activeChip();
      // `querySelectorAll` does not return the element it is called on, so the
      // chip itself has to be prepended — without it this assertion stays green
      // while the chip's own class carries the literal (verified by mutation).
      const candidates = [chip, ...Array.from(chip.querySelectorAll<HTMLElement>('*'))];
      // bg-white/20 is a surface tint and stays — it lightens the fill, which is
      // what lifts the dark token on it to 6.84:1 (light) / 8.03:1 (dark).
      const offenders = candidates.filter(el => /(?<!bg-)\btext-white\b/.test(el.className));
      expect(offenders.map(el => el.className)).toEqual([]);
    });

    it('colours the chip itself with text-primary-foreground', () => {
      renderWithActiveChip();

      expect(activeChip()).toHaveClass('bg-primary', 'text-primary-foreground');
    });

    it('colours the count pill with the token', () => {
      renderWithActiveChip();

      const pill = screen.getByText('150');
      expect(pill).toHaveClass('bg-white/20', 'text-primary-foreground');
    });

    it('colours the badge icon with the token', () => {
      renderWithActiveChip();

      const icon = activeChip().querySelector('svg');
      expect(icon).toHaveClass('text-primary-foreground');
    });

    // The GH#41 marker renders on a condition, so it is absent from every case
    // above — and it arrived carrying the literal this describe forbids while
    // all of them stayed green. `toHaveClass`, not the class sweep: an SVG's
    // `className` is an SVGAnimatedString, so the regex above reads
    // "[object SVGAnimatedString]" and matches nothing on any icon.
    it('colours the unreliable-count marker with the token', () => {
      render(
        <FilterChips
          {...defaultProps}
          selectedFilters={new Set<BadgeKey>(['notFollowingBack'])}
          followRequestsUnreadable
        />
      );

      const chip = screen.getByRole('button', { pressed: true, name: /not following back/i });
      const icons = chip.querySelectorAll('svg');
      // Badge icon first, marker second — the marker sits beside the label.
      expect(icons).toHaveLength(2);
      expect(icons[1]).toHaveClass('text-primary-foreground');
      expect(icons[1]).not.toHaveClass('text-white');
    });
  });
});

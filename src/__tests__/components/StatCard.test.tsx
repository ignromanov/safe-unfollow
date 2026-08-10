import { vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatCard } from '@/components/StatCard';
import { Users } from 'lucide-react';
import type { BadgeKey } from '@/core/types';
import commonEN from '@/locales/en/common.json';
import { createI18nMockSingle } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMockSingle(commonEN));

describe('StatCard', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render stat card with label and value', () => {
    render(
      <StatCard
        icon={<Users data-testid="users-icon" />}
        label="Following"
        value={500}
        colorClass="bg-blue-500/10 text-blue-500"
        badgeType="following"
        isActive={false}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText('Following')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('should render icon', () => {
    render(
      <StatCard
        icon={<Users data-testid="users-icon" />}
        label="Following"
        value={500}
        colorClass="bg-blue-500/10 text-blue-500"
        badgeType="following"
        isActive={false}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByTestId('users-icon')).toBeInTheDocument();
  });

  it('should format value with locale string', () => {
    render(
      <StatCard
        icon={<Users />}
        label="Following"
        value={1234567}
        colorClass="bg-blue-500/10 text-blue-500"
        badgeType="following"
        isActive={false}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText('1,234,567')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    render(
      <StatCard
        icon={<Users />}
        label="Following"
        value={500}
        colorClass="bg-blue-500/10 text-blue-500"
        badgeType="following"
        isActive={false}
        onClick={mockOnClick}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(mockOnClick).toHaveBeenCalledWith('following');
  });

  it('should show active state when filter is active', () => {
    render(
      <StatCard
        icon={<Users />}
        label="Following"
        value={500}
        colorClass="bg-blue-500/10 text-blue-500"
        badgeType="following"
        isActive={true}
        onClick={mockOnClick}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveClass('bg-primary', 'border-primary');
  });

  it('should show inactive state when filter is not active', () => {
    render(
      <StatCard
        icon={<Users />}
        label="Following"
        value={500}
        colorClass="bg-blue-500/10 text-blue-500"
        badgeType="following"
        isActive={false}
        onClick={mockOnClick}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveClass('bg-card', 'border-border');
  });

  it('should have proper aria-label for active filter', () => {
    render(
      <StatCard
        icon={<Users />}
        label="Following"
        value={500}
        colorClass="bg-blue-500/10 text-blue-500"
        badgeType="following"
        isActive={true}
        onClick={mockOnClick}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label');
    expect(button.getAttribute('aria-label')).toContain('Remove');
    expect(button.getAttribute('aria-label')).toContain('Following');
  });

  it('should have proper aria-label for inactive filter', () => {
    render(
      <StatCard
        icon={<Users />}
        label="Following"
        value={500}
        colorClass="bg-blue-500/10 text-blue-500"
        badgeType="following"
        isActive={false}
        onClick={mockOnClick}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label');
    expect(button.getAttribute('aria-label')).toContain('Add');
    expect(button.getAttribute('aria-label')).toContain('Following');
  });

  it('should be disabled when no badgeType provided', () => {
    render(
      <StatCard
        icon={<Users />}
        label="Total"
        value={500}
        colorClass="bg-gray-500/10 text-gray-500"
        isActive={false}
        onClick={mockOnClick}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should not call onClick when disabled', () => {
    render(
      <StatCard
        icon={<Users />}
        label="Total"
        value={500}
        colorClass="bg-gray-500/10 text-gray-500"
        isActive={false}
        onClick={mockOnClick}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('should handle zero value', () => {
    render(
      <StatCard
        icon={<Users />}
        label="Following"
        value={0}
        colorClass="bg-blue-500/10 text-blue-500"
        badgeType="following"
        isActive={false}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('should apply custom color class when inactive', () => {
    const { container } = render(
      <StatCard
        icon={<Users />}
        label="Following"
        value={500}
        colorClass="bg-blue-500/10 text-blue-500"
        badgeType="following"
        isActive={false}
        onClick={mockOnClick}
      />
    );

    const iconWrapper = container.querySelector('.bg-blue-500\\/10');
    expect(iconWrapper).toBeInTheDocument();
  });

  it('should render as button element', () => {
    render(
      <StatCard
        icon={<Users />}
        label="Following"
        value={500}
        colorClass="bg-blue-500/10 text-blue-500"
        badgeType="following"
        isActive={false}
        onClick={mockOnClick}
      />
    );

    const button = screen.getByRole('button');
    expect(button.tagName).toBe('BUTTON');
  });

  it('should handle different badge types', () => {
    const badges: Array<{ type: BadgeKey; label: string }> = [
      { type: 'following', label: 'Following' },
      { type: 'followers', label: 'Followers' },
      { type: 'mutuals', label: 'Mutuals' },
      { type: 'notFollowingBack', label: 'Not Following Back' },
    ];

    badges.forEach(badge => {
      const { unmount } = render(
        <StatCard
          icon={<Users />}
          label={badge.label}
          value={100}
          colorClass="bg-blue-500/10 text-blue-500"
          badgeType={badge.type}
          isActive={false}
          onClick={mockOnClick}
        />
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);
      expect(mockOnClick).toHaveBeenCalledWith(badge.type);

      unmount();
      mockOnClick.mockClear();
    });
  });

  it('should maintain active state across multiple filters', () => {
    render(
      <StatCard
        icon={<Users />}
        label="Following"
        value={500}
        colorClass="bg-blue-500/10 text-blue-500"
        badgeType="following"
        isActive={true}
        onClick={mockOnClick}
      />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  // The active card fills with --primary. A literal white on it measures 3.95:1
  // in light and 3.30:1 in dark; the token clears AA in both. The repo-wide text
  // sweep in a11y/primary-contrast.test.ts cannot see this file, because the
  // `bg-primary` is eight lines above the colours it governs — so assert on the
  // rendered classes instead.
  describe('active state drives its text from the token, not a literal colour', () => {
    const renderActive = () =>
      render(
        <StatCard
          icon={<Users data-testid="users-icon" />}
          label="Following"
          value={500}
          colorClass="bg-blue-500/10 text-blue-500"
          badgeType="following"
          isActive={true}
          onClick={mockOnClick}
        />
      );

    it('has no literal text-white anywhere in the active card', () => {
      const { container } = renderActive();

      const withWhiteText = container.querySelectorAll('[class*="text-white"]');
      expect(Array.from(withWhiteText).map(el => el.className)).toEqual([]);
    });

    it('colours the value with text-primary-foreground', () => {
      renderActive();

      expect(screen.getByText('500')).toHaveClass('text-primary-foreground');
    });

    it('fades the label to /90, the deepest fade that still clears AA', () => {
      renderActive();

      expect(screen.getByText('Following')).toHaveClass('text-primary-foreground/90');
    });

    it('colours the icon pill with the token', () => {
      renderActive();

      const pill = screen.getByTestId('users-icon').parentElement;
      expect(pill).toHaveClass('text-primary-foreground');
    });
  });
});

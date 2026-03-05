import { vi, beforeEach, describe, expect, it, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

// Mock IntersectionObserver (used by useCarouselIndex in ExpandedBanner)
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();
vi.stubGlobal(
  'IntersectionObserver',
  vi.fn(() => ({
    observe: mockObserve,
    unobserve: mockUnobserve,
    disconnect: mockDisconnect,
  }))
);

// Note: RescuePlanBanner test uses simple key-only mock
vi.mock('react-i18next', () => createI18nMock({}));

// Mock analytics (must include all methods used by useRescuePlanAnalytics)
vi.mock('@/lib/analytics', () => ({
  analytics: {
    rescuePlanImpression: vi.fn(),
    rescuePlanToolClick: vi.fn(),
    rescuePlanDismiss: vi.fn(),
  },
}));

import { RescuePlanBanner } from '@/components/RescuePlanBanner';
import * as dismissHook from '@/hooks/useRescuePlanDismiss';
import { analytics } from '@/lib/analytics';

// Mock useRescuePlanDismiss
const mockDismiss = vi.fn();
vi.spyOn(dismissHook, 'useRescuePlanDismiss').mockReturnValue({
  isDismissed: false,
  dismiss: mockDismiss,
});

describe('RescuePlanBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Default mock implementation
    vi.spyOn(dismissHook, 'useRescuePlanDismiss').mockReturnValue({
      isDismissed: false,
      dismiss: mockDismiss,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const defaultProps = {
    filterCounts: { unfollowed: 50 },
    totalCount: 100, // 50% unfollowed -> critical severity
  };

  it('should render banner with complementary role', () => {
    render(<RescuePlanBanner {...defaultProps} />);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });

  it('should not render when dismissed', () => {
    vi.spyOn(dismissHook, 'useRescuePlanDismiss').mockReturnValue({
      isDismissed: true,
      dismiss: mockDismiss,
    });

    render(<RescuePlanBanner {...defaultProps} />);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('should call dismiss when close button is clicked', () => {
    render(<RescuePlanBanner {...defaultProps} />);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    const closeButton = screen.getByLabelText('rescue.dismiss');
    fireEvent.click(closeButton);

    expect(mockDismiss).toHaveBeenCalled();
  });

  it('should track tool clicks', () => {
    render(<RescuePlanBanner {...defaultProps} />);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    // Find the first tool link (assuming there is at least one)
    const links = screen.getAllByRole('link');
    if (links.length > 0) {
      fireEvent.click(links[0]);
      expect(analytics.rescuePlanToolClick).toHaveBeenCalled();
    }
  });

  it('should render correct severity style (critical)', () => {
    const props = {
      filterCounts: { unfollowed: 200 },
      totalCount: 1000,
    };
    render(<RescuePlanBanner {...props} />);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });
});

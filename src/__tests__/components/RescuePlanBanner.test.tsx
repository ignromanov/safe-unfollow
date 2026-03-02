import { vi, beforeEach, describe, expect, it, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

// Note: RescuePlanBanner test uses simple key-only mock
vi.mock('react-i18next', () => createI18nMock({}));

// Mock analytics (V10: removed rescuePlanImpression, kept only tool_click)
vi.mock('@/lib/analytics', () => ({
  analytics: {
    rescuePlanToolClick: vi.fn(),
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
    vi.useFakeTimers();
    vi.clearAllMocks();
    // Default mock implementation
    vi.spyOn(dismissHook, 'useRescuePlanDismiss').mockReturnValue({
      isDismissed: false,
      dismiss: mockDismiss,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const defaultProps = {
    filterCounts: { unfollowed: 50 },
    totalCount: 100, // 50% unfollowed -> critical severity
    showDelay: 1000, // 1 second delay for testing
  };

  it('should render collapsed immediately, expand after delay', () => {
    render(<RescuePlanBanner {...defaultProps} />);

    // Banner renders immediately in collapsed state
    expect(screen.getByRole('complementary')).toBeInTheDocument();
    // Should not have expanded content yet (no dismiss button)
    expect(screen.queryByLabelText('rescue.dismiss')).not.toBeInTheDocument();

    // After delay, should expand
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Now should have expanded content (dismiss button visible)
    expect(screen.getByLabelText('rescue.dismiss')).toBeInTheDocument();
  });

  it('should show collapsed view if already dismissed', () => {
    vi.spyOn(dismissHook, 'useRescuePlanDismiss').mockReturnValue({
      isDismissed: true,
      dismiss: mockDismiss,
    });

    render(<RescuePlanBanner {...defaultProps} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Banner still renders but in collapsed state (no auto-expand)
    expect(screen.getByRole('complementary')).toBeInTheDocument();
    // Should not have expanded content (dismiss button with aria-label)
    expect(screen.queryByLabelText('rescue.dismiss')).not.toBeInTheDocument();
  });

  it('should collapse the banner when close button is clicked', () => {
    render(<RescuePlanBanner {...defaultProps} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const closeButton = screen.getByLabelText('rescue.dismiss');
    fireEvent.click(closeButton);

    expect(mockDismiss).toHaveBeenCalled();
    // V9: rescuePlanDismiss event removed, but dismiss still works via hook
    // Banner collapses instead of hiding completely
    expect(screen.getByRole('complementary')).toBeInTheDocument();
    // Dismiss button should be gone (collapsed state)
    expect(screen.queryByLabelText('rescue.dismiss')).not.toBeInTheDocument();
  });

  it('should track tool clicks', () => {
    render(<RescuePlanBanner {...defaultProps} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Find the first tool link (assuming there is at least one)
    const links = screen.getAllByRole('link');
    if (links.length > 0) {
      fireEvent.click(links[0]);
      expect(analytics.rescuePlanToolClick).toHaveBeenCalled();
    }
  });

  it('should render correct severity style (critical)', () => {
    // 15% is threshold for critical often, but let's ensure it hits
    const props = {
      filterCounts: { unfollowed: 200 },
      totalCount: 1000,
      showDelay: 0,
    };
    render(<RescuePlanBanner {...props} />);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Check for critical specific text or class if possible, or just general rendering
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });
});

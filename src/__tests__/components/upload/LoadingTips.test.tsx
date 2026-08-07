import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Shield } from 'lucide-react';

import { LoadingTips } from '@/components/upload/LoadingTips';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/lib/stats', () => ({
  analytics: {
    loadingTipImpression: vi.fn(),
  },
}));

vi.mock('@/config/loading-tips', () => ({
  LOADING_TIPS: [
    {
      id: 'privacy-tip',
      delayMs: 1000,
      titleKey: 'loadingTips.localProcessing.title',
      descKey: 'loadingTips.localProcessing.desc',
      icon: Shield,
      color: 'text-emerald-500',
    },
    {
      id: 'revoke-access',
      delayMs: 1100,
      titleKey: 'loadingTips.revokeAccess.title',
      descKey: 'loadingTips.revokeAccess.desc',
      icon: Shield,
      color: 'text-blue-600',
    },
  ],
}));

import { analytics } from '@/lib/stats';

describe('LoadingTips', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when not processing', () => {
    const { container } = render(<LoadingTips isProcessing={false} />);
    expect(container.firstChild).toBeNull();
  });

  describe('when processing starts', () => {
    it('mounts every card up front so revealing one cannot shift layout', () => {
      const { container } = render(<LoadingTips isProcessing={true} />);

      // Space is reserved immediately...
      expect(container.querySelectorAll('li')).toHaveLength(2);
      // ...but nothing is exposed to assistive tech yet.
      expect(screen.queryAllByRole('listitem')).toHaveLength(0);
      expect(analytics.loadingTipImpression).not.toHaveBeenCalled();
    });

    it('reveals the first tip after its delay', () => {
      render(<LoadingTips isProcessing={true} />);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getAllByRole('listitem')).toHaveLength(1);
      expect(screen.getByText('loadingTips.localProcessing.title')).toBeInTheDocument();
      expect(analytics.loadingTipImpression).toHaveBeenCalledWith('privacy-tip', 0, 1000);
    });

    it('reveals the second tip after its delay', () => {
      render(<LoadingTips isProcessing={true} />);

      act(() => {
        vi.advanceTimersByTime(1100);
      });

      expect(screen.getAllByRole('listitem')).toHaveLength(2);
      expect(screen.getByText('loadingTips.revokeAccess.title')).toBeInTheDocument();
      expect(analytics.loadingTipImpression).toHaveBeenCalledWith('revoke-access', 1, 1100);
    });
  });

  describe('teardown', () => {
    it('hides tips when processing stops', () => {
      const { rerender } = render(<LoadingTips isProcessing={true} />);

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getAllByRole('listitem')).toHaveLength(1);

      rerender(<LoadingTips isProcessing={false} />);
      expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    });

    it('clears pending timers on unmount', () => {
      const { unmount } = render(<LoadingTips isProcessing={true} />);

      unmount();
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(analytics.loadingTipImpression).not.toHaveBeenCalled();
    });
  });
});

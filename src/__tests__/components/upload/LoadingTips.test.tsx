import { render, screen, act, fireEvent } from '@testing-library/react';
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
    loadingTipClick: vi.fn(),
  },
}));

// Already-filtered list, mirroring what the config exports at runtime: one
// plain privacy tip plus one funded affiliate tip. The filtering itself is
// covered in __tests__/config/affiliate-links.test.ts.
vi.mock('@/config/loading-tips', () => ({
  VISIBLE_LOADING_TIPS: [
    {
      id: 'privacy-tip',
      delayMs: 1000,
      titleKey: 'loadingTips.localProcessing.title',
      descKey: 'loadingTips.localProcessing.desc',
      icon: Shield,
      color: 'text-emerald-500',
    },
    {
      id: 'nordvpn',
      delayMs: 5000,
      titleKey: 'loadingTips.nordvpn.title',
      descKey: 'loadingTips.nordvpn.desc',
      icon: Shield,
      color: 'text-teal-500',
      url: 'https://nordvpn.example/deal',
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

    it('keeps the not-yet-revealed affiliate link out of the tab order', () => {
      const { container } = render(<LoadingTips isProcessing={true} />);

      expect(container.querySelector('a')).toHaveAttribute('tabindex', '-1');
      expect(screen.queryByRole('link')).toBeNull();
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

    it('reveals the affiliate tip as an outbound link with a disclosure', () => {
      render(<LoadingTips isProcessing={true} />);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.getAllByRole('listitem')).toHaveLength(2);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'https://nordvpn.example/deal');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).not.toHaveAttribute('tabindex');
      expect(screen.getByText('loadingTips.affiliateDisclosure')).toBeInTheDocument();
      expect(screen.getByText('loadingTips.opensInNewTab')).toBeInTheDocument();
    });

    it('reports the click with the same index used for its impression', () => {
      render(<LoadingTips isProcessing={true} />);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      fireEvent.click(screen.getByRole('link'));

      expect(analytics.loadingTipImpression).toHaveBeenCalledWith('nordvpn', 1, 5000);
      expect(analytics.loadingTipClick).toHaveBeenCalledWith('nordvpn', 1, expect.any(Number));
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

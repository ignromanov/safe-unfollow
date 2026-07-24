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
    loadingTipClick: vi.fn(),
  },
}));

// Mixes a non-affiliate tip, a would-be-affiliate tip with an unset link (must be
// hidden), and an affiliate tip with a link (must render as an outbound anchor).
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
      id: 'hidden-affiliate',
      delayMs: 5000,
      titleKey: 'loadingTips.nordvpn.title',
      descKey: 'loadingTips.nordvpn.desc',
      icon: Shield,
      color: 'text-teal-500',
      url: '',
    },
    {
      id: 'nordvpn',
      delayMs: 10000,
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

  it('shows no tips initially when processing starts', () => {
    render(<LoadingTips isProcessing={true} />);
    expect(screen.queryByText(/localProcessing/)).toBeNull();
  });

  it('shows the non-affiliate tip after its delay', () => {
    render(<LoadingTips isProcessing={true} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('loadingTips.localProcessing.title')).toBeInTheDocument();
    expect(analytics.loadingTipImpression).toHaveBeenCalledWith('privacy-tip', 0, 1000);
  });

  it('never renders the affiliate tip whose link is unset', () => {
    render(<LoadingTips isProcessing={true} />);

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Only 2 tips should be visible: the privacy tip and the funded nordvpn tip.
    expect(screen.getAllByText('loadingTips.nordvpn.title')).toHaveLength(1);
    expect(analytics.loadingTipImpression).not.toHaveBeenCalledWith(
      'hidden-affiliate',
      expect.anything(),
      expect.anything()
    );
  });

  it('renders the funded NordVPN tip as an outbound link with a disclosure note', () => {
    render(<LoadingTips isProcessing={true} />);

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://nordvpn.example/deal');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('loadingTips.affiliateDisclosure')).toBeInTheDocument();
  });

  it('fires a click event when the NordVPN tip is clicked', () => {
    render(<LoadingTips isProcessing={true} />);

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    screen.getByRole('link').click();

    expect(analytics.loadingTipClick).toHaveBeenCalledWith('nordvpn', 1, expect.any(Number));
  });

  it('clears tips when processing stops', () => {
    const { rerender } = render(<LoadingTips isProcessing={true} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('loadingTips.localProcessing.title')).toBeInTheDocument();

    rerender(<LoadingTips isProcessing={false} />);
    expect(screen.queryByText('loadingTips.localProcessing.title')).toBeNull();
  });
});

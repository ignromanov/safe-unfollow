import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { LoadingTips } from '@/components/upload/LoadingTips';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock analytics
vi.mock('@/lib/analytics', () => ({
  analytics: {
    loadingTipImpression: vi.fn(),
    loadingTipClick: vi.fn(),
  },
}));

describe('LoadingTips', () => {
  beforeEach(() => {
    vi.useFakeTimers();
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
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('shows first tip after 1 second', () => {
    render(<LoadingTips isProcessing={true} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
  });

  it('shows second tip after 5 seconds', () => {
    render(<LoadingTips isProcessing={true} />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
  });

  it('shows all 3 tips after 10 seconds', () => {
    render(<LoadingTips isProcessing={true} />);

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(3);
  });

  it('clears tips when processing stops', () => {
    const { rerender, container } = render(<LoadingTips isProcessing={true} />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    rerender(<LoadingTips isProcessing={false} />);
    expect(container.firstChild).toBeNull();
  });
});

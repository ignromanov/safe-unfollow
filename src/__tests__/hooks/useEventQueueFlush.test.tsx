import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const flushEvents = vi.fn();
vi.mock('@/lib/stats/queue', () => ({
  flushEvents: () => flushEvents(),
}));

const mockPathname = vi.fn(() => '/upload');
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: mockPathname() }),
}));

import { useEventQueueFlush } from '@/hooks/useEventQueueFlush';

function Harness(): null {
  useEventQueueFlush();
  return null;
}

describe('useEventQueueFlush', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue('/upload');
  });

  it('does not flush on the first render', () => {
    render(<Harness />);

    expect(flushEvents).not.toHaveBeenCalled();
  });

  it('flushes when the route changes', () => {
    const { rerender } = render(<Harness />);

    mockPathname.mockReturnValue('/results');
    rerender(<Harness />);

    expect(flushEvents).toHaveBeenCalledTimes(1);
  });

  it('does not flush when a re-render keeps the same route', () => {
    const { rerender } = render(<Harness />);

    rerender(<Harness />);

    expect(flushEvents).not.toHaveBeenCalled();
  });

  it('flushes when the page becomes hidden', () => {
    render(<Harness />);

    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(flushEvents).toHaveBeenCalledTimes(1);
  });

  it('ignores visibilitychange when the page became visible', () => {
    render(<Harness />);

    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(flushEvents).not.toHaveBeenCalled();
  });

  it('flushes on pagehide, which is the only reliable signal on iOS Safari', () => {
    render(<Harness />);

    window.dispatchEvent(new Event('pagehide'));

    expect(flushEvents).toHaveBeenCalledTimes(1);
  });

  it('detaches both listeners on unmount', () => {
    const { unmount } = render(<Harness />);

    unmount();
    window.dispatchEvent(new Event('pagehide'));

    // The unmount flush is the only call; the listener no longer fires.
    expect(flushEvents).toHaveBeenCalledTimes(1);
  });
});

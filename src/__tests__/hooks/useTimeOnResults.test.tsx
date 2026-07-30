import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/analytics', () => ({
  analytics: { resultsClicksSummary: vi.fn() },
  AnalyticsEvents: { TIME_ON_RESULTS: 'time_on_results' },
  trackBeacon: vi.fn(),
}));

import { trackBeacon } from '@/lib/analytics';
import { useTimeOnResults } from '@/hooks/useTimeOnResults';

function Harness({ accountCount, isActive }: { accountCount: number; isActive: boolean }) {
  useTimeOnResults(accountCount, isActive);
  return null;
}

describe('useTimeOnResults', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rolls the sampling dice once per session, not once per trigger', () => {
    // The bug: hasFiredRef was set inside the sampling branch, so a failed roll
    // left the guard down and the next of three triggers rolled again. That
    // turns a documented 25% into 1 - 0.75^3 ~= 58%.
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99); // always fails the roll
    vi.spyOn(Date, 'now').mockReturnValue(0);

    const { unmount } = render(<Harness accountCount={100} isActive />);

    vi.spyOn(Date, 'now').mockReturnValue(10_000); // 10s spent, past the 5s floor

    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pagehide'));
    unmount();

    // Three triggers, and the dice must have been consulted exactly once.
    expect(random).toHaveBeenCalledTimes(1);
    expect(trackBeacon).not.toHaveBeenCalled();
  });

  it('still sends nothing for a visit under the five second floor', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01); // would pass the roll
    vi.spyOn(Date, 'now').mockReturnValue(0);

    const { unmount } = render(<Harness accountCount={100} isActive />);

    vi.spyOn(Date, 'now').mockReturnValue(2_000);
    unmount();

    expect(trackBeacon).not.toHaveBeenCalled();
  });
});

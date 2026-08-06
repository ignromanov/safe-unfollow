import { render } from '@testing-library/react';
import type { MutableRefObject } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/analytics', () => ({
  analytics: { resultsClicksSummary: vi.fn() },
  AnalyticsEvents: { TIME_ON_RESULTS: 'time_on_results' },
  trackBeacon: vi.fn(),
}));

import { analytics, AnalyticsEvents, trackBeacon } from '@/lib/analytics';
import { useTimeOnResults } from '@/hooks/useTimeOnResults';

type TimeOnResultsApi = ReturnType<typeof useTimeOnResults>;

function Harness({
  accountCount,
  isActive,
  apiRef,
}: {
  accountCount: number;
  isActive: boolean;
  apiRef?: MutableRefObject<TimeOnResultsApi | null>;
}) {
  const api = useTimeOnResults(accountCount, isActive);
  if (apiRef) {
    // Plain ref write during render — no state, no re-render triggered — so the
    // test can reach `trackClick` without switching this suite to renderHook.
    apiRef.current = api;
  }
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

  it('sends the event with the right payload when the visit clears the floor and wins the roll', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // passes the 0.25 roll
    vi.spyOn(Date, 'now').mockReturnValue(0);

    const apiRef: MutableRefObject<TimeOnResultsApi | null> = { current: null };
    const { unmount } = render(<Harness accountCount={100} isActive apiRef={apiRef} />);

    apiRef.current?.trackClick(['mutual']);

    // 7.4s elapsed: picked so Math.round is actually exercised, not just a
    // whole number that would pass even if the rounding were dropped.
    vi.spyOn(Date, 'now').mockReturnValue(7_400);
    unmount();

    expect(trackBeacon).toHaveBeenCalledTimes(1);
    expect(trackBeacon).toHaveBeenCalledWith(AnalyticsEvents.TIME_ON_RESULTS, {
      time_seconds: 7,
      account_count: 100,
      actions_count: 1,
    });
    expect(analytics.resultsClicksSummary).toHaveBeenCalledTimes(1);
  });

  it('skips the click summary when the visit had no clicks', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // passes the 0.25 roll
    vi.spyOn(Date, 'now').mockReturnValue(0);

    const { unmount } = render(<Harness accountCount={100} isActive />);

    vi.spyOn(Date, 'now').mockReturnValue(7_400);
    unmount();

    expect(trackBeacon).toHaveBeenCalledTimes(1);
    expect(analytics.resultsClicksSummary).not.toHaveBeenCalled();
  });
});

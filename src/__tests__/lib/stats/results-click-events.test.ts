import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/stats/core', () => ({ trackBeacon: vi.fn() }));

import { AnalyticsEvents } from '@/lib/stats/constants';
import { trackBeacon } from '@/lib/stats/core';
import { analytics } from '@/lib/stats/events';
import { resultsTelemetry } from '@/lib/stats/results-click-events';

describe('resultsTelemetry.clicksSummary', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sends a cumulative row keyed by visit and seq, every badge most-clicked first', () => {
    resultsTelemetry.clicksSummary(
      {
        totalClicks: 20,
        badgeClicks: { mutuals: 2, unfollowed: 10, following: 3, notFollowingBack: 5 },
        timeSpentSeconds: 45.6,
      },
      'visit-1',
      3
    );

    expect(trackBeacon).toHaveBeenCalledWith(AnalyticsEvents.RESULTS_CLICKS_SUMMARY, {
      filter_session_id: 'visit-1',
      seq: 3,
      total_clicks: 20,
      badge_clicks: '{"unfollowed":10,"notFollowingBack":5,"following":3,"mutuals":2}',
      time_spent: 46,
    });
  });

  it('is not on the entry-chunk analytics object', () => {
    // The entry chunk is held to a byte budget and only /results calls this.
    expect('resultsClicksSummary' in analytics).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const enqueueEvent = vi.fn();
vi.mock('@/lib/stats/queue', () => ({
  enqueueEvent: (name: string, data?: unknown) => enqueueEvent(name, data),
}));

import { filterTelemetry } from '@/lib/stats/filter-step-events';

/**
 * `filter_step` and `filter_anomaly` carry counts and badge keys and nothing
 * that names an account. The key sets are asserted EXACTLY, not with
 * `objectContaining`: a field added later must be added here on purpose, which
 * is the moment someone asks whether it can identify anyone.
 */
describe('filter step and anomaly payloads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const resolved = {
    sessionId: 'abc1230',
    step: 2,
    badge: 'notFollowingBack' as const,
    action: 'enable' as const,
    source: 'stat_card' as const,
    combination: 'notFollowingBack+unfollowed',
    predictedCount: 3,
    result: { count: 0, searchActive: false },
  };

  it('sends a resolved step with exact counts', () => {
    filterTelemetry.step(resolved, 840);

    expect(enqueueEvent).toHaveBeenCalledWith('filter_step', {
      filter_session_id: 'abc1230',
      step: 2,
      badge: 'notFollowingBack',
      action: 'enable',
      source: 'stat_card',
      combination: 'notFollowingBack+unfollowed',
      total_count: 840,
      resolved: true,
      result_count: 0,
      search_active: false,
      predicted_count: 3,
    });
  });

  it('omits the result of an unresolved step instead of sending a zero', () => {
    const { result: _unused, predictedCount: _none, ...unresolved } = resolved;
    filterTelemetry.step(unresolved, 840);

    const [, payload] = enqueueEvent.mock.calls[0];
    expect(payload).toEqual({
      filter_session_id: 'abc1230',
      step: 2,
      badge: 'notFollowingBack',
      action: 'enable',
      source: 'stat_card',
      combination: 'notFollowingBack+unfollowed',
      total_count: 840,
      resolved: false,
    });
  });

  it('sends an anomaly with both numbers', () => {
    filterTelemetry.anomaly({ kind: 'card_vs_list', step: resolved, expected: 4, actual: 5 }, 840);

    expect(enqueueEvent).toHaveBeenCalledWith('filter_anomaly', {
      kind: 'card_vs_list',
      filter_session_id: 'abc1230',
      step: 2,
      combination: 'notFollowingBack+unfollowed',
      expected: 4,
      actual: 5,
      total_count: 840,
    });
  });

  it('omits `expected` when there was no expectation to state', () => {
    filterTelemetry.anomaly({ kind: 'filter_failed', step: resolved, actual: 840 }, 840);

    const [, payload] = enqueueEvent.mock.calls[0];
    expect(payload).not.toHaveProperty('expected');
    expect(payload).toMatchObject({ kind: 'filter_failed', actual: 840 });
  });
});

import { clearRescuePlanDismiss, useRescuePlanDismiss } from '@/hooks/useRescuePlanDismiss';
import type { UserSegment } from '@/lib/rescue-plan';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSegment: UserSegment = {
  severity: 'warning',
  size: 'regular',
  unfollowedPercent: 5.5,
  totalAccounts: 1000,
};

describe('useRescuePlanDismiss', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearRescuePlanDismiss();
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initial state as not dismissed', () => {
    const { result } = renderHook(() => useRescuePlanDismiss(mockSegment));
    expect(result.current.isDismissed).toBe(false);
  });

  it('should update state and storage when dismissed', () => {
    const { result } = renderHook(() => useRescuePlanDismiss(mockSegment));

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.isDismissed).toBe(true);
    expect(localStorage.getItem('rescue_plan_dismissed')).toBeTruthy();
  });

  it('should initialize as dismissed if stored state is valid', () => {
    // Dismiss first
    const { result: firstResult } = renderHook(() => useRescuePlanDismiss(mockSegment));
    act(() => {
      firstResult.current.dismiss();
    });

    // Re-render
    const { result: secondResult } = renderHook(() => useRescuePlanDismiss(mockSegment));
    expect(secondResult.current.isDismissed).toBe(true);
  });

  it('should expire dismissal after 14 days', () => {
    const { result } = renderHook(() => useRescuePlanDismiss(mockSegment));
    act(() => {
      result.current.dismiss();
    });

    // Advance time by 14 days + 1 ms (TTL is 14 days)
    vi.advanceTimersByTime(14 * 24 * 60 * 60 * 1000 + 1);

    // Re-render to trigger check
    const { result: newResult } = renderHook(() => useRescuePlanDismiss(mockSegment));
    expect(newResult.current.isDismissed).toBe(false);
    expect(localStorage.getItem('rescue_plan_dismissed')).toBeNull();
  });

  it('should re-engage user (un-dismiss) when severity worsens', () => {
    // Start with warning severity
    const startSegment: UserSegment = { ...mockSegment, severity: 'warning' };
    const { result, rerender } = renderHook(props => useRescuePlanDismiss(props), {
      initialProps: startSegment,
    });

    // Dismiss it
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.isDismissed).toBe(true);

    // Worsen to critical
    const criticalSegment: UserSegment = { ...mockSegment, severity: 'critical' };
    rerender(criticalSegment);

    // Should be un-dismissed now (V9: re-engagement event removed, but behavior preserved)
    expect(result.current.isDismissed).toBe(false);
  });

  it('should NOT re-engage user when severity improves', () => {
    // Start with warning severity
    const startSegment: UserSegment = { ...mockSegment, severity: 'warning' };
    const { result, rerender } = renderHook(props => useRescuePlanDismiss(props), {
      initialProps: startSegment,
    });

    // Dismiss it
    act(() => {
      result.current.dismiss();
    });

    // Improve to growth
    const growthSegment: UserSegment = { ...mockSegment, severity: 'growth' };
    rerender(growthSegment);

    // Should still be dismissed
    expect(result.current.isDismissed).toBe(true);
  });

  it('should handle null segment gracefully', () => {
    const { result } = renderHook(() => useRescuePlanDismiss(null));
    expect(result.current.isDismissed).toBe(false);

    act(() => {
      result.current.dismiss();
    });

    // Should verify it didn't crash, but won't persist
    expect(localStorage.getItem('rescue_plan_dismissed')).toBeNull();
  });
});

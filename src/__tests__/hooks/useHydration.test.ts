import { useHydration } from '@/hooks/useHydration';
import { useAppStore } from '@/lib/store';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the store
vi.mock('@/lib/store', () => ({
  useAppStore: vi.fn(),
}));

const mockUseAppStore = vi.mocked(useAppStore);

describe('useHydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true when store is hydrated', () => {
    mockUseAppStore.mockReturnValue(true);

    const { result } = renderHook(() => useHydration());

    expect(result.current).toBe(true);
  });

  it('should return false when store is not hydrated', () => {
    mockUseAppStore.mockReturnValue(false);

    const { result } = renderHook(() => useHydration());

    expect(result.current).toBe(false);
  });

  it('should call useAppStore with _hasHydrated selector', () => {
    mockUseAppStore.mockReturnValue(true);

    renderHook(() => useHydration());

    expect(mockUseAppStore).toHaveBeenCalledWith(expect.any(Function));

    // Verify the selector extracts _hasHydrated
    const selector = mockUseAppStore.mock.calls[0][0] as (state: {
      _hasHydrated: boolean;
    }) => boolean;
    expect(selector({ _hasHydrated: true })).toBe(true);
    expect(selector({ _hasHydrated: false })).toBe(false);
  });

  it('should update when store hydration state changes', () => {
    mockUseAppStore.mockReturnValue(false);

    const { result, rerender } = renderHook(() => useHydration());

    expect(result.current).toBe(false);

    // Simulate hydration completing
    mockUseAppStore.mockReturnValue(true);
    rerender();

    expect(result.current).toBe(true);
  });
});

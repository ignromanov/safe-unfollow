import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useProExport } from '@/hooks/useProExport';
import { resetUnlockCache, setExportUnlocked } from '@/lib/export/unlock';
import { analytics } from '@/lib/stats';

vi.mock('@/lib/stats', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/stats')>();
  return {
    ...actual,
    analytics: { ...actual.analytics, checkoutStart: vi.fn() },
  };
});

describe('useProExport', () => {
  beforeEach(() => {
    localStorage.clear();
    resetUnlockCache();
    vi.clearAllMocks();
    vi.stubEnv('VITE_LEMONSQUEEZY_URL', 'https://checkout.example/buy');
    window.history.replaceState({}, '', '/results');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should report the feature as disabled without a checkout URL', () => {
    vi.stubEnv('VITE_LEMONSQUEEZY_URL', '');

    const { result } = renderHook(() => useProExport());

    expect(result.current.isEnabled).toBe(false);
  });

  it('should start locked', () => {
    const { result } = renderHook(() => useProExport());

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.isUnlocked).toBe(false);
  });

  it('should start unlocked when the flag is already persisted', () => {
    setExportUnlocked();

    const { result } = renderHook(() => useProExport());

    expect(result.current.isUnlocked).toBe(true);
  });

  // Capture happens in Layout, which is a parent — its effect runs after the
  // child's initial render, so the hook must observe the flag reactively rather
  // than snapshot it once at mount.
  it('should reflect an unlock that happens after mount', () => {
    const { result } = renderHook(() => useProExport());
    expect(result.current.isUnlocked).toBe(false);

    act(() => {
      setExportUnlocked();
    });

    expect(result.current.isUnlocked).toBe(true);
  });

  it('should leave the redirect-back param for the Layout-level capture', () => {
    window.history.replaceState({}, '', '/results?export=unlocked');

    renderHook(() => useProExport());

    expect(window.location.search).toBe('?export=unlocked');
  });

  it('should report checkout start before navigating', () => {
    const { result } = renderHook(() => useProExport());

    act(() => {
      result.current.startCheckout();
    });

    expect(vi.mocked(analytics.checkoutStart)).toHaveBeenCalledTimes(1);
  });
});

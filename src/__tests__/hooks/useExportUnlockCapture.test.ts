import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useExportUnlockCapture } from '@/hooks/useExportUnlockCapture';
import { isExportUnlocked, resetUnlockCache } from '@/lib/export/unlock';
import { analytics } from '@/lib/stats';

vi.mock('@/lib/stats', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/stats')>();
  return {
    ...actual,
    analytics: { ...actual.analytics, purchaseSuccess: vi.fn() },
  };
});

describe('useExportUnlockCapture', () => {
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

  it('should unlock export when the redirect-back param is present', () => {
    window.history.replaceState({}, '', '/results?export=unlocked');

    renderHook(() => useExportUnlockCapture());

    expect(isExportUnlocked()).toBe(true);
  });

  // The purchase redirect can land on any route — including one that renders no
  // results at all (cleared IndexedDB, different browser, receipt link opened
  // later). The unlock must still be captured there.
  it('should unlock export on a route that has no results data', () => {
    window.history.replaceState({}, '', '/?export=unlocked');

    renderHook(() => useExportUnlockCapture());

    expect(isExportUnlocked()).toBe(true);
  });

  it('should report the purchase exactly once', () => {
    window.history.replaceState({}, '', '/results?export=unlocked');

    const { rerender } = renderHook(() => useExportUnlockCapture());
    rerender();

    expect(vi.mocked(analytics.purchaseSuccess)).toHaveBeenCalledTimes(1);
  });

  it('should strip the param from the URL', () => {
    window.history.replaceState({}, '', '/results?export=unlocked&utm_source=email');

    renderHook(() => useExportUnlockCapture());

    expect(window.location.search).toBe('?utm_source=email');
  });

  it('should do nothing when the param is absent', () => {
    renderHook(() => useExportUnlockCapture());

    expect(isExportUnlocked()).toBe(false);
    expect(vi.mocked(analytics.purchaseSuccess)).not.toHaveBeenCalled();
  });

  it('should do nothing when the feature is disabled', () => {
    vi.stubEnv('VITE_LEMONSQUEEZY_URL', '');
    window.history.replaceState({}, '', '/results?export=unlocked');

    renderHook(() => useExportUnlockCapture());

    expect(isExportUnlocked()).toBe(false);
    expect(vi.mocked(analytics.purchaseSuccess)).not.toHaveBeenCalled();
  });
});

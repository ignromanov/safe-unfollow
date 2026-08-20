import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useProExport } from '@/hooks/useProExport';
import { resetUnlockCache, storeLicense } from '@/lib/export/unlock';
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
    vi.stubEnv('VITE_DODO_CHECKOUT_URL', 'https://checkout.dodopayments.com/buy/pdt_x');
    window.history.replaceState({}, '', '/results');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should report the feature as disabled without a checkout URL', () => {
    vi.stubEnv('VITE_DODO_CHECKOUT_URL', '');

    const { result } = renderHook(() => useProExport());

    expect(result.current.isEnabled).toBe(false);
  });

  it('should start locked', () => {
    const { result } = renderHook(() => useProExport());

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.isUnlocked).toBe(false);
  });

  it('should start unlocked when the flag is already persisted', () => {
    storeLicense('38b1460a-5104-4067-a91d-77b872934d51', 'f90ec370-fd83-46a5-8bbd-44a241e78665');

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
      storeLicense('38b1460a-5104-4067-a91d-77b872934d51', 'f90ec370-fd83-46a5-8bbd-44a241e78665');
    });

    expect(result.current.isUnlocked).toBe(true);
  });

  it('should leave the `license` param in the URL for the Layout-level capture', () => {
    window.history.replaceState(
      {},
      '',
      '/results?license_key=38b1460a-5104-4067-a91d-77b872934d51'
    );

    renderHook(() => useProExport());

    expect(window.location.search).toBe('?license_key=38b1460a-5104-4067-a91d-77b872934d51');
  });

  it('should report checkout start, with its dimensions, before navigating', () => {
    const { result } = renderHook(() => useProExport());

    act(() => {
      result.current.startCheckout('id', 8930);
    });

    expect(vi.mocked(analytics.checkoutStart)).toHaveBeenCalledWith('id', 8930);
  });
});

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

  describe('checkout state', () => {
    it('should start idle', () => {
      const { result } = renderHook(() => useProExport());

      expect(result.current.checkoutState).toBe('idle');
    });

    it('should go to opening before the navigation, so the second tap has nothing to press', () => {
      const { result } = renderHook(() => useProExport());

      act(() => {
        result.current.startCheckout('id', 8930);
      });

      expect(result.current.checkoutState).toBe('opening');
    });

    // The guard is a ref rather than the state, for the reason
    // ResultsExportControls.tsx:70-74 already records: two presses in one tick
    // both read the state from before the re-render. The button is disabled in
    // `opening`, but the hook must not depend on its consumer rendering that
    // correctly to stay honest about how many checkouts it started.
    it('should ignore a second press while opening', () => {
      const { result } = renderHook(() => useProExport());

      act(() => {
        result.current.startCheckout('id', 8930);
        result.current.startCheckout('id', 8930);
      });

      expect(vi.mocked(analytics.checkoutStart)).toHaveBeenCalledTimes(1);
    });

    it('should return the control after 8 seconds rather than staying busy forever', () => {
      vi.useFakeTimers();
      try {
        const { result } = renderHook(() => useProExport());

        act(() => {
          result.current.startCheckout('id', 8930);
        });
        act(() => {
          vi.advanceTimersByTime(8_000);
        });

        expect(result.current.checkoutState).toBe('failed');
      } finally {
        vi.useRealTimers();
      }
    });

    it('should accept a retry once the attempt has failed', () => {
      vi.useFakeTimers();
      try {
        const { result } = renderHook(() => useProExport());

        act(() => {
          result.current.startCheckout('id', 8930);
        });
        act(() => {
          vi.advanceTimersByTime(8_000);
        });
        act(() => {
          result.current.startCheckout('id', 8930);
        });

        expect(result.current.checkoutState).toBe('opening');
        expect(vi.mocked(analytics.checkoutStart)).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should return to idle when the reader dismisses and reopens', () => {
      const { result } = renderHook(() => useProExport());

      act(() => {
        result.current.startCheckout('id', 8930);
      });
      act(() => {
        result.current.resetCheckout();
      });

      expect(result.current.checkoutState).toBe('idle');
    });

    // The redirect leaves the page, but it does not necessarily destroy it: the
    // project keeps the back/forward cache eligible on purpose (see
    // useEventQueueFlush's docstring, which declines `beforeunload`/`unload` for
    // exactly this reason). A reader who reaches the checkout host, changes
    // their mind and presses Back gets this component tree restored with its
    // state, its refs and its pending timer intact — frozen, not cancelled.
    //
    // So the timer resumes against a redirect that is no longer in flight, and
    // the reader watches a handoff screen for a checkout they abandoned before
    // it accuses the payment page of failing to load.
    describe('a restore from the back/forward cache', () => {
      const restoreFromBfcache = (persisted: boolean): void => {
        const event = new Event('pageshow');
        Object.defineProperty(event, 'persisted', { value: persisted });
        window.dispatchEvent(event);
      };

      it('should return the control to the reader instead of leaving it busy', () => {
        const { result } = renderHook(() => useProExport());

        act(() => {
          result.current.startCheckout('id', 8930);
        });
        act(() => {
          restoreFromBfcache(true);
        });

        expect(result.current.checkoutState).toBe('idle');
      });

      // Distinct from the assertion above: overwriting the state without
      // cancelling the timer passes that one and fails this one, and the
      // failure the reader actually reports is this one — a red alert claiming
      // the payment page did not load, arriving seconds after they chose to
      // come back.
      it('should not accuse the payment page of failing after the reader came back', () => {
        vi.useFakeTimers();
        try {
          const { result } = renderHook(() => useProExport());

          act(() => {
            result.current.startCheckout('id', 8930);
          });
          act(() => {
            restoreFromBfcache(true);
          });
          act(() => {
            vi.advanceTimersByTime(8_000);
          });

          expect(result.current.checkoutState).toBe('idle');
        } finally {
          vi.useRealTimers();
        }
      });

      // The re-press guard is a ref, so clearing the state is not enough to make
      // the button work again — `startCheckout` would return early forever.
      it('should accept a fresh press after the reader came back', () => {
        const { result } = renderHook(() => useProExport());

        act(() => {
          result.current.startCheckout('id', 8930);
        });
        act(() => {
          restoreFromBfcache(true);
        });
        act(() => {
          result.current.startCheckout('id', 8930);
        });

        expect(result.current.checkoutState).toBe('opening');
        expect(vi.mocked(analytics.checkoutStart)).toHaveBeenCalledTimes(2);
      });

      // `pageshow` also fires on an ordinary load, where `persisted` is false —
      // including the load that brings a paying reader back with `?license_key=`.
      // Only a restore says the reader navigated back; a plain load says nothing
      // about an in-flight redirect and must not cancel one.
      it('should leave an in-flight checkout alone when the page was not restored', () => {
        const { result } = renderHook(() => useProExport());

        act(() => {
          result.current.startCheckout('id', 8930);
        });
        act(() => {
          restoreFromBfcache(false);
        });

        expect(result.current.checkoutState).toBe('opening');
      });
    });

    // Unreachable through the UI, and deliberately still covered. `getApiBase`
    // and `getCheckoutUrl` read the same VITE_DODO_CHECKOUT_URL
    // (license.ts:101, unlock.ts:118), so an unset value disables the feature
    // and ResultsExportControls.tsx:81 never mounts the paywall. A bare
    // `return` inside a state machine is still a hole: it would leave the
    // control looking pressable with nothing pending.
    it('should report failure instead of doing nothing when no checkout URL is configured', () => {
      vi.stubEnv('VITE_DODO_CHECKOUT_URL', '');
      const { result } = renderHook(() => useProExport());

      act(() => {
        result.current.startCheckout('id', 8930);
      });

      expect(result.current.checkoutState).toBe('failed');
      expect(vi.mocked(analytics.checkoutStart)).not.toHaveBeenCalled();
    });
  });
});

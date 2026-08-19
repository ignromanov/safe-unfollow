import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const enqueueEvent = vi.fn();
vi.mock('@/lib/stats/queue', () => ({
  enqueueEvent: (name: string, data?: unknown) => enqueueEvent(name, data),
  trackNavigating: vi.fn(),
  flushEvents: vi.fn(),
}));
vi.mock('@/hooks/usePWAInstallAnalytics', () => ({ usePWAInstallAnalytics: vi.fn() }));

import { useLayoutAnalytics } from '@/hooks/useLayoutAnalytics';
import { PENDING_CTA_KEY } from '@/lib/stats/cta-capture';

describe('useLayoutAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    delete window.__ctaSink;
  });

  it('records a CTA the previous page parked before it could hydrate', () => {
    // Layout wraps every route, so this is the one place guaranteed to run on the page
    // a pre-hydration click navigated to.
    sessionStorage.setItem(PENDING_CTA_KEY, JSON.stringify({ c: 'upload_direct', p: '/' }));

    renderHook(() => useLayoutAnalytics());

    expect(enqueueEvent).toHaveBeenCalledWith('hero_cta_upload_direct', {
      deferred: true,
      from_path: '/',
    });
  });

  it('leaves a sink behind so later clicks are recorded where they happen', () => {
    renderHook(() => useLayoutAnalytics());

    expect(typeof window.__ctaSink).toBe('function');
  });
});

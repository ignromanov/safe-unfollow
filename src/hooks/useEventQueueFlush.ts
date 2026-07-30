import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { flushEvents } from '@/lib/stats/queue';

/**
 * Drains the batched event queue at every point the visitor might be leaving.
 *
 * Mounted once, in Layout. Route changes come from the router rather than a
 * `history` patch, because React Router already owns `popstate` and a parallel
 * listener would either miss navigations or double-count them.
 *
 * Both lifecycle events are registered on purpose: iOS Safari does not reliably
 * fire `visibilitychange` when the visitor navigates away, while `pagehide` is
 * the weaker signal on desktop. `beforeunload` and `unload` are not used — they
 * block the back/forward cache and are unreliable on mobile anyway.
 */
export function useEventQueueFlush(): void {
  const { pathname } = useLocation();
  const previousPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (previousPathRef.current !== null && previousPathRef.current !== pathname) {
      flushEvents();
    }
    previousPathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const handleVisibilityChange = (): void => {
      if (document.hidden) flushEvents();
    };
    const handlePageHide = (): void => {
      flushEvents();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      // Whatever is pending would otherwise die with the tree.
      flushEvents();
    };
  }, []);
}

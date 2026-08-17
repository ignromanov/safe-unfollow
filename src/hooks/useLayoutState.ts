import { useEffect } from 'react';

/**
 * Scroll to top on route change.
 *
 * Also carried a `mounted` flag until Layout's no-data gate moved to useHasResults. Nothing
 * read it after that, but the useState/useEffect pair still forced a second commit of the
 * whole page shell on every load — the exact post-hydration cost this branch exists to remove.
 */
export function useLayoutState(pathname: string): void {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
}

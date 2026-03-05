import { useEffect, useState } from 'react';

interface LayoutStateResult {
  /** Whether the component has mounted on the client (prevents hydration mismatch) */
  mounted: boolean;
}

/**
 * Hook for Layout component state management:
 * - Client mount detection (hydration safety)
 * - Scroll-to-top on route change
 */
export function useLayoutState(pathname: string): LayoutStateResult {
  // Client-mounted check (prevents hydration mismatch)
  // Effects run AFTER hydration, so this is safe
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  return { mounted };
}

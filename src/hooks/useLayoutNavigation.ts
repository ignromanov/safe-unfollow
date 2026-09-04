import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { AppState } from '@/core/types';
import { useLanguagePrefix } from '@/hooks/useLanguagePrefix';

/**
 * Map pathname to AppState for header highlighting
 */
function getActiveScreen(pathname: string): AppState {
  if (pathname.endsWith('/results')) return AppState.RESULTS;
  if (pathname.endsWith('/upload')) return AppState.UPLOAD;
  if (pathname.endsWith('/sample')) return AppState.SAMPLE;
  if (pathname.endsWith('/privacy')) return AppState.PRIVACY;
  if (pathname.endsWith('/terms')) return AppState.TERMS;
  return AppState.HERO;
}

interface LayoutNavigationResult {
  pathname: string;
  activeScreen: AppState;
  handleClear: (clearData: () => void) => void;
}

/**
 * Hook for Layout navigation concerns:
 * - Route detection and active screen
 * - Post-action navigation
 *
 * The header's plain navigation (logo, upload, results) is not here: those are anchors
 * now, so they work during the pre-hydration window when no handler is attached. What
 * remains is the one action that mutates before it navigates.
 */
export function useLayoutNavigation(): LayoutNavigationResult {
  const location = useLocation();
  const navigate = useNavigate();
  const prefix = useLanguagePrefix();

  const { pathname } = location;
  const activeScreen = getActiveScreen(pathname);

  const handleClear = useCallback(
    (clearData: () => void) => {
      clearData();
      // The reader who just deleted their export is about to load another one,
      // so send them straight to /upload instead of making them navigate again.
      navigate(`${prefix}/upload`);
    },
    [navigate, prefix]
  );

  return { pathname, activeScreen, handleClear };
}

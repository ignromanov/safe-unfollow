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
  if (pathname.endsWith('/wizard')) return AppState.WIZARD;
  if (pathname.endsWith('/sample')) return AppState.SAMPLE;
  if (pathname.endsWith('/privacy')) return AppState.PRIVACY;
  if (pathname.endsWith('/terms')) return AppState.TERMS;
  return AppState.HERO;
}

interface LayoutNavigationResult {
  pathname: string;
  activeScreen: AppState;
  isResultsPage: boolean;
  handleViewResults: () => void;
  handleUpload: () => void;
  handleLogoClick: () => void;
  handleClear: (clearData: () => void) => void;
}

/**
 * Hook for Layout navigation concerns:
 * - Route detection and active screen
 * - Navigation handlers with language prefix
 */
export function useLayoutNavigation(): LayoutNavigationResult {
  const location = useLocation();
  const navigate = useNavigate();
  const prefix = useLanguagePrefix();

  const { pathname } = location;
  const activeScreen = getActiveScreen(pathname);
  const isResultsPage = pathname.endsWith('/results') || pathname.endsWith('/sample');

  const handleViewResults = useCallback(() => navigate(`${prefix}/results`), [navigate, prefix]);
  const handleUpload = useCallback(() => navigate(`${prefix}/upload`), [navigate, prefix]);
  const handleLogoClick = useCallback(() => navigate(`${prefix}/`), [navigate, prefix]);

  const handleClear = useCallback(
    (clearData: () => void) => {
      clearData();
      navigate(`${prefix}/`);
    },
    [navigate, prefix]
  );

  return {
    pathname,
    activeScreen,
    isResultsPage,
    handleViewResults,
    handleUpload,
    handleLogoClick,
    handleClear,
  };
}

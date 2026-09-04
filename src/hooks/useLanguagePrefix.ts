import { useLocation } from 'react-router-dom';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/locales';

/**
 * Hook to get the current language prefix for navigation
 *
 * Returns:
 * - '' for English (default, no prefix)
 * - '/es' for Spanish
 * - '/ru' for Russian
 * - etc.
 */
export function useLanguagePrefix(): string {
  const location = useLocation();

  // Extract language from path: /es/upload -> 'es'
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const firstSegment = pathSegments[0];

  if (firstSegment && SUPPORTED_LANGUAGES.includes(firstSegment as SupportedLanguage)) {
    if (firstSegment === 'en') {
      return ''; // English uses root
    }
    return `/${firstSegment}`;
  }

  return ''; // Default to English (no prefix)
}

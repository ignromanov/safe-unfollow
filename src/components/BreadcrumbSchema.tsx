import { useLocation } from 'react-router-dom';

import {
  DEFAULT_LANGUAGE,
  createLanguagePrefixRegex,
  detectLanguageFromPathname,
} from '@/config/languages';

const BREADCRUMB_NAMES: Record<string, string> = {
  '/': 'Home',
  '/upload': 'Upload',
  '/results': 'Results',
  '/sample': 'Sample',
  '/privacy': 'Privacy Policy',
  '/terms': 'Terms of Service',
};

const BASE_URL = 'https://safeunfollow.app';

/**
 * The one definition of "a locale prefix", derived from SUPPORTED_LANGUAGES.
 *
 * This component used to carry its own `/^\/[a-z]{2}(?=\/|$)/`, which is how the
 * URLs below came to be built without a locale: two ideas of what the prefix is,
 * only one of them locale-aware. `vite/ssg-meta-injector.ts` imports this same
 * helper, which is why its canonical and hreflang were right while these were not.
 */
const LANGUAGE_PREFIX = createLanguagePrefixRegex();

/**
 * Generates BreadcrumbList structured data for SEO
 * Helps search engines understand page hierarchy and can appear in SERP
 *
 * Note: dangerouslySetInnerHTML is safe here because the content is
 * a JSON-stringified object from hardcoded values, not user input.
 */
export function BreadcrumbSchema() {
  const location = useLocation();

  // The stripped path is the lookup key for BREADCRUMB_NAMES, which is keyed by
  // bare paths. It is NOT the URL: every emitted URL carries the locale back, so
  // the breadcrumb agrees with the canonical the injector writes for this page.
  const path = location.pathname.replace(LANGUAGE_PREFIX, '/');
  const language = detectLanguageFromPathname(location.pathname);
  const localePrefix = language === DEFAULT_LANGUAGE ? '' : `/${language}`;

  const items = [{ name: 'Home', url: `${BASE_URL}${localePrefix || '/'}` }];

  if (path !== '/') {
    const pageName = BREADCRUMB_NAMES[path];
    if (pageName) {
      items.push({
        name: pageName,
        url: `${BASE_URL}${localePrefix}${path}`,
      });
    }
  }

  // Don't render if only home (single item breadcrumb is not useful)
  if (items.length === 1) {
    return null;
  }

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

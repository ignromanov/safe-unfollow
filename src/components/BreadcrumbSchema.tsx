import { useLocation } from 'react-router-dom';

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
 * Generates BreadcrumbList structured data for SEO
 * Helps search engines understand page hierarchy and can appear in SERP
 *
 * Note: dangerouslySetInnerHTML is safe here because the content is
 * a JSON-stringified object from hardcoded values, not user input.
 */
export function BreadcrumbSchema() {
  const location = useLocation();

  // Remove language prefix to get base path (e.g., /es/upload -> /upload)
  const path = location.pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '/';

  const items = [{ name: 'Home', url: `${BASE_URL}/` }];

  if (path !== '/') {
    const pageName = BREADCRUMB_NAMES[path];
    if (pageName) {
      items.push({
        name: pageName,
        url: `${BASE_URL}${path}`,
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

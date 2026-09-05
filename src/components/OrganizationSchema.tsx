import { useLocation } from 'react-router-dom';

const BASE_URL = 'https://safeunfollow.app';
const GITHUB_URL = 'https://github.com/ignromanov/safe-unfollow';

/**
 * Organization and SoftwareApplication schema for SEO
 * Provides structured data about the app for rich SERP results
 * Includes E-E-A-T signals: license, version, repository
 */
export function OrganizationSchema() {
  const location = useLocation();

  // Only render on home page to avoid duplicate schemas
  const isHomePage =
    location.pathname === '/' || location.pathname.match(/^\/[a-z]{2}\/?$/) !== null;

  if (!isHomePage) {
    return null;
  }

  // Organization schema - who made this
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'SafeUnfollow',
    url: BASE_URL,
    logo: `${BASE_URL}/logo.svg`,
    sameAs: [GITHUB_URL],
    description:
      'Privacy-first tools for social media data analysis. All processing happens locally in your browser.',
  };

  // SoftwareApplication schema - what this app is
  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Instagram Unfollow Tracker',
    alternateName: 'SafeUnfollow',
    applicationCategory: 'UtilityApplication',
    applicationSubCategory: 'Privacy Tool',
    operatingSystem: 'Web Browser',
    url: BASE_URL,
    downloadUrl: BASE_URL,
    screenshot: `${BASE_URL}/og-image.png`,
    softwareVersion: '1.5.0',
    datePublished: '2025-11-22',
    license: 'https://opensource.org/licenses/MIT',
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    author: {
      '@type': 'Organization',
      name: 'SafeUnfollow',
      url: BASE_URL,
    },
    provider: {
      '@type': 'Organization',
      name: 'SafeUnfollow',
      url: BASE_URL,
    },
    featureList: [
      'Find who unfollowed you on Instagram',
      'Analyze up to 1,000,000+ accounts',
      '100% local processing - data never leaves your device',
      'No login or password required',
      'Uses official Instagram data export (ZIP file)',
      'Free and open-source (MIT license)',
      'Works offline after loading',
    ],
    keywords:
      'instagram unfollow tracker, who unfollowed me on instagram, instagram unfollowers, instagram data export analyzer',
  };

  // Safe: JSON.stringify escapes special chars, data is hardcoded (not user input)
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareSchema),
        }}
      />
    </>
  );
}

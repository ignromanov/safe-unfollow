import fs from 'fs';
import path from 'path';
import {
  SUPPORTED_LANGUAGES,
  LOCALE_CODES,
  RTL_LANGUAGES,
  getLocaleCode,
  createLanguagePrefixRegex,
  type SupportedLanguage,
} from '../src/config/languages.js';

const BASE_URL = 'https://safeunfollow.app';

/**
 * Font subsets needed for each language (for future reference).
 *
 * NOTE: Font preloading is currently DISABLED because:
 * - @fontsource CSS imports bundle fonts to /assets/ with hashes
 * - Manual preloads pointed to /files/ (static copies)
 * - This mismatch caused "preloaded but not used" warnings
 *
 * Fonts still load correctly via CSS @font-face rules.
 * To re-enable preloading, we'd need to either:
 * 1. Use manual @font-face rules pointing to /files/
 * 2. Or extract Vite's hashed font URLs at build time
 */
const _LANGUAGE_FONT_SUBSETS: Record<SupportedLanguage, string[]> = {
  en: ['latin'],
  es: ['latin', 'latin-ext'], // Spanish accents: á, é, í, ñ, ü
  pt: ['latin', 'latin-ext'], // Portuguese: ã, ç, õ
  fr: ['latin', 'latin-ext'], // French: é, è, ê, ë, ç
  de: ['latin', 'latin-ext'], // German: ä, ö, ü, ß
  ru: ['latin', 'cyrillic', 'cyrillic-ext'], // Russian: cyrillic for Inter, cyrillic-ext for Plus Jakarta Sans
  ar: ['latin'], // Arabic script not supported, only Latin UI
  hi: ['latin'], // Devanagari not supported, only Latin UI
  ja: ['latin'], // Japanese not supported, only Latin UI
  id: ['latin'], // Indonesian: standard Latin
  tr: ['latin', 'latin-ext'], // Turkish: ş, ğ, ı, ö, ü, ç
};

// Suppress unused variable warning - kept for documentation
void _LANGUAGE_FONT_SUBSETS;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Special meta tags for 404 page (not in meta.json)
 */
const NOT_FOUND_META: Record<string, string> = {
  title: 'Page Not Found | Instagram Unfollow Tracker',
  description: "The page you're looking for doesn't exist. It might have been moved or deleted.",
  ogTitle: 'Page Not Found',
  keywords: '404, not found, instagram unfollow tracker',
  twitterDescription: "The page you're looking for doesn't exist.",
};

function loadMetaJson(lang: string, rootDir: string, route: string): Record<string, string> {
  // Special handling for 404 page
  if (route === '/404' || route.endsWith('/404')) {
    return NOT_FOUND_META;
  }

  let meta: Record<string, unknown>;
  try {
    const metaPath = path.join(rootDir, 'src', 'locales', lang, 'meta.json');
    const content = fs.readFileSync(metaPath, 'utf-8');
    meta = JSON.parse(content);
  } catch {
    // Fallback to English
    const enPath = path.join(rootDir, 'src', 'locales', 'en', 'meta.json');
    const content = fs.readFileSync(enPath, 'utf-8');
    meta = JSON.parse(content);
  }

  // Extract base path (strip language prefix) for route-specific meta lookup
  const langPrefixPattern = createLanguagePrefixRegex();
  const basePath = route.replace(langPrefixPattern, '/') || '/';

  // Merge route-specific overrides if available
  const routes = meta.routes as Record<string, Record<string, string>> | undefined;
  if (routes && routes[basePath]) {
    const { routes: _unused, ...defaults } = meta;
    return { ...defaults, ...routes[basePath] } as Record<string, string>;
  }

  // Return base meta (without routes key)
  const { routes: _unused, ...defaults } = meta;
  return defaults as Record<string, string>;
}

/**
 * SSG hook to inject localized meta tags, canonical, hreflang for each page
 */
export async function injectLocalizedMeta(
  route: string,
  renderedHTML: string,
  rootDir: string
): Promise<string> {
  // Normalize route to always start with /
  // vite-react-ssg may pass routes without leading slash (e.g., "results" instead of "/results")
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`;

  // Canonicalize wizard steps to /wizard (they share the same page content)
  const isWizardStep = normalizedRoute.match(/\/wizard\/step\/\d+/);
  const canonicalBasePath = isWizardStep
    ? normalizedRoute.replace(/\/wizard\/step\/\d+/, '/wizard')
    : normalizedRoute;

  // Normalize route for canonical URL
  const canonicalPath = canonicalBasePath === '/' ? '' : canonicalBasePath.replace(/\/$/, '');
  const canonicalUrl = `${BASE_URL}${canonicalPath || '/'}`;

  // Get base path without language prefix for hreflang
  const langPrefixPattern = createLanguagePrefixRegex();
  const basePath = normalizedRoute.replace(langPrefixPattern, '/') || '/';
  const normalizedBasePath = basePath === '/' ? '' : basePath;

  // Extract language from route
  const langMatch = normalizedRoute.match(langPrefixPattern);
  const currentLang = langMatch ? langMatch[1] : 'en';

  // Load localized meta tags (with special handling for 404)
  const metaTags = loadMetaJson(currentLang, rootDir, normalizedRoute);
  const escapedTitle = escapeHtml(metaTags.title || 'Instagram Unfollowers');
  const escapedDescription = escapeHtml(metaTags.description || '');
  const escapedKeywords = escapeHtml(metaTags.keywords || '');
  const escapedOgTitle = escapeHtml(metaTags.ogTitle || metaTags.title || '');
  const escapedTwitterDesc = escapeHtml(metaTags.twitterDescription || metaTags.description || '');
  const localeCode = getLocaleCode(currentLang);

  // Generate hreflang links
  const hreflangLinks = SUPPORTED_LANGUAGES.map(lang => {
    const url =
      lang === 'en'
        ? `${BASE_URL}${normalizedBasePath || '/'}`
        : `${BASE_URL}/${lang}${normalizedBasePath}`;
    return `<link rel="alternate" hreflang="${lang}" href="${url}"/>`;
  }).join('\n    ');

  // Add x-default (English)
  const xDefaultUrl = `${BASE_URL}${normalizedBasePath || '/'}`;
  const xDefaultLink = `<link rel="alternate" hreflang="x-default" href="${xDefaultUrl}"/>`;

  // Canonical link
  const canonicalLink = `<link rel="canonical" href="${canonicalUrl}"/>`;

  // Build og:locale:alternate list (excluding current language)
  const alternateLocales = Object.values(LOCALE_CODES)
    .filter(locale => locale !== localeCode)
    .map(locale => `<meta property="og:locale:alternate" content="${locale}"/>`)
    .join('\n    ');

  // SEO tags to inject before </head>
  const seoTags = `
    <!-- SSG SEO: canonical, hreflang, og:locale -->
    ${canonicalLink}
    ${hreflangLinks}
    ${xDefaultLink}
    <meta property="og:locale" content="${localeCode}"/>
    ${alternateLocales}
  `;

  // OG image URL - static image for all languages (API doesn't work with Vercel SSG)
  const ogImageUrl = `${BASE_URL}/og-image.png`;

  // Replace all meta tags in HTML
  let html = renderedHTML;

  // 0. Replace <html lang="en"> with current language (+ dir="rtl" for Arabic)
  const isRtl = RTL_LANGUAGES.includes(currentLang as (typeof RTL_LANGUAGES)[number]);
  const htmlOpenTag = isRtl
    ? `<html lang="${currentLang}" dir="rtl"`
    : `<html lang="${currentLang}"`;
  html = html.replace(/<html\s+lang="[^"]*"(\s+dir="[^"]*")?/, htmlOpenTag);

  // 1. Replace <title>
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapedTitle}</title>`);

  // 2. Replace <meta name="description">
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"/,
    `<meta name="description" content="${escapedDescription}"`
  );

  // 3. Replace <meta name="keywords">
  html = html.replace(
    /<meta\s+name="keywords"\s+content="[^"]*"/,
    `<meta name="keywords" content="${escapedKeywords}"`
  );

  // 4. Replace <meta property="og:title">
  html = html.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"/,
    `<meta property="og:title" content="${escapedOgTitle}"`
  );

  // 5. Replace <meta property="og:description">
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"/,
    `<meta property="og:description" content="${escapedDescription}"`
  );

  // 6. Replace <meta property="og:image">
  html = html.replace(
    /<meta\s+property="og:image"\s+content="[^"]*"/,
    `<meta property="og:image" content="${ogImageUrl}"`
  );

  // 7. Replace <meta property="og:url">
  html = html.replace(
    /<meta\s+property="og:url"\s+content="[^"]*"/,
    `<meta property="og:url" content="${canonicalUrl}"`
  );

  // 8. Replace <meta name="twitter:title">
  html = html.replace(
    /<meta\s+name="twitter:title"\s+content="[^"]*"/,
    `<meta name="twitter:title" content="${escapedOgTitle}"`
  );

  // 9. Replace <meta name="twitter:description">
  html = html.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"/,
    `<meta name="twitter:description" content="${escapedTwitterDesc}"`
  );

  // 10. Replace <meta name="twitter:image">
  html = html.replace(
    /<meta\s+name="twitter:image"\s+content="[^"]*"/,
    `<meta name="twitter:image" content="${ogImageUrl}"`
  );

  // Remove old og:locale and og:locale:alternate (will be added in seoTags)
  html = html.replace(/<meta\s+property="og:locale"\s+content="[^"]*"\s*\/?>\s*/g, '');
  html = html.replace(/<meta\s+property="og:locale:alternate"\s+content="[^"]*"\s*\/?>\s*/g, '');

  // Inject SEO tags before </head>
  return html.replace('</head>', `${seoTags}</head>`);
}

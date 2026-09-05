import fs from 'fs';
import path from 'path';
import {
  SUPPORTED_LANGUAGES,
  LOCALE_CODES,
  RTL_LANGUAGES,
  I18N_NAMESPACES,
  getLocaleCode,
  createLanguagePrefixRegex,
  type SupportedLanguage,
} from '../src/config/languages.js';
import { INTENT_PATHS } from '../src/config/intent-pages.js';

const BASE_URL = 'https://safeunfollow.app';

/**
 * The only font subsets that belong on the critical path. index.html preloads exactly
 * these two by hand; everything else is a unicode-range subset the browser fetches from
 * the characters actually on the page.
 */
const CRITICAL_FONT_SUBSET = /-latin-wght-normal-/;

/**
 * Strip the font preloads vite-react-ssg injects for the whole asset graph.
 *
 * It emits one `rel="preload" as="font"` per woff2 reachable from the entry
 * (vite-react-ssg dist/shared/…:218) with no notion of unicode-range. That is ten
 * subsets, 269.5 KB, against the 73.8 KB of the two latin ones — forced onto all 162
 * prerendered pages, and it defeats the mechanism the subsets exist for. Runs from
 * onPageRendered, which vite-react-ssg calls AFTER renderPreloadLinks.
 */
export function dropOnDemandFontPreloads(html: string): string {
  return html.replace(/<link\b[^>]*\brel="preload"[^>]*>/g, tag => {
    if (!tag.includes('as="font"')) return tag;
    return CRITICAL_FONT_SUBSET.test(tag) ? tag : '';
  });
}

/**
 * modulepreload hrefs for the locale chunks a page will fetch, English first.
 *
 * initI18n awaits English unconditionally before the URL language, so a non-English page
 * must preload both sets or the tags prioritise the second wave and leave the gating one
 * cold.
 *
 * Throws on a missing entry instead of emitting a dead href: a 404 modulepreload is
 * silent in the network panel and buys nothing, which is exactly the class of bug that
 * survives review.
 */
export function localeChunkHrefs(
  lang: string,
  manifest: Record<string, { file: string }>
): string[] {
  const langs = lang === 'en' ? ['en'] : ['en', lang];
  return langs.flatMap(l =>
    I18N_NAMESPACES.map(ns => {
      const key = `src/locales/${l}/${ns}.json`;
      const entry = manifest[key];
      if (!entry) throw new Error(`vite manifest has no entry for ${key}`);
      return `/${entry.file}`;
    })
  );
}

let manifestCache: Record<string, { file: string }> | null = null;

// Caches on the first call and ignores rootDir on every later one. Safe today: this hook runs
// once per `vite build` process, and every call within that process shares the same rootDir.
// Would need a rootDir-keyed cache if this module were ever reused across builds in one process.
function readViteManifest(rootDir: string): Record<string, { file: string }> {
  if (manifestCache) return manifestCache;
  const manifestPath = path.join(rootDir, 'dist', '.vite', 'manifest.json');
  manifestCache = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as Record<
    string,
    { file: string }
  >;
  return manifestCache;
}

/**
 * Font subsets needed for each language. Unused — kept because it is the input a
 * per-locale preload would need, and the table itself is still correct.
 *
 * The note that stood here was half right and drew the wrong conclusion from it. It had
 * the mismatch backwards — the hashed /assets/ URL was the PRELOAD, and /files/ was what
 * the stylesheet asked for — and it closed with "fonts still load correctly via CSS
 * @font-face rules", which was false twice over: the families never matched, and
 * /assets/files/ never existed. Both are fixed as of 2026-08-20; see
 * src/__tests__/build/font-loading.test.ts.
 *
 * Preloading per locale is the open question, and it is a measurement, not a decision:
 * Inter's latin-ext alone is 83 KB, so preloading it for de/es/fr/pt/tr may well cost
 * more than the swap it avoids. Only the two latin subsets ride the critical path until
 * someone puts a number on it.
 */
const _LANGUAGE_FONT_SUBSETS: Record<SupportedLanguage, string[]> = {
  en: ['latin'],
  es: ['latin', 'latin-ext'], // Spanish accents: á, é, í, ñ, ü
  pt: ['latin', 'latin-ext'], // Portuguese: ã, ç, õ
  fr: ['latin', 'latin-ext'], // French: é, è, ê, ë, ç
  de: ['latin', 'latin-ext'], // German: ä, ö, ü, ß
  ru: ['latin', 'cyrillic', 'cyrillic-ext'], // Russian: cyrillic for Inter, cyrillic-ext for Plus Jakarta Sans
  ar: ['latin'], // Arabic script not supported, only Latin UI
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

  // Normalize route for canonical URL.
  //
  // Eight `/wizard/step/N` pages per language used to be canonicalized back to
  // `/wizard` here, because they were one page behind eight addresses. The
  // guide is a dialog on /upload now (GH#102) and those routes no longer
  // exist, so there is nothing to collapse: every prerendered route is its own
  // canonical. `?guide=1` and `?step=N` never reach this hook — vite-react-ssg
  // renders paths, not query strings.
  const canonicalPath = normalizedRoute === '/' ? '' : normalizedRoute.replace(/\/$/, '');
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

  // Pages that exist in English only advertise no alternates. Emitting the full
  // SUPPORTED_LANGUAGES list here would name nine URLs no build emits — the same defect
  // scripts/generate-sitemap.ts records at its EXCLUDE_PATTERNS comment, from the other end.
  const englishOnly = INTENT_PATHS.includes(basePath);

  // Generate hreflang links
  const hreflangLinks = englishOnly
    ? ''
    : SUPPORTED_LANGUAGES.map(lang => {
        const url =
          lang === 'en'
            ? `${BASE_URL}${normalizedBasePath || '/'}`
            : `${BASE_URL}/${lang}${normalizedBasePath}`;
        return `<link rel="alternate" hreflang="${lang}" href="${url}"/>`;
      }).join('\n    ');

  // x-default names a URL too, so it goes with them.
  const xDefaultUrl = `${BASE_URL}${normalizedBasePath || '/'}`;
  const xDefaultLink = englishOnly
    ? ''
    : `<link rel="alternate" hreflang="x-default" href="${xDefaultUrl}"/>`;

  // Canonical link
  const canonicalLink = `<link rel="canonical" href="${canonicalUrl}"/>`;

  // Same guard, same reason, weaker medium: these name a locale code rather than a URL, so
  // nothing here can crawl to a 404 — but an English-only page still claims nine locales it
  // does not have.
  const alternateLocales = englishOnly
    ? ''
    : Object.values(LOCALE_CODES)
        .filter(locale => locale !== localeCode)
        .map(locale => `<meta property="og:locale:alternate" content="${locale}"/>`)
        .join('\n    ');

  // Preload the locale chunks this page will fetch during hydration, so they start
  // downloading with the entry bundle instead of after it parses.
  const preloadTags = localeChunkHrefs(currentLang, readViteManifest(rootDir))
    .map(href => `<link rel="modulepreload" crossorigin href="${href}">`)
    .join('\n    ');

  // SEO tags to inject before </head>
  const seoTags = `
    <!-- SSG SEO: canonical, hreflang, og:locale -->
    ${canonicalLink}
    ${hreflangLinks}
    ${xDefaultLink}
    <meta property="og:locale" content="${localeCode}"/>
    ${alternateLocales}
    <!-- SSG i18n: preload locale chunks for the entry bundle -->
    ${preloadTags}
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

  // Drop the whole-asset-graph font preloads vite-react-ssg appended before this hook ran
  html = dropOnDemandFontPreloads(html);

  // Inject SEO tags before </head>
  return html.replace('</head>', `${seoTags}</head>`);
}

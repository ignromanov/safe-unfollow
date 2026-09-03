/**
 * Shared language configuration
 *
 * Single source of truth for supported languages.
 * Used by: locales/index.ts, scripts/generate-sitemap.ts, routes.tsx
 *
 * IMPORTANT: This file must have NO external dependencies
 * to be importable from both src/ and scripts/
 */

export const SUPPORTED_LANGUAGES = [
  'en', // Default language (always first)
  'ar', // العربية
  'de', // Deutsch
  'es', // Español
  'fr', // Français
  'id', // Indonesia
  'ja', // 日本語
  'pt', // Português
  'ru', // Русский
  'tr', // Türkçe
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  ar: 'العربية',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  id: 'Indonesia',
  ja: '日本語',
  pt: 'Português',
  ru: 'Русский',
  tr: 'Türkçe',
};

/** RTL languages that require dir="rtl" attribute */
export const RTL_LANGUAGES: SupportedLanguage[] = ['ar'];

/** Default/fallback language */
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

/**
 * The i18next namespaces every page loads.
 *
 * Single source of truth: src/locales/index.ts derives its resource loader and its i18next
 * `ns` list from this, and vite/ssg-meta-injector.ts derives the SSG modulepreload hrefs from
 * it. A namespace added here reaches both without a second edit. Before this constant existed,
 * the same eight-item list was hand-copied in three places with two different orderings —
 * drift there would not throw, it would just under-preload or under-register one namespace.
 */
export const I18N_NAMESPACES = [
  'common',
  'faq',
  'hero',
  'howto',
  'meta',
  'results',
  'upload',
  'wizard',
] as const;

export type I18nNamespace = (typeof I18N_NAMESPACES)[number];

/**
 * OpenGraph locale codes for each language
 * Format: language_COUNTRY (ISO 639-1 + ISO 3166-1 alpha-2)
 * Used for og:locale meta tags in SSG
 */
export const LOCALE_CODES: Record<SupportedLanguage, string> = {
  en: 'en_US',
  ar: 'ar_SA',
  de: 'de_DE',
  es: 'es_ES',
  fr: 'fr_FR',
  id: 'id_ID',
  ja: 'ja_JP',
  pt: 'pt_BR',
  ru: 'ru_RU',
  tr: 'tr_TR',
};

/**
 * Get locale code for a language
 * @param lang - Language code (e.g., 'es', 'ru')
 * @returns Locale code (e.g., 'es_ES', 'ru_RU')
 */
export function getLocaleCode(lang: string): string {
  return LOCALE_CODES[lang as SupportedLanguage] || 'en_US';
}

/**
 * Non-English languages (for routing, regex patterns)
 * Excludes 'en' as it's the default/base language
 */
export const NON_ENGLISH_LANGUAGES = SUPPORTED_LANGUAGES.filter(lang => lang !== 'en');

/**
 * Language regex pattern for URL matching (without 'en')
 *
 * The alternation is built from NON_ENGLISH_LANGUAGES, so it is never written out here.
 * It used to be, three times over, and all three copies still named `hi` — retired
 * 2026-08-08 — while omitting `fr`. A comment in the file that decides a fact is the
 * worst place to keep a stale copy of it, because it is the copy every other document
 * gets transcribed from: `docs/tech-spec.md` carried both errors verbatim until
 * 2026-09-02.
 *
 * Usage examples:
 * - Vercel rewrites: `/:lang(${LANGUAGE_REGEX_PATTERN})/:path*`
 * - Route matching: see createLanguagePrefixRegex() below, which builds it
 */
export const LANGUAGE_REGEX_PATTERN = NON_ENGLISH_LANGUAGES.join('|');

/**
 * Creates a regex pattern for matching language prefixes in URLs
 * @param flags - Optional regex flags (e.g., 'i' for case-insensitive)
 * @returns RegExp for matching /<lang>/ or /<lang>
 *
 * @example
 * const pattern = createLanguagePrefixRegex();
 * pattern.test('/es/wizard'); // true
 * pattern.test('/en/wizard'); // false
 * pattern.test('/wizard');    // false
 */
export function createLanguagePrefixRegex(flags?: string): RegExp {
  return new RegExp(`^\\/(${LANGUAGE_REGEX_PATTERN})(\\/|$)`, flags);
}

/**
 * Detect language from URL pathname
 *
 * Extracts language code from the first path segment.
 * Returns DEFAULT_LANGUAGE if no valid language prefix found.
 *
 * @param pathname - URL pathname (e.g., '/es/wizard', '/ru/', '/')
 * @returns Detected language code
 *
 * @example
 * detectLanguageFromPathname('/es/wizard'); // 'es'
 * detectLanguageFromPathname('/ru/');       // 'ru'
 * detectLanguageFromPathname('/wizard');    // 'en' (default)
 * detectLanguageFromPathname('/');          // 'en' (default)
 */
export function detectLanguageFromPathname(pathname: string): SupportedLanguage {
  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];

  if (firstSegment && SUPPORTED_LANGUAGES.includes(firstSegment as SupportedLanguage)) {
    return firstSegment as SupportedLanguage;
  }

  return DEFAULT_LANGUAGE;
}

/**
 * Detect language from current browser URL
 *
 * Safe to call on server (returns DEFAULT_LANGUAGE).
 * Uses window.location.pathname to detect language.
 *
 * @returns Detected language code from current URL
 */
export function detectLanguageFromUrl(): SupportedLanguage {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE;
  }

  return detectLanguageFromPathname(window.location.pathname);
}

/**
 * Detect preferred language from browser settings
 *
 * Checks navigator.languages (array of preferred languages) first,
 * then falls back to navigator.language.
 * Returns DEFAULT_LANGUAGE if no supported language is found or on server.
 *
 * @returns Detected language code from browser preferences
 *
 * @example
 * // Browser with navigator.languages = ['ru-RU', 'en-US']
 * detectBrowserLanguage(); // 'ru'
 *
 * // Browser with navigator.language = 'es-MX'
 * detectBrowserLanguage(); // 'es'
 *
 * // Browser with unsupported language 'zh-CN'
 * detectBrowserLanguage(); // 'en' (default)
 */
export function detectBrowserLanguage(): SupportedLanguage {
  if (typeof navigator === 'undefined') {
    return DEFAULT_LANGUAGE;
  }

  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];

  for (const browserLang of languages) {
    if (!browserLang) continue;

    const langCode = browserLang.split('-')[0]?.toLowerCase();
    if (!langCode) continue;

    if (SUPPORTED_LANGUAGES.includes(langCode as SupportedLanguage)) {
      return langCode as SupportedLanguage;
    }
  }

  return DEFAULT_LANGUAGE;
}

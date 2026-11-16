/**
 * The locale hint: when the browser is translating a page into a language we already
 * publish, offer that page instead.
 *
 * A hint and never a redirect. index.html stopped redirecting by locale in #49 (an extra
 * document load before first paint, and Google's guidance against it), and Lumen's ruling of
 * 2026-11-16 keeps it that way. The trigger is the translator actually running, not the
 * browser's preferred language: the second is a guess, the first is the reader telling us.
 */
import {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  createLanguagePrefixRegex,
  type SupportedLanguage,
} from '@/config/languages';
import { INTENT_PATHS } from '@/config/intent-pages';

/** Chrome's page translator adds one of these to <html> and sets its `lang` to the target. */
const TRANSLATED_CLASS = /\btranslated-(ltr|rtl)\b/;

/**
 * The language a page translator is rendering this page in, if it is one we publish and not
 * the page's own. Anything else is `null`, and `null` means no hint and no event: the value
 * that reaches analytics is only ever a member of SUPPORTED_LANGUAGES (velum-cdpo).
 */
export function translationTarget(
  html: HTMLElement,
  pageLang: SupportedLanguage
): SupportedLanguage | null {
  if (!TRANSLATED_CLASS.test(html.className)) return null;
  const primary = (html.getAttribute('lang') ?? '').split('-')[0]?.toLowerCase();
  const target = SUPPORTED_LANGUAGES.find(lang => lang === primary);
  return target !== undefined && target !== pageLang ? target : null;
}

/** Pages that exist in every language. Every other hint page is English-only. */
const LOCALIZED_PAGES = new Set(['/', '/upload']);

/**
 * Where the hint sends a reader on `pathname`, or `null` where it does not belong.
 *
 * Only the pages a reader sees before handing over an export: never /results or /sample,
 * where a navigation would drop what they are reading.
 */
export function localeHintHref(pathname: string, target: SupportedLanguage): string | null {
  const base = pathname.replace(createLanguagePrefixRegex(), '/').replace(/(.)\/$/, '$1');
  const prefix = target === DEFAULT_LANGUAGE ? '' : `/${target}`;
  if (LOCALIZED_PAGES.has(base)) return base === '/' ? prefix || '/' : `${prefix}${base}`;
  if (INTENT_PATHS.includes(base)) return prefix || base;
  return null;
}

const DISMISS_KEY = 'locale-hint-dismissed';

/** Dismissal stays on this device and is never sent anywhere (velum-cdpo). */
export function dismissLocaleHint(): void {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // Storage refused: the hint closes for this page and may come back on the next one.
  }
}

export function isLocaleHintDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) !== null;
  } catch {
    return false;
  }
}

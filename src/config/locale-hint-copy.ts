import type { SupportedLanguage } from './languages';

/**
 * The locale hint's words, in the language each one offers, and in ONE place.
 *
 * Not in the i18n bundles on purpose. The hint is shown to a reader whose page is in another
 * language, so it must speak the target language whatever the page is in, and loading a
 * second locale's whole bundle for two strings would cost more than it says. The element
 * carries `translate="no"`, so the translator that triggered it does not rewrite it.
 *
 * Copy: lumen-cro's draft of 2026-11-16. ⚠️ `ar` and `de` still want a native reader
 * (progress.md, owner item 8). `en` and every `close` label are vera-cto's, unreviewed.
 */
export const LOCALE_HINT_COPY: Record<
  SupportedLanguage,
  { text: string; open: string; close: string }
> = {
  en: { text: 'This page is available in English.', open: 'Open', close: 'Close' },
  id: { text: 'Halaman ini tersedia dalam Bahasa Indonesia.', open: 'Buka', close: 'Tutup' },
  pt: { text: 'Esta página está disponível em português.', open: 'Abrir', close: 'Fechar' },
  es: { text: 'Esta página está disponible en español.', open: 'Abrir', close: 'Cerrar' },
  ru: { text: 'Эта страница есть на русском.', open: 'Открыть', close: 'Закрыть' },
  de: { text: 'Diese Seite gibt es auch auf Deutsch.', open: 'Öffnen', close: 'Schließen' },
  fr: { text: 'Cette page existe aussi en français.', open: 'Ouvrir', close: 'Fermer' },
  tr: { text: 'Bu sayfa Türkçe olarak da mevcut.', open: 'Aç', close: 'Kapat' },
  ja: { text: 'このページは日本語でもご覧いただけます。', open: '開く', close: '閉じる' },
  ar: { text: 'هذه الصفحة متاحة باللغة العربية.', open: 'فتح', close: 'إغلاق' },
};

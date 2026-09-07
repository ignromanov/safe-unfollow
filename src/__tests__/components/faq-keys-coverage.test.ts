import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES } from '@/config/languages';
import { FAQ_KEYS } from '@/components/FAQSection';
import { INTENT_PATHS } from '@/config/intent-pages';
import faqEN from '@/locales/en/faq.json';

/**
 * FAQ_KEYS in FAQSection.tsx is a hand-enumerated array: a key present in a
 * locale bundle but absent from that array renders nowhere, and a key in the
 * array but missing from a bundle renders an untranslated fallback. Neither
 * failure throws, so both are silent without a derived gate.
 *
 * Modeled on wizard-routing.test.ts (PR #174, 3fa131b): build the key set from
 * a source of truth instead of listing it by hand a second time here.
 */

interface FaqItem {
  question: string;
  answer: string;
  relatedLink?: { text: string; href: string };
}

const BUNDLES = import.meta.glob<{ items: Record<string, FaqItem> }>('../../locales/*/faq.json', {
  eager: true,
  import: 'default',
});

function itemsFor(lang: string): Record<string, FaqItem> {
  const bundle = BUNDLES[`../../locales/${lang}/faq.json`];
  if (!bundle) throw new Error(`No faq.json bundle found for locale "${lang}"`);
  return bundle.items;
}

describe('FAQ_KEYS coverage', () => {
  it.each(SUPPORTED_LANGUAGES)('every FAQ_KEYS entry exists with content in %s/faq.json', lang => {
    const items = itemsFor(lang);
    for (const key of FAQ_KEYS) {
      expect(items, `${lang}/faq.json is missing key "${key}"`).toHaveProperty(key);
      expect(items[key]?.question, `${lang}/faq.json "${key}".question is empty`).toBeTruthy();
      expect(items[key]?.answer, `${lang}/faq.json "${key}".answer is empty`).toBeTruthy();
    }
  });

  /**
   * The intent pages exist in English only (src/config/intent-pages.ts), and FAQSection renders
   * `relatedLink.href` through PrefixedLink, which prepends the locale — so a non-English bundle
   * naming one of those paths would ship `/ru/who-doesnt-follow-me-back`, a route no build
   * emits. The locale parity gate (locales.test.ts) forces every bundle to carry a relatedLink
   * for these items; this is the gate that says what it may point at.
   */
  it.each(SUPPORTED_LANGUAGES.filter(lang => lang !== 'en'))(
    'no relatedLink in %s/faq.json names an English-only intent page',
    lang => {
      const offenders = Object.entries(itemsFor(lang))
        .filter(([, item]) => item.relatedLink && INTENT_PATHS.includes(item.relatedLink.href))
        .map(([key, item]) => `${key} → ${item.relatedLink?.href}`);
      expect(offenders, 'would prefix to a 404 under this locale').toEqual([]);
    }
  );

  it('control: the English bundle does link the intent pages, so the check can see them', () => {
    const linked = Object.values(itemsFor('en'))
      .map(item => item.relatedLink?.href)
      .filter((href): href is string => href !== undefined && INTENT_PATHS.includes(href));
    expect(linked).toHaveLength(INTENT_PATHS.length);
  });

  it('every key in the English bundle is in FAQ_KEYS (nothing renders nowhere)', () => {
    const englishKeys = Object.keys(faqEN.items);
    const orphaned = englishKeys.filter(key => !(FAQ_KEYS as readonly string[]).includes(key));
    expect(orphaned, 'keys present in en/faq.json but absent from FAQ_KEYS').toEqual([]);
  });
});

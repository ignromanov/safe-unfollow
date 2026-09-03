import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES } from '@/config/languages';
import { FAQ_KEYS } from '@/components/FAQSection';
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

const BUNDLES = import.meta.glob<{ items: Record<string, { question: string; answer: string }> }>(
  '../../locales/*/faq.json',
  { eager: true, import: 'default' }
);

function itemsFor(lang: string): Record<string, { question: string; answer: string }> {
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

  it('every key in the English bundle is in FAQ_KEYS (nothing renders nowhere)', () => {
    const englishKeys = Object.keys(faqEN.items);
    const orphaned = englishKeys.filter(key => !(FAQ_KEYS as readonly string[]).includes(key));
    expect(orphaned, 'keys present in en/faq.json but absent from FAQ_KEYS').toEqual([]);
  });
});

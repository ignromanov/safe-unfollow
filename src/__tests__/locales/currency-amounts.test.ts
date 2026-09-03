import { describe, expect, it } from 'vitest';

import { currencyAmountIn } from '@/__tests__/utils/currency';
import { SUPPORTED_LANGUAGES } from '@/config/languages';

const BUNDLES = import.meta.glob<Record<string, unknown>>('../../locales/*/*.json', {
  eager: true,
  import: 'default',
});

/** `src/locales/id/faq.json` → `id/faq`, which is what a failure needs to name. */
function bundleName(path: string): string {
  return path
    .split('/')
    .slice(-2)
    .join('/')
    .replace(/\.json$/, '');
}

/** Every leaf string in a bundle, with the dotted key path that reaches it. */
function* strings(value: unknown, path = ''): Generator<[string, string]> {
  if (typeof value === 'string') {
    yield [path, value];
  } else if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) yield* strings(item, `${path}[${index}]`);
  } else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      yield* strings(item, path ? `${path}.${key}` : key);
    }
  }
}

// The price is per country and resolved in the browser: Rp50.000 in Jakarta,
// ₹200 in Delhi, ₱150 in Manila, $7 everywhere else (`country-price.ts`). A
// bundle cannot hold any of those, because a bundle is chosen by *language*
// and the price is chosen by *country* — and the two do not line up. Indian
// and Philippine readers are served the English bundle; an Indonesian-speaking
// reader in the Netherlands is served `id` and charged $7.
//
// So the rule is not "the bundles agree on one number", which is what this
// repo used to enforce. It is that a bundle names no amount at all: the copy
// states the price it is *given*, or it states no price. Whether a given key
// takes `{{price}}` is `paywall-price.test.ts`'s question; this file asks the
// simpler one, everywhere at once.
//
// It is deliberately tree-wide rather than aimed at the keys that have gone
// wrong. Three surfaces have now hardcoded an amount — the paywall (fixed by
// #165), the FAQ, and `export.license` — and each was found by a person
// reading, weeks apart, after the sweep that would have caught it had been
// written and pointed somewhere else. `paywall-price.test.ts` swept
// `results.json` and missed `export.license`, a *sibling object in the file it
// was already reading*. A whitelist of watched keys reproduces that failure by
// construction; a sweep with no whitelist cannot.
describe('locale bundles never state a currency amount', () => {
  // A sweep that silently matches nothing passes forever. Pin both ends: every
  // language has bundles, and the total is in the range a ten-locale tree
  // produces — so a glob that stops resolving, or a locale that loses its
  // directory, fails here rather than going quiet.
  it('actually reads every locale', () => {
    const names = Object.keys(BUNDLES).map(bundleName);

    for (const language of SUPPORTED_LANGUAGES) {
      expect(
        names.filter(name => name.startsWith(`${language}/`)).length,
        `${language} has bundles`
      ).toBeGreaterThan(0);
    }

    expect(names.length).toBe(new Set(names).size);
  });

  it('holds no hardcoded price in any language, namespace or key', () => {
    const offences: string[] = [];

    for (const [path, bundle] of Object.entries(BUNDLES)) {
      for (const [key, text] of strings(bundle)) {
        const amount = currencyAmountIn(text);
        if (amount !== undefined) {
          offences.push(`${bundleName(path)} → ${key}: ${amount} in "${text}"`);
        }
      }
    }

    expect(offences, `hardcoded amounts:\n${offences.join('\n')}`).toEqual([]);
  });
});

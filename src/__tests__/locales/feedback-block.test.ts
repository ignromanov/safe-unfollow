import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES } from '@/config/languages';

const BUNDLES = import.meta.glob<Record<string, unknown>>('../../locales/*/results.json', {
  eager: true,
  import: 'default',
});

function bundleFor(language: string): Record<string, unknown> {
  const entry = Object.entries(BUNDLES).find(([path]) => path.includes(`/${language}/`));
  if (!entry) throw new Error(`no results.json for ${language}`);
  return entry[1] as Record<string, unknown>;
}

// `locales.test.ts` already diffs every namespace's full key set against English,
// which would fail if a translator dropped `feedback` entirely or misspelled a
// key inside it. This test exists anyway, scoped to the one block, because the
// generic parity check reports the whole `results` namespace as one failure —
// a dropped `feedback.notice` and a dropped `header.showing` look identical in
// that output. Naming the block here makes the failure point at it directly.
describe('feedback block (all locales)', () => {
  const REQUIRED_KEYS = ['headline', 'body', 'notice', 'cta'] as const;

  it('exists with the same key set in every supported language', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const feedback = bundleFor(language).feedback as Record<string, unknown> | undefined;

      expect(feedback, `${language} results.json has a feedback block`).toBeTruthy();

      const keys = Object.keys(feedback ?? {}).sort();
      expect(keys, `${language} feedback keys`).toEqual([...REQUIRED_KEYS].sort());

      for (const key of REQUIRED_KEYS) {
        expect(
          String(feedback?.[key] ?? '').trim().length,
          `${language} feedback.${key} is non-empty`
        ).toBeGreaterThan(0);
      }
    }
  });

  // Velum's condition 3: the disclosure names where the answer goes, before the
  // act, in every language — not just English. "Tally" is the one word that
  // cannot be translated away without losing the claim.
  it('names Tally in the notice, in every supported language', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const notice = String((bundleFor(language).feedback as Record<string, unknown>)?.notice);

      expect(notice, `${language} feedback.notice mentions Tally`).toContain('Tally');
    }
  });
});

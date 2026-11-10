import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { NON_AFFILIATION } from '@/config/entity';
import { SUPPORTED_LANGUAGES } from '@/config/languages';

/**
 * The entity as an engine first reads it, and the one sentence that says what it is not.
 *
 * Plan 2026-11-09-seo-aeo-geo, tasks 01/02/03; velum-cdpo's conditions on the non-affiliation
 * sentence (plan/velum-verdicts.md Q1): one source with every copy pinned equal to it; in every
 * locale's answer the lookalike's domain appears exactly once, never after `(` or `[`, never in an
 * `href`; and never in a URL-typed field (that half is in `OrganizationSchema.test.tsx`).
 */
const ROOT = process.cwd();
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf-8');

const LLMS = read('public', 'llms.txt');
const FAQ_MD = read('docs', 'faq.md');
const CONFIG = read('docs', '_config.yml');

function notAffiliatedAnswer(lang: string): string {
  const faq = JSON.parse(read('src', 'locales', lang, 'faq.json')) as {
    items: Record<string, { answer?: string }>;
  };
  const answer = faq.items.notAffiliated?.answer;
  expect(answer, `${lang}/faq.json has no items.notAffiliated.answer`).toBeTruthy();
  return answer!;
}

describe('llms.txt names the entity first', () => {
  it('llms.txt H1 names SafeUnfollow and safeunfollow.app', () => {
    expect(LLMS.split('\n')[0]).toBe('# SafeUnfollow (safeunfollow.app)');
  });
});

describe('the non-affiliation sentence has one source', () => {
  it('is the sentence velum-cdpo licensed', () => {
    expect(NON_AFFILIATION).toBe(
      'SafeUnfollow.app is not affiliated with safeunfollow.com or with any browser extension named SafeUnfollow.'
    );
  });

  it('every English copy carries it verbatim, after an identity sentence', () => {
    const copies: Record<string, string> = {
      'public/llms.txt': LLMS,
      'docs/faq.md': FAQ_MD,
      'docs/_config.yml': CONFIG,
      'en/faq.json notAffiliated': notAffiliatedAnswer('en'),
    };
    for (const [where, text] of Object.entries(copies)) {
      const at = text.indexOf(NON_AFFILIATION);
      expect(at, `${where} does not carry the sentence verbatim`).toBeGreaterThan(-1);
      // Engines drop negations when they compress: the denial must not be the first thing read.
      expect(text.slice(0, at), `${where} opens on the denial`).toMatch(/safeunfollow\.app/i);
    }
  });

  it('in every locale the lookalike is named once, as plain text', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      const answer = notAffiliatedAnswer(lang);
      expect(answer.match(/safeunfollow\.com/gi), lang).toHaveLength(1);
      expect(answer, lang).not.toMatch(/[([]\s*(?:https?:\/\/)?(?:www\.)?safeunfollow\.com/i);
      expect(answer, lang).not.toMatch(/href|https?:\/\/(?:www\.)?safeunfollow\.com/i);
    }
  });

  it('no English surface links to it', () => {
    for (const text of [LLMS, FAQ_MD]) {
      expect(text).not.toMatch(/\]\([^)]*safeunfollow\.com|<[^>]*safeunfollow\.com/i);
    }
  });

  it('the locale gate can go red', () => {
    const planted = 'Ver [safeunfollow.com](https://safeunfollow.com) y safeunfollow.com';
    expect(planted.match(/safeunfollow\.com/gi)!.length).not.toBe(1);
    expect(planted).toMatch(/[([]\s*(?:https?:\/\/)?(?:www\.)?safeunfollow\.com/i);
  });
});

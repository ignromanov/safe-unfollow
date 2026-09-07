import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { INTENT_PAGES } from '@/config/intent-pages';

const docsIndex = readFileSync(resolve(process.cwd(), 'docs/index.md'), 'utf-8');

describe('intent pages are reachable', () => {
  // The control. /docs/faq is linked from this file today, so a miss here means the reader is
  // broken, not that the links are missing.
  it('should see a link that is definitely there', () => {
    expect(docsIndex).toContain('(/docs/faq)');
  });

  for (const page of INTENT_PAGES) {
    it(`should link /${page.slug} from the docs index`, () => {
      expect(docsIndex).toContain(`(/${page.slug})`);
    });

    it(`should use /${page.slug}'s own h1 as the link text`, () => {
      expect(docsIndex).toContain(`[${page.h1}](/${page.slug})`);
    });
  }

  /**
   * A truncated archive removes exactly the property these words assert. An export limited to a
   * date range arrives with its followers list already filtered, and `src/core/badges/index.ts`
   * records a real one where mutuals fell 298 -> 99. Each intent page hedges that in its own body;
   * a row that links to the page must not un-hedge it on the way in.
   */
  const ABSOLUTE_CLAIM = /\b(exact|exactly|complete|completely|guaranteed|every single)\b/i;

  function descriptorFor(slug: string): string {
    const line = docsIndex.split('\n').find(l => l.includes(`](/${slug})`));
    if (line === undefined) throw new Error(`no docs-index row links /${slug}`);
    return line.slice(line.indexOf(`](/${slug})`) + `](/${slug})`.length);
  }

  for (const page of INTENT_PAGES) {
    it(`should not claim exactness in /${page.slug}'s row`, () => {
      expect(descriptorFor(page.slug)).not.toMatch(ABSOLUTE_CLAIM);
    });
  }

  // The control. Without it the three cases above are green on arrival and stay green if the
  // pattern is ever emptied, which is the failure mode this whole class of gate exists to avoid.
  it('should be able to see an exactness claim when there is one', () => {
    expect('- Shows you completely who follows you back, guaranteed').toMatch(ABSOLUTE_CLAIM);
  });
});

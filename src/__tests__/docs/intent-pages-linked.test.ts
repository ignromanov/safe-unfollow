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
});

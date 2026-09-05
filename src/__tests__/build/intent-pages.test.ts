import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { INTENT_PAGES } from '@/config/intent-pages';
import meta from '@/locales/en/meta.json';

const distDir = resolve(process.cwd(), 'dist');
const built = existsSync(resolve(distDir, 'index.html'));

describe.runIf(built)('intent landing pages (prerendered)', () => {
  // The control. /upload IS a ten-locale page, so it MUST carry hreflang — if this fails,
  // the assertions below prove nothing, because the instrument cannot see hreflang at all.
  it('should find hreflang on a ten-locale page', () => {
    const html = readFileSync(resolve(distDir, 'upload.html'), 'utf-8');
    expect(html).toContain('hreflang="de"');
  });

  for (const page of INTENT_PAGES) {
    describe(`/${page.slug}`, () => {
      const html = () => readFileSync(resolve(distDir, `${page.slug}.html`), 'utf-8');

      it('should be prerendered as a flat file', () => {
        expect(existsSync(resolve(distDir, `${page.slug}.html`))).toBe(true);
      });

      it('should canonicalise to itself, without a query string', () => {
        const canonical = html().match(/<link rel="canonical" href="([^"]+)"/)?.[1];
        expect(canonical).toBe(`https://safeunfollow.app/${page.slug}`);
      });

      it('should advertise no hreflang alternate', () => {
        expect(html()).not.toContain('hreflang=');
      });

      it('should carry the title meta.json gives it', () => {
        // Derived, not retyped. A hand-copied expected string is a second place the title
        // lives, and the next copy edit changes one of them — the defect .claude/rules/testing.md
        // names. Reading the bundle also means a page with NO routes entry fails here rather
        // than silently inheriting the site-wide title.
        const expected = (meta.routes as Record<string, { title: string }>)[`/${page.slug}`]?.title;
        expect(expected).toBeTruthy();
        expect(html().match(/<title>([^<]*)<\/title>/)?.[1]).toBe(expected);
      });
    });
  }

  describe('sitemap', () => {
    const sitemap = () => readFileSync(resolve(distDir, 'sitemap.xml'), 'utf-8');

    // The control, and it must use the SAME extraction as the assertions below — a control
    // that reads the file a different way does not prove the reader works.
    const entryFor = (loc: string) =>
      sitemap()
        .split('<url>')
        .find(block => block.includes(`<loc>${loc}</loc>`));

    it('should list a ten-locale page with alternates', () => {
      const entry = entryFor('https://safeunfollow.app/upload');
      expect(entry).toBeDefined();
      expect(entry).toContain('hreflang="de"');
    });

    for (const page of INTENT_PAGES) {
      it(`should list /${page.slug} with no alternates`, () => {
        const entry = entryFor(`https://safeunfollow.app/${page.slug}`);

        expect(entry).toBeDefined();
        expect(entry).not.toContain('xhtml:link');
      });
    }
  });
});

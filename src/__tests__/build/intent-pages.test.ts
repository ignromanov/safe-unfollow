import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve, join } from 'path';
import { tmpdir } from 'os';
import { INTENT_PAGES, INTENT_PATHS } from '@/config/intent-pages';
import { I18N_NAMESPACES } from '@/config/languages';
import { injectLocalizedMeta } from '../../../vite/ssg-meta-injector';
import meta from '@/locales/en/meta.json';
import { INTENT_CONTENT } from '@/pages/intent-content';
import { INTENT_DEMO } from '@/config/intent-demo-rows';

const distDir = resolve(process.cwd(), 'dist');
const built = existsSync(resolve(distDir, 'index.html'));

/**
 * The logic half: does `injectLocalizedMeta` itself suppress hreflang for an intent path, and
 * does a normal page still get the full set? Fixture-driven — no `dist/` needed — because the
 * regression this task guards against (someone editing the `englishOnly` guard) lives in
 * build-time code that `describe.runIf(built)` below cannot see when CI skips the build
 * (code-quality.yml runs test:coverage with no build — GH#159).
 *
 * A throwaway rootDir stands in for the repo: `injectLocalizedMeta` reads
 * `<rootDir>/src/locales/<lang>/meta.json` and `<rootDir>/dist/.vite/manifest.json` (via
 * localeChunkHrefs), so both are written here rather than pointed at the real ones — the real
 * vite manifest only exists after a build, which is exactly the dependency this half must not
 * have.
 */
const fixtureRoot = mkdtempSync(join(tmpdir(), 'intent-meta-injector-'));

function writeFixture(): void {
  const localesDir = join(fixtureRoot, 'src', 'locales', 'en');
  mkdirSync(localesDir, { recursive: true });
  writeFileSync(
    join(localesDir, 'meta.json'),
    JSON.stringify({
      title: 'Site Title',
      description: 'Site description',
      ogTitle: 'Site Title',
      keywords: 'kw',
      routes: {
        '/upload': { title: 'Upload Title', description: 'Upload description' },
        [INTENT_PATHS[0]]: { title: 'Intent Title', description: 'Intent description' },
      },
    })
  );

  const manifestDir = join(fixtureRoot, 'dist', '.vite');
  mkdirSync(manifestDir, { recursive: true });
  const manifest: Record<string, { file: string }> = {};
  for (const ns of I18N_NAMESPACES) {
    manifest[`src/locales/en/${ns}.json`] = { file: `assets/${ns}-fake.js` };
  }
  writeFileSync(join(manifestDir, 'manifest.json'), JSON.stringify(manifest));
}

writeFixture();
afterAll(() => rmSync(fixtureRoot, { recursive: true, force: true }));

const BASE_HTML =
  '<!doctype html><html lang="en"><head><title>x</title></head><body></body></html>';

describe('injectLocalizedMeta (fixture, always runs)', () => {
  it('suppresses hreflang and og:locale:alternate for an intent path', async () => {
    const html = await injectLocalizedMeta(INTENT_PATHS[0], BASE_HTML, fixtureRoot);

    expect(html).not.toContain('hreflang=');
    expect(html).not.toContain('og:locale:alternate');
  });

  it('still emits the full set on a normal route — the control', async () => {
    const html = await injectLocalizedMeta('/upload', BASE_HTML, fixtureRoot);

    expect(html).toContain('hreflang="de"');
    expect(html).toContain('hreflang="x-default"');
    expect(html).toContain('og:locale:alternate');
  });

  it('canonicalises an intent path to itself, without a query string', async () => {
    const html = await injectLocalizedMeta(INTENT_PATHS[0], BASE_HTML, fixtureRoot);

    expect(html).toContain(
      `<link rel="canonical" href="https://safeunfollow.app${INTENT_PATHS[0]}"/>`
    );
  });
});

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

      it('should carry its own body text in the prerendered HTML', () => {
        // Asserted before indexing: a missing entry (task 4 has not run yet) must fail this
        // assertion, not throw a TypeError that reports as a crash rather than a red test.
        expect(INTENT_CONTENT[page.slug]).toBeDefined();
        const body = html();
        for (const section of INTENT_CONTENT[page.slug].sections) {
          expect(body).toContain(section.heading);
        }
        expect(body).toContain(INTENT_CONTENT[page.slug].ctaLabel);
      });

      it('should carry the CTA href before hydration', () => {
        expect(html()).toContain(`href="/upload?filter=${page.badge}&amp;from=${page.slug}"`);
      });

      it('should label the demo before hydration', () => {
        expect(html()).toContain('Sample data');
      });

      it('should prerender the demo rows', () => {
        for (const username of INTENT_DEMO[page.slug].usernames) {
          expect(html()).toContain(username);
        }
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

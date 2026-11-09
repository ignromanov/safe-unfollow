import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';
import { renderWithRouter } from '../test-utils';
import { OrganizationSchema } from '@/components/OrganizationSchema';
import { SUPPORTED_LANGUAGES } from '@/config/languages';
import { INTENT_PATHS } from '@/config/intent-pages';

import pkg from '../../../package.json';

/**
 * The entity graph: Organization, its founder (Person), and — on the home pages only — the
 * WebSite and the SoftwareApplication, all in one `@graph` and linked by `@id`.
 *
 * Rewritten 2026-11-09 for v1.7.0 (`.claude/plans/2026-11-09-seo-aeo-geo/plan/01-entity-schema.md`).
 * The previous file asserted two separate script tags by index (`scripts[0]`, `scripts[1]`) and
 * pinned the home-only guard route by route; both shapes are gone, so every case reads nodes by
 * `@type` out of the one graph instead of by position.
 */

const BASE = 'https://safeunfollow.app';
const ORGANIZATION_ID = `${BASE}/#organization`;
const FOUNDER_ID = `${BASE}/#founder`;
const SOFTWARE_ID = `${BASE}/#software`;
const WEBSITE_ID = `${BASE}/#website`;

type Node = Record<string, unknown> & { '@type': string; '@id': string };

function scriptsAt(path: string): NodeListOf<HTMLScriptElement> {
  const { container } = renderWithRouter(<OrganizationSchema />, { initialEntries: [path] });
  return container.querySelectorAll('script[type="application/ld+json"]');
}

function graphAt(path: string): Node[] {
  const scripts = scriptsAt(path);
  if (scripts.length === 0) return [];
  expect(scripts, `${path}: the graph must be one script, not several`).toHaveLength(1);
  const parsed = JSON.parse(scripts[0].textContent!) as { '@context': string; '@graph': Node[] };
  expect(parsed['@context']).toBe('https://schema.org');
  return parsed['@graph'];
}

function node(graph: Node[], type: string): Node {
  const found = graph.filter(n => n['@type'] === type);
  expect(found, `expected exactly one ${type} node`).toHaveLength(1);
  return found[0];
}

const types = (path: string) => graphAt(path).map(n => n['@type']);

const LOCALE_HOMES = SUPPORTED_LANGUAGES.filter(l => l !== 'en').flatMap(l => [`/${l}`, `/${l}/`]);
const NOINDEXED = SUPPORTED_LANGUAGES.flatMap(l =>
  ['results', 'sample'].map(p => (l === 'en' ? `/${p}` : `/${l}/${p}`))
);

/** `date-released` from CITATION.cff — the one place the release date is written. */
const CITATION_DATE = /^date-released:\s*'?(\d{4}-\d{2}-\d{2})'?\s*$/m.exec(
  readFileSync(join(process.cwd(), 'CITATION.cff'), 'utf-8')
)?.[1];

describe('OrganizationSchema', () => {
  describe('placement', () => {
    it('emits the full graph on / and on every locale home', () => {
      for (const path of ['/', ...LOCALE_HOMES]) {
        expect(types(path), path).toEqual([
          'Organization',
          'Person',
          'WebSite',
          'SoftwareApplication',
        ]);
      }
    });

    it('/upload and the intent pages carry the Organization and Person nodes', () => {
      for (const path of ['/upload', '/es/upload', '/privacy', '/terms', ...INTENT_PATHS]) {
        expect(types(path), path).toEqual(['Organization', 'Person']);
      }
    });

    it('/results and /sample carry no node, in every locale', () => {
      for (const path of NOINDEXED) {
        expect(scriptsAt(path), path).toHaveLength(0);
        expect(scriptsAt(`${path}/`), `${path}/`).toHaveLength(0);
      }
    });

    it('an intent slug is not mistaken for a locale home', () => {
      // `/^\/[a-z]{2}\/?$/` was the old home test; derive the prefix from SUPPORTED_LANGUAGES so
      // a two-letter path that is not a locale gets the inner-page graph.
      expect(types('/xx')).toEqual(['Organization', 'Person']);
    });
  });

  describe('Organization', () => {
    const org = () => node(graphAt('/'), 'Organization');

    it('is the one organisation, named SafeUnfollow', () => {
      expect(org()['@id']).toBe(ORGANIZATION_ID);
      expect(org().name).toBe('SafeUnfollow');
      expect(org().url).toBe(BASE);
      expect(org().logo).toBe(`${BASE}/logo.svg`);
      expect(org().alternateName).toEqual(['SafeUnfollow.app', 'Instagram Unfollow Tracker']);
    });

    it('lists the five sameAs URLs and no zenodo /records/ URL', () => {
      // Written out rather than imported: this pins the claim the page publishes.
      expect(org().sameAs).toEqual([
        'https://github.com/ignromanov/safe-unfollow',
        'https://www.crunchbase.com/organization/safeunfollow',
        'https://www.producthunt.com/products/instagram-unfollow-tracker',
        'https://doi.org/10.5281/zenodo.22663615',
        'https://www.instagram.com/safeunfollow',
      ]);
      // The concept DOI lands on the version record; pasting what the browser shows pins one
      // release and is falsified by the next. Checked across the whole graph, every route.
      for (const path of ['/', '/upload']) {
        const text = JSON.stringify(graphAt(path));
        expect(text).not.toMatch(/zenodo\.org\/records\//);
        expect(text).not.toContain('10.5281/zenodo.22663616');
      }
    });

    it('answers "what is SafeUnfollow" with a product, not a category', () => {
      // Class, not wording: the field read "Privacy-first tools for social media data analysis"
      // until 2026-09-07 — no product, no platform, no domain.
      const description = org().description as string;
      expect(description).toMatch(/instagram/i);
      expect(description).toMatch(/unfollow/i);
      expect(description).toMatch(/browser/i);
    });

    it('the description gate goes red on a category-only sentence', () => {
      const superseded =
        'Privacy-first tools for social media data analysis. All processing happens locally in your browser.';
      expect([/instagram/i, /unfollow/i].every(p => p.test(superseded))).toBe(false);
    });
  });

  describe('Person', () => {
    it('carries the founder values verbatim', () => {
      expect(node(graphAt('/upload'), 'Person')).toEqual({
        '@type': 'Person',
        '@id': FOUNDER_ID,
        name: 'Ignat Romanov',
        url: 'https://lasipan.cc/',
        jobTitle: 'Builder & Web3 Frontend Engineer',
        description:
          'Builder & Web3 Frontend Engineer — crafting privacy-first tools for the decentralized economy.',
        sameAs: [
          'https://github.com/ignromanov',
          'https://lasipan.cc/',
          'https://www.linkedin.com/in/ignat-romanov',
          'https://x.com/romignov',
        ],
      });
    });
  });

  describe('WebSite', () => {
    it('names the site SafeUnfollow and carries no SearchAction', () => {
      expect(node(graphAt('/'), 'WebSite')).toEqual({
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        name: 'SafeUnfollow',
        alternateName: ['SafeUnfollow.app', 'safeunfollow.app'],
        url: `${BASE}/`,
        publisher: { '@id': ORGANIZATION_ID },
      });
    });
  });

  describe('SoftwareApplication', () => {
    const app = () => node(graphAt('/'), 'SoftwareApplication');

    it('names the application SafeUnfollow and carries the disambiguating description', () => {
      expect(app()['@id']).toBe(SOFTWARE_ID);
      expect(app().name).toBe('SafeUnfollow');
      expect(app().alternateName).toEqual(['SafeUnfollow.app', 'Instagram Unfollow Tracker']);
      const disambiguation = app().disambiguatingDescription as string;
      expect(disambiguation.startsWith('SafeUnfollow is the web app at safeunfollow.app.')).toBe(
        true
      );
      expect(disambiguation).toMatch(/never acts inside your Instagram account/);
      // The Organization states the same sentence; one entity, one disambiguation.
      expect(node(graphAt('/'), 'Organization').disambiguatingDescription).toBe(disambiguation);
    });

    it('links founder, author, publisher by @id only', () => {
      const graph = graphAt('/');
      expect(node(graph, 'Organization').founder).toEqual({ '@id': FOUNDER_ID });
      expect(app().author).toEqual({ '@id': FOUNDER_ID });
      expect(app().publisher).toEqual({ '@id': ORGANIZATION_ID });
      expect(app().provider).toEqual({ '@id': ORGANIZATION_ID });
      // One node per @id across the whole graph — a second inline copy would split the entity.
      const ids = graph.map(n => n['@id']);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('dateModified equals CITATION.cff date-released', () => {
      expect(CITATION_DATE, 'CITATION.cff has no date-released').toBeTruthy();
      expect(app().dateModified).toBe(CITATION_DATE);
    });

    it('states the package.json version and every served locale', () => {
      expect(app().softwareVersion).toBe(pkg.version);
      expect(app().inLanguage).toEqual([...SUPPORTED_LANGUAGES]);
    });

    it('carries the concept DOI as a PropertyValue identifier', () => {
      expect(app().identifier).toEqual({
        '@type': 'PropertyValue',
        propertyID: 'DOI',
        value: '10.5281/zenodo.22663615',
      });
    });

    it('keeps the free offer, the licence and the first-publication date', () => {
      expect(app().offers).toEqual({ '@type': 'Offer', price: '0', priceCurrency: 'USD' });
      expect(app().isAccessibleForFree).toBe(true);
      expect(app().license).toBe('https://opensource.org/licenses/MIT');
      expect(app().datePublished).toBe('2025-11-22');
    });
  });
});

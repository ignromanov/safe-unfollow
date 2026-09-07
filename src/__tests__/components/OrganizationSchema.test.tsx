import { describe, it, expect } from 'vitest';
import { renderWithRouter } from '../test-utils';
import { OrganizationSchema } from '@/components/OrganizationSchema';
import { SUPPORTED_LANGUAGES } from '@/config/languages';

import pkg from '../../../package.json';

/**
 * One JSON-LD read, shared by the assertions below.
 *
 * `scripts[0]` is the Organization node, `scripts[1]` the SoftwareApplication — the component
 * emits exactly two, which `rendering` above pins.
 */
function readSchemas(): { organization: OrgNode; software: AppNode } {
  const { container } = renderWithRouter(<OrganizationSchema />, { initialEntries: ['/'] });
  const scripts = container.querySelectorAll('script[type="application/ld+json"]');
  return {
    organization: JSON.parse(scripts[0].textContent!) as OrgNode,
    software: JSON.parse(scripts[1].textContent!) as AppNode,
  };
}

type OrgRef = { '@type': string; '@id': string; name: string; url: string };
type OrgNode = OrgRef & { description: string; disambiguatingDescription: string };
type AppNode = {
  '@id': string;
  softwareVersion: string;
  inLanguage: string[];
  author: OrgRef;
  provider: OrgRef;
  publisher: OrgRef;
};

describe('OrganizationSchema', () => {
  describe('rendering', () => {
    it('should render without crashing on home page', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      expect(scripts.length).toBe(2); // Organization + SoftwareApplication
    });

    it('should render two script tags on home page', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      expect(scripts).toHaveLength(2);
    });

    it('should not render on non-home pages', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/sample'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      expect(scripts.length).toBe(0);
    });

    it('should not render on /upload page', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/upload'],
      });

      expect(container.querySelector('script')).not.toBeInTheDocument();
    });

    it('should not render on /results page', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/results'],
      });

      expect(container.querySelector('script')).not.toBeInTheDocument();
    });

    it('should not render on /privacy page', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/privacy'],
      });

      expect(container.querySelector('script')).not.toBeInTheDocument();
    });
  });

  describe('language-prefixed home pages', () => {
    it('should render on English home page /', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      expect(scripts.length).toBe(2);
    });

    it('should render on Spanish home page /es', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/es'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      expect(scripts.length).toBe(2);
    });

    it('should render on Spanish home page /es/', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/es/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      expect(scripts.length).toBe(2);
    });

    it('should render on Russian home page /ru', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/ru'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      expect(scripts.length).toBe(2);
    });

    it('should render on Portuguese home page /pt/', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/pt/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      expect(scripts.length).toBe(2);
    });

    it('should render on German home page /de', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/de'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      expect(scripts.length).toBe(2);
    });

    it('should render on Japanese home page /ja/', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/ja/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      expect(scripts.length).toBe(2);
    });

    it('should not render on language-prefixed non-home pages', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/es/sample'],
      });

      expect(container.querySelector('script')).not.toBeInTheDocument();
    });
  });

  describe('Organization schema', () => {
    it('should have valid Organization schema structure', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const organizationSchema = JSON.parse(scripts[0].textContent!);

      expect(organizationSchema['@context']).toBe('https://schema.org');
      expect(organizationSchema['@type']).toBe('Organization');
    });

    it('should include organization name', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const organizationSchema = JSON.parse(scripts[0].textContent!);

      expect(organizationSchema.name).toBe('SafeUnfollow');
    });

    it('should include organization URL', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const organizationSchema = JSON.parse(scripts[0].textContent!);

      expect(organizationSchema.url).toBe('https://safeunfollow.app');
    });

    it('should include organization logo', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const organizationSchema = JSON.parse(scripts[0].textContent!);

      expect(organizationSchema.logo).toBe('https://safeunfollow.app/logo.svg');
    });

    it('should include sameAs with GitHub URL', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const organizationSchema = JSON.parse(scripts[0].textContent!);

      expect(organizationSchema.sameAs).toEqual(['https://github.com/ignromanov/safe-unfollow']);
    });

    it('should include organization description', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const organizationSchema = JSON.parse(scripts[0].textContent!);

      // Not pinned to a literal, deliberately. Copy changes; what must not change is that this
      // field answers "what is SafeUnfollow" with a product rather than a category. It read
      // "Privacy-first tools for social media data analysis. All processing happens locally in
      // your browser." until 2026-09-07 — a sentence naming no product, no platform and no
      // domain, on the field a name match lands on first. Same shape as PR #203/#204: guard the
      // class, never the wording.
      const description = organizationSchema.description;
      expect(description).toMatch(/instagram/i);
      expect(description).toMatch(/unfollow/i);
      expect(description).toMatch(/browser/i);
    });

    /** The control: the sentence this gate exists to reject must actually fail it. */
    it('the description gate goes red on a category-only sentence', () => {
      const superseded =
        'Privacy-first tools for social media data analysis. All processing happens locally in your browser.';
      expect(
        [/instagram/i, /unfollow/i].every(pattern => pattern.test(superseded)),
        'the superseded description would still pass — the gate is not testing its own subject'
      ).toBe(false);
    });

    it('names one organization, not three', () => {
      const { organization, software } = readSchemas();

      // Before 2026-09-07 the file minted three anonymous `Organization` nodes — the standalone
      // one, `author` and `provider` — none of which a graph consumer could merge. This is the
      // assertion that keeps them one node; a fourth reference added without the shared `@id`
      // fails here rather than silently splitting the entity again.
      const expectedId = 'https://safeunfollow.app/#organization';
      expect(organization['@id']).toBe(expectedId);
      for (const [role, ref] of [
        ['author', software.author],
        ['provider', software.provider],
        ['publisher', software.publisher],
      ] as const) {
        expect(ref['@id'], `${role} does not carry the shared Organization @id`).toBe(expectedId);
        // Written out in full as well as identified: a consumer that does not resolve `@id`
        // must still receive a usable node. See the component's comment on publisherRef.
        expect(ref['@type'], `${role} is not typed`).toBe('Organization');
        expect(ref.name, `${role} has no name`).toBe('SafeUnfollow');
      }
      expect(software['@id']).toBe('https://safeunfollow.app/#app');
    });

    it('states what this entity is not', () => {
      const { organization } = readSchemas();

      // A separately published Chrome extension shares this name and automates unfollowing
      // inside a live Instagram session; the citation baseline of 2026-09-07 measured three of
      // five AI engines attributing that behaviour to us. `disambiguatingDescription` is
      // schema.org's own field for exactly this and was unused.
      const disambiguation = organization.disambiguatingDescription;
      expect(disambiguation, 'no disambiguatingDescription is published').toBeTruthy();
      expect(disambiguation).toMatch(/safeunfollow\.app/);
      expect(disambiguation).toMatch(/not a browser extension/i);
    });

    it('carries the product name as an alternate name', () => {
      const { organization } = readSchemas();
      expect((organization as unknown as { alternateName: string }).alternateName).toBe(
        'Instagram Unfollow Tracker'
      );
    });
  });

  describe('SoftwareApplication schema', () => {
    it('should have valid SoftwareApplication schema structure', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const softwareSchema = JSON.parse(scripts[1].textContent!);

      expect(softwareSchema['@context']).toBe('https://schema.org');
      expect(softwareSchema['@type']).toBe('SoftwareApplication');
    });

    it('should include application name', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const softwareSchema = JSON.parse(scripts[1].textContent!);

      expect(softwareSchema.name).toBe('Instagram Unfollow Tracker');
    });

    it('should include alternate name', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const softwareSchema = JSON.parse(scripts[1].textContent!);

      expect(softwareSchema.alternateName).toBe('SafeUnfollow');
    });

    it('should include application category', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const softwareSchema = JSON.parse(scripts[1].textContent!);

      expect(softwareSchema.applicationCategory).toBe('UtilityApplication');
      expect(softwareSchema.applicationSubCategory).toBe('Privacy Tool');
    });

    it('should include operating system', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const softwareSchema = JSON.parse(scripts[1].textContent!);

      expect(softwareSchema.operatingSystem).toBe('Web Browser');
    });

    it('should include software version', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const softwareSchema = JSON.parse(scripts[1].textContent!);

      // Derived, not typed. This assertion read `'1.5.0'` while package.json said `1.6.0`, so
      // the gate held the drift in place instead of catching it — the class `progress.md`
      // records five times over. `__PKG_VERSION__` is defined from package.json in both
      // vite.config.ts and vitest.config.ts.
      expect(softwareSchema.softwareVersion).toBe(pkg.version);
    });

    it('declares every locale the app actually serves', () => {
      const { software } = readSchemas();

      // Derived from the same constant the router and the locale bundles use, so a language
      // added or retired cannot leave a stale list in machine-readable form. `hi` was retired
      // 2026-08-08; a hand-typed array here would still be advertising it.
      expect(software.inLanguage).toEqual([...SUPPORTED_LANGUAGES]);
      expect(software.inLanguage).not.toContain('hi');
    });

    it('should include date published', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const softwareSchema = JSON.parse(scripts[1].textContent!);

      expect(softwareSchema.datePublished).toBe('2025-11-22');
    });

    it('should include MIT license', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const softwareSchema = JSON.parse(scripts[1].textContent!);

      expect(softwareSchema.license).toBe('https://opensource.org/licenses/MIT');
    });

    it('should indicate free access', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const softwareSchema = JSON.parse(scripts[1].textContent!);

      expect(softwareSchema.isAccessibleForFree).toBe(true);
    });

    it('should include free offer with $0 price', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const softwareSchema = JSON.parse(scripts[1].textContent!);

      expect(softwareSchema.offers).toEqual({
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      });
    });

    it('should include author information', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const softwareSchema = JSON.parse(scripts[1].textContent!);

      expect(softwareSchema.author).toEqual({
        '@type': 'Organization',
        '@id': 'https://safeunfollow.app/#organization',
        name: 'SafeUnfollow',
        url: 'https://safeunfollow.app',
      });
    });

    it('should include provider information', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const softwareSchema = JSON.parse(scripts[1].textContent!);

      expect(softwareSchema.provider).toEqual({
        '@type': 'Organization',
        '@id': 'https://safeunfollow.app/#organization',
        name: 'SafeUnfollow',
        url: 'https://safeunfollow.app',
      });
    });

    it('should include screenshot URL', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const softwareSchema = JSON.parse(scripts[1].textContent!);

      expect(softwareSchema.screenshot).toBe('https://safeunfollow.app/og-image.png');
    });

    it('should include URL and downloadUrl', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const softwareSchema = JSON.parse(scripts[1].textContent!);

      expect(softwareSchema.url).toBe('https://safeunfollow.app');
      expect(softwareSchema.downloadUrl).toBe('https://safeunfollow.app');
    });
  });

  describe('feature list', () => {
    it('should include comprehensive feature list', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const softwareSchema = JSON.parse(scripts[1].textContent!);

      expect(softwareSchema.featureList).toHaveLength(7);
    });

    it('should include key privacy feature', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const softwareSchema = JSON.parse(scripts[1].textContent!);

      expect(softwareSchema.featureList).toContain(
        '100% local processing - data never leaves your device'
      );
    });

    it('should include no login feature', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const softwareSchema = JSON.parse(scripts[1].textContent!);

      expect(softwareSchema.featureList).toContain('No login or password required');
    });

    it('should include scale feature', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const softwareSchema = JSON.parse(scripts[1].textContent!);

      expect(softwareSchema.featureList).toContain('Analyze up to 1,000,000+ accounts');
    });

    it('should include open source feature', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const softwareSchema = JSON.parse(scripts[1].textContent!);

      expect(softwareSchema.featureList).toContain('Free and open-source (MIT license)');
    });
  });

  describe('keywords', () => {
    it('should include SEO keywords', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const softwareSchema = JSON.parse(scripts[1].textContent!);

      expect(softwareSchema.keywords).toContain('instagram unfollow tracker');
      expect(softwareSchema.keywords).toContain('who unfollowed me on instagram');
      expect(softwareSchema.keywords).toContain('instagram unfollowers');
    });

    it('should include data export keyword', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const softwareSchema = JSON.parse(scripts[1].textContent!);

      expect(softwareSchema.keywords).toContain('instagram data export analyzer');
    });
  });

  describe('schema validation', () => {
    it('should produce valid JSON for both schemas', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');

      // Should not throw when parsing
      expect(() => JSON.parse(scripts[0].textContent!)).not.toThrow();
      expect(() => JSON.parse(scripts[1].textContent!)).not.toThrow();
    });

    it('should have all required Organization properties', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const organizationSchema = JSON.parse(scripts[0].textContent!);

      expect(organizationSchema).toHaveProperty('@context');
      expect(organizationSchema).toHaveProperty('@type');
      expect(organizationSchema).toHaveProperty('name');
      expect(organizationSchema).toHaveProperty('url');
    });

    it('should have all required SoftwareApplication properties', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const softwareSchema = JSON.parse(scripts[1].textContent!);

      expect(softwareSchema).toHaveProperty('@context');
      expect(softwareSchema).toHaveProperty('@type');
      expect(softwareSchema).toHaveProperty('name');
      expect(softwareSchema).toHaveProperty('url');
      expect(softwareSchema).toHaveProperty('applicationCategory');
      expect(softwareSchema).toHaveProperty('operatingSystem');
    });
  });

  describe('edge cases', () => {
    it('should handle trailing slash on home page', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      expect(scripts.length).toBe(2);
    });

    it('should not render on nested routes', () => {
      // Two segments, so the name stays honest and this stops duplicating
      // 'should not render on /upload page' above. It read '/wizard/step-1'
      // until GH#102 — a hyphen, which was never a route; the fixture only
      // ever needed to be "not home".
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/id/upload'],
      });

      expect(container.querySelector('script')).not.toBeInTheDocument();
    });

    it('should render only once on home page (no duplicates)', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      expect(scripts.length).toBe(2); // Exactly 2, no more
    });
  });
});

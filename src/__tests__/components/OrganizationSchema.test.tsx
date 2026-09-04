import { describe, it, expect } from 'vitest';
import { renderWithRouter } from '../test-utils';
import { OrganizationSchema } from '@/components/OrganizationSchema';

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

      expect(organizationSchema.description).toBe(
        'Privacy-first tools for social media data analysis. All processing happens locally in your browser.'
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

      expect(softwareSchema.softwareVersion).toBe('1.5.0');
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

      expect(softwareSchema.featureList).toHaveLength(8);
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

    it('should include performance feature', () => {
      const { container } = renderWithRouter(<OrganizationSchema />, {
        initialEntries: ['/'],
      });

      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      const softwareSchema = JSON.parse(scripts[1].textContent!);

      expect(softwareSchema.featureList).toContain('Sub-5ms filtering performance');
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

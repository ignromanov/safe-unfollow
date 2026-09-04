import { describe, it, expect } from 'vitest';
import { renderWithRouter } from '../test-utils';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';

describe('BreadcrumbSchema', () => {
  describe('rendering', () => {
    it('should render without crashing on home page', () => {
      const { container } = renderWithRouter(<BreadcrumbSchema />, {
        initialEntries: ['/'],
      });

      // Should not render on home page (single item breadcrumb not useful)
      const script = container.querySelector('script[type="application/ld+json"]');
      expect(script).not.toBeInTheDocument();
    });

    it('should render script tag with JSON-LD on non-home pages', () => {
      const { container } = renderWithRouter(<BreadcrumbSchema />, {
        initialEntries: ['/sample'],
      });

      const script = container.querySelector('script[type="application/ld+json"]');
      expect(script).toBeInTheDocument();
      expect(script).toHaveAttribute('type', 'application/ld+json');
    });

    it('should not render on home page (returns null)', () => {
      const { container } = renderWithRouter(<BreadcrumbSchema />, {
        initialEntries: ['/'],
      });

      expect(container.querySelector('script')).not.toBeInTheDocument();
    });
  });

  describe('breadcrumb structure', () => {
    it('should generate valid BreadcrumbList schema for /sample', () => {
      const { container } = renderWithRouter(<BreadcrumbSchema />, {
        initialEntries: ['/sample'],
      });

      const script = container.querySelector('script[type="application/ld+json"]');
      expect(script).toBeInTheDocument();

      const schema = JSON.parse(script!.textContent!);

      expect(schema['@context']).toBe('https://schema.org');
      expect(schema['@type']).toBe('BreadcrumbList');
      expect(schema.itemListElement).toHaveLength(2);
    });

    it('should include Home as first item in breadcrumb', () => {
      const { container } = renderWithRouter(<BreadcrumbSchema />, {
        initialEntries: ['/upload'],
      });

      const script = container.querySelector('script[type="application/ld+json"]');
      const schema = JSON.parse(script!.textContent!);

      expect(schema.itemListElement[0]).toEqual({
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://safeunfollow.app/',
      });
    });

    it('should include correct page name for /sample', () => {
      const { container } = renderWithRouter(<BreadcrumbSchema />, {
        initialEntries: ['/sample'],
      });

      const script = container.querySelector('script[type="application/ld+json"]');
      const schema = JSON.parse(script!.textContent!);

      expect(schema.itemListElement[1]).toEqual({
        '@type': 'ListItem',
        position: 2,
        name: 'Sample',
        item: 'https://safeunfollow.app/sample',
      });
    });

    it('should include correct page name for /upload', () => {
      const { container } = renderWithRouter(<BreadcrumbSchema />, {
        initialEntries: ['/upload'],
      });

      const script = container.querySelector('script[type="application/ld+json"]');
      const schema = JSON.parse(script!.textContent!);

      expect(schema.itemListElement[1].name).toBe('Upload');
      expect(schema.itemListElement[1].item).toBe('https://safeunfollow.app/upload');
    });

    it('should include correct page name for /results', () => {
      const { container } = renderWithRouter(<BreadcrumbSchema />, {
        initialEntries: ['/results'],
      });

      const script = container.querySelector('script[type="application/ld+json"]');
      const schema = JSON.parse(script!.textContent!);

      expect(schema.itemListElement[1].name).toBe('Results');
    });

    it('should include correct page name for /sample', () => {
      const { container } = renderWithRouter(<BreadcrumbSchema />, {
        initialEntries: ['/sample'],
      });

      const script = container.querySelector('script[type="application/ld+json"]');
      const schema = JSON.parse(script!.textContent!);

      expect(schema.itemListElement[1].name).toBe('Sample');
    });

    it('should include correct page name for /privacy', () => {
      const { container } = renderWithRouter(<BreadcrumbSchema />, {
        initialEntries: ['/privacy'],
      });

      const script = container.querySelector('script[type="application/ld+json"]');
      const schema = JSON.parse(script!.textContent!);

      expect(schema.itemListElement[1].name).toBe('Privacy Policy');
    });

    it('should include correct page name for /terms', () => {
      const { container } = renderWithRouter(<BreadcrumbSchema />, {
        initialEntries: ['/terms'],
      });

      const script = container.querySelector('script[type="application/ld+json"]');
      const schema = JSON.parse(script!.textContent!);

      expect(schema.itemListElement[1].name).toBe('Terms of Service');
    });
  });

  describe('language prefix handling', () => {
    it('should strip language prefix from Spanish route /es/sample', () => {
      const { container } = renderWithRouter(<BreadcrumbSchema />, {
        initialEntries: ['/es/sample'],
      });

      const script = container.querySelector('script[type="application/ld+json"]');
      const schema = JSON.parse(script!.textContent!);

      // Should map to English base path /sample
      expect(schema.itemListElement[1].name).toBe('Sample');
      expect(schema.itemListElement[1].item).toBe('https://safeunfollow.app/sample');
    });

    it('should strip language prefix from Russian route /ru/upload', () => {
      const { container } = renderWithRouter(<BreadcrumbSchema />, {
        initialEntries: ['/ru/upload'],
      });

      const script = container.querySelector('script[type="application/ld+json"]');
      const schema = JSON.parse(script!.textContent!);

      expect(schema.itemListElement[1].name).toBe('Upload');
      expect(schema.itemListElement[1].item).toBe('https://safeunfollow.app/upload');
    });

    it('should strip language prefix from Portuguese route /pt/results', () => {
      const { container } = renderWithRouter(<BreadcrumbSchema />, {
        initialEntries: ['/pt/results'],
      });

      const script = container.querySelector('script[type="application/ld+json"]');
      const schema = JSON.parse(script!.textContent!);

      expect(schema.itemListElement[1].name).toBe('Results');
    });

    it('should handle language-prefixed home page /es/', () => {
      const { container } = renderWithRouter(<BreadcrumbSchema />, {
        initialEntries: ['/es/'],
      });

      // Should not render (home page with language prefix is still home)
      const script = container.querySelector('script[type="application/ld+json"]');
      expect(script).not.toBeInTheDocument();
    });

    it('should handle language-prefixed home page /ru', () => {
      const { container } = renderWithRouter(<BreadcrumbSchema />, {
        initialEntries: ['/ru'],
      });

      // Should not render (home page)
      const script = container.querySelector('script[type="application/ld+json"]');
      expect(script).not.toBeInTheDocument();
    });

    it('should strip language prefix from German route /de/privacy', () => {
      const { container } = renderWithRouter(<BreadcrumbSchema />, {
        initialEntries: ['/de/privacy'],
      });

      const script = container.querySelector('script[type="application/ld+json"]');
      const schema = JSON.parse(script!.textContent!);

      expect(schema.itemListElement[1].name).toBe('Privacy Policy');
    });

    it('should strip language prefix from Japanese route /ja/terms', () => {
      const { container } = renderWithRouter(<BreadcrumbSchema />, {
        initialEntries: ['/ja/terms'],
      });

      const script = container.querySelector('script[type="application/ld+json"]');
      const schema = JSON.parse(script!.textContent!);

      expect(schema.itemListElement[1].name).toBe('Terms of Service');
    });
  });

  describe('edge cases', () => {
    it('should return null for unknown routes', () => {
      const { container } = renderWithRouter(<BreadcrumbSchema />, {
        initialEntries: ['/unknown-page'],
      });

      // Unknown route should not render breadcrumb
      const script = container.querySelector('script[type="application/ld+json"]');
      expect(script).not.toBeInTheDocument();
    });

    it('should have correct position values for breadcrumb items', () => {
      const { container } = renderWithRouter(<BreadcrumbSchema />, {
        initialEntries: ['/sample'],
      });

      const script = container.querySelector('script[type="application/ld+json"]');
      const schema = JSON.parse(script!.textContent!);

      // Position should be 1-indexed
      expect(schema.itemListElement[0].position).toBe(1);
      expect(schema.itemListElement[1].position).toBe(2);
    });

    it('should use correct base URL for all items', () => {
      const { container } = renderWithRouter(<BreadcrumbSchema />, {
        initialEntries: ['/upload'],
      });

      const script = container.querySelector('script[type="application/ld+json"]');
      const schema = JSON.parse(script!.textContent!);

      schema.itemListElement.forEach((item: { item: string }) => {
        expect(item.item).toMatch(/^https:\/\/safeunfollow\.app/);
      });
    });

    it('should have ListItem type for all breadcrumb items', () => {
      const { container } = renderWithRouter(<BreadcrumbSchema />, {
        initialEntries: ['/results'],
      });

      const script = container.querySelector('script[type="application/ld+json"]');
      const schema = JSON.parse(script!.textContent!);

      schema.itemListElement.forEach((item: { '@type': string }) => {
        expect(item['@type']).toBe('ListItem');
      });
    });
  });

  describe('schema validation', () => {
    it('should have all required BreadcrumbList properties', () => {
      const { container } = renderWithRouter(<BreadcrumbSchema />, {
        initialEntries: ['/sample'],
      });

      const script = container.querySelector('script[type="application/ld+json"]');
      const schema = JSON.parse(script!.textContent!);

      expect(schema).toHaveProperty('@context');
      expect(schema).toHaveProperty('@type');
      expect(schema).toHaveProperty('itemListElement');
    });

    it('should have all required ListItem properties', () => {
      const { container } = renderWithRouter(<BreadcrumbSchema />, {
        initialEntries: ['/upload'],
      });

      const script = container.querySelector('script[type="application/ld+json"]');
      const schema = JSON.parse(script!.textContent!);

      schema.itemListElement.forEach(
        (item: { '@type': string; position: number; name: string; item: string }) => {
          expect(item).toHaveProperty('@type');
          expect(item).toHaveProperty('position');
          expect(item).toHaveProperty('name');
          expect(item).toHaveProperty('item');
        }
      );
    });

    it('should produce valid JSON output', () => {
      const { container } = renderWithRouter(<BreadcrumbSchema />, {
        initialEntries: ['/privacy'],
      });

      const script = container.querySelector('script[type="application/ld+json"]');

      // Should not throw when parsing
      expect(() => JSON.parse(script!.textContent!)).not.toThrow();
    });
  });
});

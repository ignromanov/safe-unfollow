import { SUPPORTED_LANGUAGES } from '@/locales';
import { routes } from '@/routes';
import { describe, expect, it } from 'vitest';

describe('Routes Configuration', () => {
  it('should define the root route', () => {
    const rootRoute = routes.find(r => r.path === '/');
    expect(rootRoute).toBeDefined();
    expect(rootRoute?.entry).toBe('src/components/Layout.tsx');
  });

  it('should define all main pages in the root route', () => {
    const rootRoute = routes.find(r => r.path === '/');
    const children = rootRoute?.children || [];

    const paths = children.map(c => c.path || (c.index ? 'index' : ''));

    expect(paths).toContain('index'); // Home
    expect(paths).toContain('upload');
    expect(paths).toContain('results');
    expect(paths).toContain('sample');
    expect(paths).toContain('privacy');
    expect(paths).toContain('terms');
  });

  it('should define language-prefixed routes for all non-English languages', () => {
    const nonEnglishLangs = SUPPORTED_LANGUAGES.filter(l => l !== 'en');

    nonEnglishLangs.forEach(lang => {
      const langRoute = routes.find(r => r.path === `/${lang}`);
      expect(langRoute).toBeDefined();
      expect(langRoute?.entry).toBe('src/components/Layout.tsx');

      // Check children
      const children = langRoute?.children || [];
      const paths = children.map(c => c.path || (c.index ? 'index' : ''));

      expect(paths).toContain('index');
      expect(paths).toContain('upload');
      expect(paths).toContain('results');
      expect(paths).toContain('sample');
      expect(paths).toContain('privacy');
      expect(paths).toContain('terms');
    });
  });

  it('should not define a separate /en route (default is root)', () => {
    const enRoute = routes.find(r => r.path === '/en');
    expect(enRoute).toBeUndefined();
  });

  it('should have correct lazy loaders', () => {
    const rootRoute = routes.find(r => r.path === '/');
    const children = rootRoute?.children || [];

    children.forEach(child => {
      if (child.lazy) {
        expect(typeof child.lazy).toBe('function');
        // We can't easily execute it without mocking import, but existence is key
      }
    });
  });

  it('defines no wizard route in any language', () => {
    // `/wizard` and the eight `/wizard/step/N` deep links were the guide's own
    // pages until GH#102 made it a dialog on /upload. They are permanent
    // redirects in vercel.json now, and a route here would shadow one for
    // any reader already inside the SPA: React Router would answer the
    // navigation client-side and the redirect would never be requested.
    const wizardPaths = routes.flatMap(route =>
      (route.children || []).map(child => child.path).filter(path => path?.includes('wizard'))
    );

    expect(wizardPaths).toEqual([]);
  });
});

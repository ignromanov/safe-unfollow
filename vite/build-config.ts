import type { BuildOptions } from 'vite';

/**
 * One chunk per language instead of one per (language, namespace).
 *
 * loadLanguageResources.ts imports `./${lang}/${ns}.json` — two variables in the specifier,
 * which Vite expands to 80 chunks. A page loads eight of them (sixteen when it is not
 * English), measured 2026-09-14 at 16,695 bytes between them.
 */
function getLocaleChunk(id: string): string | undefined {
  const match = /[/\\]src[/\\]locales[/\\]([a-z-]+)[/\\][a-z]+\.json$/.exec(id);
  return match ? `locale-${match[1]}` : undefined;
}

/**
 * Helper: Check if module is a Radix core primitive
 */
function isRadixCorePrimitive(id: string): boolean {
  const corePatterns = [
    '@radix-ui/primitive',
    '@radix-ui/react-primitive',
    '@radix-ui/react-slot',
    '@radix-ui/react-compose-refs',
    '@radix-ui/react-context',
    '@radix-ui/react-id',
    '@radix-ui/react-use-',
    '@radix-ui/react-presence',
    '@radix-ui/react-portal',
    '@radix-ui/react-focus-',
    '@radix-ui/react-dismissable-layer',
    '@radix-ui/react-popper',
  ];
  return corePatterns.some(pattern => id.includes(pattern));
}

/**
 * Helper: Determine Radix UI chunk name
 */
function getRadixChunk(id: string): string | undefined {
  if (isRadixCorePrimitive(id)) return 'radix-core';

  // Measured 2026-09-15: folding these two removes two requests per page AND takes 184 bytes
  // off the entry chunk. They were modulepreloaded on every route, so their separate chunks
  // bought no cache granularity — we deploy ~11.5x/day and the hash changes anyway.
  if (id.includes('@radix-ui/react-dialog') || id.includes('@radix-ui/react-alert-dialog')) {
    return 'radix-core';
  }

  if (id.includes('@radix-ui/react-dropdown-menu') || id.includes('@radix-ui/react-menu')) {
    return 'radix-core';
  }

  if (id.includes('@radix-ui/react-accordion')) return 'radix-accordion';
  if (id.includes('@radix-ui/react-tabs')) return 'radix-tabs';
  if (id.includes('@radix-ui/react-collapsible')) return 'radix-accordion';

  if (id.includes('@radix-ui')) return 'radix-core';

  return undefined;
}

/**
 * Helper: Determine vendor chunk name
 */
function getVendorChunk(id: string): string | undefined {
  if (id.includes('lucide-react')) return 'icons';

  if (id.includes('zustand') || id.includes('clsx') || id.includes('tailwind-merge')) {
    return 'utils';
  }

  return undefined;
}

/**
 * Production build configuration with optimizations
 * - No source maps: see `sourcemap` below
 * - Terser minification with console.log removal
 * - Manual chunk splitting for optimal caching
 */
export const buildConfig: BuildOptions = {
  // No source maps in production: measured 2.71x the size of the code they map, ~20% of a
  // deployment, and /assets/*.js.map served publicly. `drop_console` means nothing consumes
  // them. Reopen this if an error reporter is ever wired up.
  sourcemap: false,
  // Optimize bundle size
  minify: 'terser',
  terserOptions: {
    compress: {
      drop_console: true, // Remove console.log in production
      drop_debugger: true, // Remove debugger statements
    },
  },
  // Prevent JS file generation during build
  emptyOutDir: true,
  // Rollup options for better tree shaking
  rollupOptions: {
    // Exclude test files from build
    external: id => {
      return id.includes('.test.') || id.includes('.spec.') || id.includes('__tests__');
    },
    output: {
      // Manual chunk splitting for better caching
      // Note: react/react-dom excluded - they're externalized during SSR build
      manualChunks: id => {
        const locale = getLocaleChunk(id);
        if (locale) return locale;

        if (!id.includes('node_modules')) return undefined;

        return getRadixChunk(id) ?? getVendorChunk(id);
      },
    },
  },
};

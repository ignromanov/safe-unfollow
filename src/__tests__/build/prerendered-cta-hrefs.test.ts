import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, it, expect } from 'vitest';

/**
 * useLanguagePrefix reads useLocation(), which during SSG resolves against the static
 * router. A regression there would emit English hrefs into every localized page with no
 * runtime symptom whatsoever — the site would still work, and every non-English visitor
 * would be silently dropped into the English funnel.
 */
const CASES = [
  { page: 'dist/index.html', href: '/wizard/step/1' },
  { page: 'dist/id.html', href: '/id/wizard/step/1' },
  { page: 'dist/ru.html', href: '/ru/wizard/step/1' },
  { page: 'dist/ar.html', href: '/ar/wizard/step/1' },
];

const root = resolve(__dirname, '../../..');
const built = CASES.every(c => existsSync(resolve(root, c.page)));

describe.runIf(built)('prerendered CTA hrefs', () => {
  it.each(CASES)('$page links the primary CTA to $href', ({ page, href }) => {
    expect(readFileSync(resolve(root, page), 'utf-8')).toContain(`href="${href}"`);
  });
});

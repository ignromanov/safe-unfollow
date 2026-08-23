import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Tally's `embed.js` pushes form-submission events into `window.dataLayer`
 * and calls `window.fbq(...)` when those already exist on the page — see
 * https://tally.so — guarded internally as `if (e.dataLayer !== void 0)` and
 * equivalent for `fbq`. It cannot create either: no script injection, no
 * fetch, just a conditional push into a global we would have had to define
 * first. So today, with neither defined anywhere in our own sources, the
 * bridge is inert — see PrivacyPolicy.tsx §5.6, which discloses only what
 * Tally receives directly (the form content, locale, page, version), not a
 * silent forward into Google Analytics or the Meta Pixel.
 *
 * This test is what keeps that true. The day someone adds a Google tag and
 * defines `window.dataLayer` (or a Meta Pixel and `window.fbq`), the bridge
 * stops being inert — Tally would start forwarding form content into it —
 * and the disclosure above becomes false. Catching that requires a failing
 * test here, not a reviewer remembering this file exists. It is the same
 * mechanism whose absence let BuyMeACoffee load on every /results visit
 * while appearing in no disclosure table.
 */
const ROOTS = ['src', 'index.html', 'public'];
const IDENTIFIER_PATTERN = /\b(window\.)?(dataLayer|fbq)\b/;

// Our own guard test file is expected to name these identifiers in prose —
// exclude it so it does not fail on itself.
const SELF_PATH = join('src', '__tests__', 'lib', 'feedback', 'tally-analytics-bridge.test.ts');

function collectFiles(root: string): string[] {
  const stats = statSync(root);
  if (stats.isFile()) return [root];

  const entries = readdirSync(root, { withFileTypes: true });
  return entries.flatMap(entry => {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) return [];
    const path = join(root, entry.name);
    return entry.isDirectory() ? collectFiles(path) : [path];
  });
}

describe('feedback/tally analytics bridge', () => {
  it('defines neither window.dataLayer nor window.fbq anywhere in our sources', () => {
    const files = ROOTS.flatMap(collectFiles).filter(path => path !== SELF_PATH);

    const offenders = files.filter(path => {
      const content = readFileSync(path, 'utf-8');
      return IDENTIFIER_PATTERN.test(content);
    });

    expect(offenders).toEqual([]);
  });
});

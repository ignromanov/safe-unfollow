import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Tally's `embed.js` pushes plain GTM objects (`{ event: 'Tally.*', ... }`) into
 * `window.dataLayer` and calls `window.fbq(...)` when those globals exist on the
 * page — guarded internally as `if (e.dataLayer !== void 0)` and
 * `if (e.fbq !== void 0)`.
 *
 * Two invariants keep Tally's analytics bridge inert (`PrivacyPolicy.tsx` §5.6):
 * 1. `window.fbq` (Meta Pixel) and Google Tag Manager containers (`gtm.js` /
 *    `GTM-*`) MUST NEVER exist anywhere in our shipped sources: GTM is the only
 *    runtime that listens to plain `{ event: '...' }` objects pushed onto
 *    `window.dataLayer`, whereas standalone `gtag.js` (`G-JQFNBYQQXZ`) only
 *    processes `Arguments` tuples and ignores plain `{ event }` objects.
 * 2. `window.dataLayer` itself may ONLY appear in the audited GA4 bootstrap
 *    files (`index.html`, `src/lib/ga4-loader.ts`, and its unit test) — where
 *    Google's certified Funding Choices CMP (`fundingchoicesmessages.google.com`)
 *    requires standard `window.dataLayer` to deliver EEA/UK/CH Consent Mode v2
 *    updates (`analytics_storage`). Any new file touching `dataLayer` fails here.
 */
const ROOTS = ['src', 'index.html', 'public'];
const FBQ_OR_GTM_PATTERN = /\b(window\.)?fbq\b|googletagmanager\.com\/gtm\.js|\bGTM-[A-Z0-9]+\b/;
const DATALAYER_PATTERN = /\b(window\.)?dataLayer\b/;

const SELF_PATH = join('src', '__tests__', 'lib', 'feedback', 'tally-analytics-bridge.test.ts');
const ALLOWED_DATALAYER_PATHS = new Set([
  'index.html',
  join('src', 'lib', 'ga4-loader.ts'),
  join('src', '__tests__', 'lib', 'ga4-loader.test.ts'),
  join('src', '__tests__', 'index-html.test.ts'),
]);

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
  const files = ROOTS.flatMap(collectFiles).filter(path => path !== SELF_PATH);

  it('never loads Meta Pixel (window.fbq) or a GTM container (gtm.js / GTM-*) that would forward Tally object pushes', () => {
    const offenders = files.filter(path => FBQ_OR_GTM_PATTERN.test(readFileSync(path, 'utf-8')));

    expect(offenders).toEqual([]);
  });

  it('restricts window.dataLayer exclusively to the audited GA4 bootstrap files', () => {
    const offenders = files.filter(
      path =>
        !ALLOWED_DATALAYER_PATHS.has(path) && DATALAYER_PATTERN.test(readFileSync(path, 'utf-8'))
    );

    expect(offenders).toEqual([]);
  });
});

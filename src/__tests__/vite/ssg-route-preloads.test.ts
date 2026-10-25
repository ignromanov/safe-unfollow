import { describe, expect, it } from 'vitest';

import { dropDynamicOnlyPreloads } from '../../../vite/ssg-meta-injector';

/**
 * vite-react-ssg walks a lazy route's `imports` AND its `dynamicImports` when it writes
 * modulepreloads (`collectModules`, dist/shared/…:76-91). The second half preloads code the
 * route only loads on demand. On /results that is the export dialog, the paywall and the licence
 * dialog: 21 KB that a direct load began fetching ahead of its own LCP.
 * Measured 2026-10-25 (GH#292), n=5 cold loads per arm, CPU 4x, 150 ms RTT, 1.6 Mbps:
 *   /results LCP  main 6176 ms · lazy route 6324 ms (n=3) · lazy route minus those links 6208 ms
 *
 * The shape below is the real manifest's, trimmed: the route module and its shared chunk are
 * static, while ExportDialog is reached only through a `dynamicImports` edge and pulls a static
 * dependency of its own.
 */
const manifest = {
  'index.html': { file: 'assets/app-A.js', isEntry: true, imports: ['_icons-I.js'] },
  '_icons-I.js': { file: 'assets/icons-I.js' },
  'src/pages/ResultsPage.tsx': {
    file: 'assets/ResultsPage-R.js',
    isDynamicEntry: true,
    imports: ['_icons-I.js', '_AccountListSection-S.js', 'index.html'],
  },
  '_AccountListSection-S.js': {
    file: 'assets/AccountListSection-S.js',
    imports: ['index.html'],
    dynamicImports: ['src/components/export/ExportDialog.tsx'],
  },
  'src/components/export/ExportDialog.tsx': {
    file: 'assets/ExportDialog-E.js',
    isDynamicEntry: true,
    imports: ['_support-email-M.js'],
  },
  '_support-email-M.js': { file: 'assets/support-email-M.js' },
};

const link = (file: string) => `<link rel="modulepreload" crossorigin href="/${file}">`;

describe('dropDynamicOnlyPreloads', () => {
  it('keeps the route chunk and its static closure, drops what it loads on demand', () => {
    const html = [
      'assets/icons-I.js',
      'assets/ResultsPage-R.js',
      'assets/AccountListSection-S.js',
      'assets/ExportDialog-E.js',
      'assets/support-email-M.js',
    ]
      .map(link)
      .join('\n');

    const out = dropDynamicOnlyPreloads(html, manifest);

    expect(out).toContain(link('assets/icons-I.js'));
    expect(out).toContain(link('assets/ResultsPage-R.js'));
    expect(out).toContain(link('assets/AccountListSection-S.js'));
    expect(out).not.toContain('ExportDialog-E.js');
    // A static dependency of an on-demand chunk is on demand too.
    expect(out).not.toContain('support-email-M.js');
  });

  it('leaves a page with no route chunk untouched', () => {
    // Home, upload and the rest are in the entry: there is no lazy route to have walked.
    const html = link('assets/icons-I.js');
    expect(dropDynamicOnlyPreloads(html, manifest)).toBe(html);
  });

  it('does not touch hrefs the manifest does not know', () => {
    // The locale preloads are added after this runs, but an unknown href must never be
    // judged by a closure it is not part of.
    const html = [link('assets/ResultsPage-R.js'), link('assets/locale-en-X.js')].join('\n');
    expect(dropDynamicOnlyPreloads(html, manifest)).toContain(link('assets/locale-en-X.js'));
  });
});

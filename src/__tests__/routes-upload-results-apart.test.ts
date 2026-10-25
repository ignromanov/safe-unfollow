import { describe, expect, it } from 'vitest';
import ACCOUNT_LIST from '@/components/AccountList.tsx?raw';
import ACCOUNT_LIST_SECTION from '@/components/AccountListSection.tsx?raw';
import RESULTS_PAGE from '@/pages/ResultsPage.tsx?raw';
import SAMPLE_PAGE from '@/pages/SamplePage.tsx?raw';

/**
 * D10 (GH#285 PR-2): the follow-date zones are read once per fileHash, so the results
 * surface must never host an upload. A tripwire on direct imports, not a transitive proof:
 * a component that reaches UploadZone through a re-export or a third module passes here.
 */
const WHY =
  'a re-upload while /results is mounted would keep stale row slices — useAccountDataSource resets only on a fileHash change (GH#285 PR-2, D10)';

const RESULTS_SURFACE = {
  'src/pages/ResultsPage.tsx': RESULTS_PAGE,
  'src/pages/SamplePage.tsx': SAMPLE_PAGE,
  'src/components/AccountListSection.tsx': ACCOUNT_LIST_SECTION,
  'src/components/AccountList.tsx': ACCOUNT_LIST,
};

const SOURCES = import.meta.glob<string>('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('upload and results stay on separate routes (D10)', () => {
  it.each(Object.entries(RESULTS_SURFACE))('%s imports no upload surface', (_file, source) => {
    expect(source, WHY).not.toContain('UploadZone');
    expect(source, WHY).not.toContain('useFileUpload');
  });

  it('useAccountDataSource is imported by AccountList.tsx and nothing else', () => {
    const importers = Object.entries(SOURCES)
      .filter(([path]) => !path.includes('/__tests__/'))
      .filter(([path]) => path !== '/src/hooks/useAccountDataSource.ts')
      .filter(([, source]) => source.includes('useAccountDataSource'))
      .map(([path]) => path);
    expect(importers, WHY).toEqual(['/src/components/AccountList.tsx']);
  });
});

import { renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, beforeEach } from 'vitest';

import { useHasResults } from '@/hooks/useHasResults';
import { useAppStore } from '@/lib/store';

const FILE = {
  name: 'x.zip',
  size: 1,
  uploadDate: new Date('2026-01-01'),
  fileHash: 'h',
  accountCount: 3,
};

describe('useHasResults', () => {
  beforeEach(() => {
    useAppStore.setState({ uploadStatus: 'idle', fileMetadata: null });
  });

  it('is false with no file', () => {
    const { result } = renderHook(() => useHasResults());
    expect(result.current).toBe(false);
  });

  it('is true once a file is loaded', () => {
    useAppStore.setState({ uploadStatus: 'success', fileMetadata: FILE });
    const { result } = renderHook(() => useHasResults());
    expect(result.current).toBe(true);
  });

  it('renders the no-data branch during hydration even when the store already has data', () => {
    // getServerSnapshot is the only thing standing between a returning visitor and a
    // first render that disagrees with the prerendered HTML.
    useAppStore.setState({ uploadStatus: 'success', fileMetadata: FILE });

    function Probe() {
      return <span>{String(useHasResults())}</span>;
    }

    expect(renderToString(<Probe />)).toContain('false');
  });
});

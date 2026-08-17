import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, beforeEach } from 'vitest';

import { useIsClient } from '@/hooks/useIsClient';
import { useResultsFile } from '@/hooks/useResultsFile';
import { useStoreSSR } from '@/hooks/useStoreSSR';
import { useAppStore } from '@/lib/store';

const FILE = {
  name: 'export.zip',
  size: 42,
  uploadDate: new Date('2026-01-01'),
  fileHash: 'abc',
  accountCount: 1234,
};

beforeEach(() => {
  useAppStore.setState({ uploadStatus: 'idle', uploadError: null, fileMetadata: null });
});

describe('useStoreSSR', () => {
  it('reads the live store on the client', () => {
    useAppStore.setState({ uploadStatus: 'success', fileMetadata: FILE });

    const { result } = renderHook(() => useStoreSSR(s => s.fileMetadata?.accountCount, undefined));

    expect(result.current).toBe(1234);
  });

  it('re-renders when the store changes', () => {
    const { result } = renderHook(() => useStoreSSR(s => s.fileMetadata?.accountCount, undefined));
    expect(result.current).toBeUndefined();

    act(() => {
      useAppStore.setState({ uploadStatus: 'success', fileMetadata: FILE });
    });

    expect(result.current).toBe(1234);
  });

  it('serves the server value during server render, not the store value', () => {
    // This is the whole point of the hook. Every page ships prerendered from an empty
    // store, so a returning visitor's populated store must not reach the first render.
    useAppStore.setState({ uploadStatus: 'success', fileMetadata: FILE });

    function Probe() {
      const count = useStoreSSR(s => s.fileMetadata?.accountCount, undefined);
      return <span>{String(count)}</span>;
    }

    expect(renderToString(<Probe />)).toContain('undefined');
  });
});

describe('useIsClient', () => {
  it('is false during server render', () => {
    function Probe() {
      return <span>{String(useIsClient())}</span>;
    }

    expect(renderToString(<Probe />)).toContain('false');
  });

  it('is true on the client', () => {
    const { result } = renderHook(() => useIsClient());

    expect(result.current).toBe(true);
  });
});

describe('useResultsFile', () => {
  it('returns the file once the upload succeeded', () => {
    useAppStore.setState({ uploadStatus: 'success', fileMetadata: FILE });

    const { result } = renderHook(() => useResultsFile());

    expect(result.current).toEqual(FILE);
  });

  it('is null while the upload is still in flight', () => {
    useAppStore.setState({ uploadStatus: 'loading', fileMetadata: FILE });

    const { result } = renderHook(() => useResultsFile());

    expect(result.current).toBeNull();
  });

  it('is null for a success record that carries no fileHash', () => {
    // AccountListSection cannot mount without it, so "a file exists" is not enough.
    useAppStore.setState({
      uploadStatus: 'success',
      fileMetadata: { ...FILE, fileHash: undefined },
    });

    const { result } = renderHook(() => useResultsFile());

    expect(result.current).toBeNull();
  });

  it('is null for a success record whose accountCount is not a number', () => {
    useAppStore.setState({
      uploadStatus: 'success',
      fileMetadata: { ...FILE, accountCount: undefined },
    });

    const { result } = renderHook(() => useResultsFile());

    expect(result.current).toBeNull();
  });

  it('is null during server render even with a complete file in the store', () => {
    useAppStore.setState({ uploadStatus: 'success', fileMetadata: FILE });

    function Probe() {
      return <span>{useResultsFile() === null ? 'no-file' : 'file'}</span>;
    }

    expect(renderToString(<Probe />)).toContain('no-file');
  });
});

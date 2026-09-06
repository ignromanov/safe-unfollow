import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { readArrivalFilter, readArrivalSource, useFilterFromUrl } from '@/hooks/useFilterFromUrl';
import { BADGE_ORDER } from '@/core/badges';
import { useAppStore } from '@/lib/store';
import type { BadgeKey } from '@/core/types';

const wrapperFor = (path: string) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
  };

describe('useFilterFromUrl', () => {
  beforeEach(() => {
    useAppStore.setState({ filters: new Set<BadgeKey>() });
  });

  it('should apply a valid badge from the parameter', () => {
    renderHook(() => useFilterFromUrl(), { wrapper: wrapperFor('/results?filter=pending') });

    expect([...useAppStore.getState().filters]).toEqual(['pending']);
  });

  it('should replace a persisted selection rather than adding to it', () => {
    useAppStore.setState({ filters: new Set<BadgeKey>(['unfollowed', 'mutuals']) });

    renderHook(() => useFilterFromUrl(), { wrapper: wrapperFor('/results?filter=pending') });

    expect([...useAppStore.getState().filters]).toEqual(['pending']);
  });

  it('should ignore a value that is not a badge', () => {
    useAppStore.setState({ filters: new Set<BadgeKey>(['unfollowed']) });

    renderHook(() => useFilterFromUrl(), { wrapper: wrapperFor('/results?filter=nonsense') });

    expect([...useAppStore.getState().filters]).toEqual(['unfollowed']);
  });

  it('should leave the selection alone when there is no parameter', () => {
    useAppStore.setState({ filters: new Set<BadgeKey>(['unfollowed']) });

    renderHook(() => useFilterFromUrl(), { wrapper: wrapperFor('/results') });

    expect([...useAppStore.getState().filters]).toEqual(['unfollowed']);
  });

  it('should read the arrival source when the landing page names itself', () => {
    expect(readArrivalSource('?filter=pending&from=pending-requests')).toBe('pending-requests');
  });

  it('should reject an arrival source that is not a slug', () => {
    expect(readArrivalSource('?from=<script>')).toBeNull();
    expect(readArrivalSource('?filter=pending')).toBeNull();
  });

  // ⚠️ A weak control, kept because it documents why: a bare `rerender()` cannot reach the
  // re-apply path at all. `useSearchParams` memoises on `location.search`
  // (react-router-dom/dist/index.js:1027-1038) and `setFilters` is a stable zustand action, so
  // the effect's deps never change and it never runs a second time — this test stays green with
  // the once-per-mount guard deleted, verified by mutation. The next test is the real one.
  it('should not re-apply on a plain re-render after the reader clears the filter', () => {
    const { rerender } = renderHook(() => useFilterFromUrl(), {
      wrapper: wrapperFor('/results?filter=pending'),
    });

    act(() => {
      useAppStore.setState({ filters: new Set<BadgeKey>() });
    });
    rerender();

    expect([...useAppStore.getState().filters]).toEqual([]);
  });

  // The production path the guard exists for. `?filter=` stays in the URL so the view is
  // reloadable and shareable, and anything else that writes the query — the guide's
  // `?guide=1`, a language switch — changes `location.search` and hands the effect a fresh
  // `searchParams`. Without the guard the reader's cleared filter snaps back the next time
  // any unrelated parameter moves, and the filter becomes impossible to remove.
  it('should not re-apply when an unrelated parameter rewrites the search', () => {
    const { result } = renderHook(
      () => {
        useFilterFromUrl();
        return useNavigate();
      },
      { wrapper: wrapperFor('/results?filter=pending') }
    );

    expect([...useAppStore.getState().filters]).toEqual(['pending']);

    act(() => {
      useAppStore.setState({ filters: new Set<BadgeKey>() });
    });
    act(() => {
      result.current('/results?filter=pending&guide=1');
    });

    expect([...useAppStore.getState().filters]).toEqual([]);
  });

  it('should read the arrival filter without touching the store', () => {
    expect(readArrivalFilter('?filter=pending')).toBe('pending');
    expect(readArrivalFilter('?filter=nonsense')).toBeNull();
    expect(readArrivalFilter('?from=pending-requests')).toBeNull();
  });

  // Derived from BADGE_ORDER rather than listed: a badge added to the union without being
  // reachable from a landing page would ship a dead entry point, and a hand-written list
  // here would stay green through it. `BADGE_ORDER` is the same source the hook reads, so
  // this asserts the round trip is total rather than re-stating the list.
  it.each([...BADGE_ORDER])('should accept the badge %s', badge => {
    expect(readArrivalFilter(`?filter=${badge}`)).toBe(badge);
  });
});

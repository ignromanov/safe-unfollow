import { useLanguagePrefix } from '@/hooks/useLanguagePrefix';
import { renderHook } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useLocation: vi.fn(),
}));

// Mock locales - must match src/config/languages.ts
vi.mock('@/locales', () => ({
  SUPPORTED_LANGUAGES: ['en', 'es', 'pt', 'id', 'tr', 'ja', 'ru', 'de', 'ar'] as const,
}));

describe('useLanguagePrefix', () => {
  it('should return empty string for root path', () => {
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/',
      search: '',
      hash: '',
      state: null,
      key: 'default',
    });
    const { result } = renderHook(() => useLanguagePrefix());
    expect(result.current).toBe('');
  });

  it('should return /es for Spanish path', () => {
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/es/wizard',
      search: '',
      hash: '',
      state: null,
      key: 'default',
    });
    const { result } = renderHook(() => useLanguagePrefix());
    expect(result.current).toBe('/es');
  });

  it('should return /pt for Portuguese path (nested)', () => {
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/pt/results/details',
      search: '',
      hash: '',
      state: null,
      key: 'default',
    });
    const { result } = renderHook(() => useLanguagePrefix());
    expect(result.current).toBe('/pt');
  });

  it('should return empty string for English path (explicit /en)', () => {
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/en/about',
      search: '',
      hash: '',
      state: null,
      key: 'default',
    });
    const { result } = renderHook(() => useLanguagePrefix());
    expect(result.current).toBe('');
  });

  it('should return empty string for unrelated path', () => {
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/about',
      search: '',
      hash: '',
      state: null,
      key: 'default',
    });
    const { result } = renderHook(() => useLanguagePrefix());
    expect(result.current).toBe('');
  });

  it('should return empty string for supported language that is not first segment', () => {
    // e.g. /blog/es/post - this hook only looks at first segment for app language
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/blog/es/post',
      search: '',
      hash: '',
      state: null,
      key: 'default',
    });
    const { result } = renderHook(() => useLanguagePrefix());
    expect(result.current).toBe('');
  });

  it('should return empty string for unsupported language code', () => {
    vi.mocked(useLocation).mockReturnValue({
      pathname: '/fr/wizard',
      search: '',
      hash: '',
      state: null,
      key: 'default',
    });
    const { result } = renderHook(() => useLanguagePrefix());
    expect(result.current).toBe('');
  });
});

import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/stats/core', () => ({ trackEvent: vi.fn(), trackBeacon: vi.fn() }));
vi.mock('@/lib/store', async importOriginal => {
  const real = await importOriginal<typeof import('@/lib/store')>();
  return { ...real, persistLanguageSync: vi.fn() };
});

import { LocaleHint } from '@/components/LocaleHint';
import { trackBeacon, trackEvent } from '@/lib/stats/core';
import { persistLanguageSync, useAppStore } from '@/lib/store';

const html = document.documentElement;

function translateTo(lang: string): void {
  html.setAttribute('lang', lang);
  html.classList.add('translated-ltr');
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocaleHint lang="en" />
    </MemoryRouter>
  );
}

/**
 * Lets the lazy banner resolve before asserting it is absent. Without this every "stays off"
 * test passed against a component with its guards removed: the banner had simply not loaded
 * yet (mutation-checked 2026-11-16).
 */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

describe('LocaleHint', () => {
  beforeAll(async () => {
    await import('@/components/LocaleHintBanner');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    html.setAttribute('lang', 'en');
    html.className = '';
    useAppStore.setState({ uploadStatus: 'idle' });
  });

  afterEach(() => {
    html.setAttribute('lang', 'en');
    html.className = '';
  });

  it('offers the same page in the language Chrome is translating into', async () => {
    renderAt('/upload');
    act(() => translateTo('pt'));

    const link = await screen.findByRole('link', { name: 'Abrir' });
    expect(link).toHaveAttribute('href', '/pt/upload');
    expect(screen.getByRole('region')).toHaveAttribute('translate', 'no');
    // velum-cdpo: exactly these two fields, the path without query or hash.
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('locale_hint_view', {
      target_lang: 'pt',
      path: '/upload',
    });
  });

  it('remembers the language and reports the click before leaving', async () => {
    renderAt('/');
    act(() => translateTo('id'));

    fireEvent.click(await screen.findByRole('link', { name: 'Buka' }));

    expect(persistLanguageSync).toHaveBeenCalledWith('id');
    expect(trackBeacon).toHaveBeenCalledWith('locale_hint_click', { target_lang: 'id', path: '/' });
  });

  it('closes for good on an explicit Close, and reports that choice and nothing else', async () => {
    const { unmount } = renderAt('/upload');
    act(() => translateTo('ru'));
    fireEvent.click(await screen.findByRole('button', { name: 'Закрыть' }));

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(trackBeacon).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledTimes(2);
    expect(trackEvent).toHaveBeenLastCalledWith('locale_hint_dismiss', {
      target_lang: 'ru',
      path: '/upload',
    });
    unmount();

    renderAt('/');
    act(() => translateTo('ru'));
    await settle();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  // A tab closed without a choice is not a dismissal.
  it('reports no dismissal when the hint just goes away', async () => {
    const { unmount } = renderAt('/upload');
    act(() => translateTo('pt'));
    await screen.findByRole('region');
    unmount();
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).not.toHaveBeenCalledWith('locale_hint_dismiss', expect.anything());
  });

  it.each([
    ['a results page', '/results'],
    ['the sample', '/sample'],
  ])('stays off %s', async (_label, path) => {
    renderAt(path);
    act(() => translateTo('pt'));
    await settle();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('stays off while an export is being read', async () => {
    useAppStore.setState({ uploadStatus: 'loading' });
    renderAt('/upload');
    act(() => translateTo('pt'));
    await settle();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('sits above the sticky header, which is z-[80]', async () => {
    renderAt('/upload');
    act(() => translateTo('pt'));

    const region = await screen.findByRole('region');
    expect(region.className).toContain('z-[85]');
    expect(region.className).not.toMatch(/(^|\s)z-50(\s|$)/);
  });

  it('moves below a top AdSense anchor instead of under it, and back once it is dismissed', async () => {
    const ad = document.createElement('ins');
    ad.className = 'adsbygoogle adsbygoogle-noablate';
    ad.style.position = 'fixed';
    ad.setAttribute('data-anchor-status', 'displayed');
    ad.getBoundingClientRect = () => ({ top: 0, bottom: 64, height: 64 }) as DOMRect;
    document.body.appendChild(ad);
    try {
      renderAt('/upload');
      act(() => translateTo('pt'));

      const region = await screen.findByRole('region');
      expect(region.style.top).toBe('64px');

      await act(async () => {
        ad.setAttribute('data-anchor-status', 'dismissed');
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      expect(region.style.top).toBe('0px');
    } finally {
      ad.remove();
    }
  });

  it('ignores a bottom anchor', async () => {
    const ad = document.createElement('ins');
    ad.className = 'adsbygoogle adsbygoogle-noablate';
    ad.style.position = 'fixed';
    ad.setAttribute('data-anchor-status', 'displayed');
    ad.getBoundingClientRect = () => ({ top: 700, bottom: 768, height: 68 }) as DOMRect;
    document.body.appendChild(ad);
    try {
      renderAt('/upload');
      act(() => translateTo('pt'));
      expect((await screen.findByRole('region')).style.top).toBe('0px');
    } finally {
      ad.remove();
    }
  });

  it('says nothing for a language we do not publish', async () => {
    renderAt('/upload');
    act(() => translateTo('it'));
    await settle();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(trackEvent).not.toHaveBeenCalled();
  });
});

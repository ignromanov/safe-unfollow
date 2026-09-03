import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router-dom';

import { useGuideDialog } from '@/hooks/useGuideDialog';

type Guide = ReturnType<typeof useGuideDialog>;

let guide: Guide;

function Probe() {
  guide = useGuideDialog();
  const location = useLocation();
  const navigationType = useNavigationType();

  return (
    <div>
      <span data-testid="url">{`${location.pathname}${location.search}`}</span>
      <span data-testid="nav">{navigationType}</span>
    </div>
  );
}

function at(entry: string) {
  render(
    <MemoryRouter
      initialEntries={[entry]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Probe />
    </MemoryRouter>
  );
  return {
    url: () => screen.getByTestId('url').textContent,
    nav: () => screen.getByTestId('nav').textContent,
  };
}

describe('useGuideDialog', () => {
  it('reads ?step=3 as an open dialog at section 3', () => {
    at('/upload?step=3');
    expect(guide).toMatchObject({ isOpen: true, step: 3, source: 'url' });
  });

  it('reads ?guide=1 as open with no claim to a section', () => {
    at('/upload?guide=1');
    expect(guide).toMatchObject({ isOpen: true, step: null, source: 'url' });
  });

  it.each(['0', '9', 'x', ''])('treats ?step=%s as ?guide=1', raw => {
    // Out of range is not an error and not a closed dialog: someone followed a
    // link that once meant something. Opening from the start answers them.
    at(`/upload?step=${raw}`);
    expect(guide).toMatchObject({ isOpen: true, step: null });
  });

  it('is closed on a bare /upload', () => {
    at('/upload');
    expect(guide).toMatchObject({ isOpen: false, step: null });
  });

  it('pushes once on open and replaces on every section change', () => {
    // Back is the primary gesture for dismissing a modal on Android. With
    // replace everywhere, the hardware Back button would leave the site
    // instead of closing the dialog — the worst outcome for someone
    // mid-instruction. With push-once, the first Back closes the dialog and
    // the second leaves the page, with no intermediate states in between.
    const page = at('/upload');

    act(() => guide.open('accordion'));
    expect(page.nav()).toBe('PUSH');
    expect(page.url()).toBe('/upload?guide=1');

    act(() => guide.goToStep(4));
    expect(page.nav()).toBe('REPLACE');
    act(() => guide.goToStep(6));
    expect(page.nav()).toBe('REPLACE');
    expect(page.url()).toBe('/upload?step=6');
  });

  it('opens straight at a section when one is given', () => {
    const page = at('/upload');

    act(() => guide.open('accordion', 2));

    expect(page.url()).toBe('/upload?step=2');
    expect(guide).toMatchObject({ isOpen: true, step: 2, source: 'accordion' });
  });

  it('closes without adding a history entry', () => {
    const page = at('/upload?step=5');

    act(() => guide.close());

    expect(page.url()).toBe('/upload');
    expect(page.nav()).toBe('REPLACE');
    expect(guide.isOpen).toBe(false);
  });

  it('keeps the locale prefix and any other query the page arrived with', () => {
    const page = at('/id/upload?utm_source=x');

    act(() => guide.open('error', 3));

    expect(page.url()).toBe('/id/upload?utm_source=x&step=3');
  });
});

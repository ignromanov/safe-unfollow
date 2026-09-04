import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate, useNavigationType } from 'react-router-dom';

import { SAME_PATH_PUSH, useGuideDialog } from '@/hooks/useGuideDialog';

type Guide = ReturnType<typeof useGuideDialog>;

let guide: Guide;
/** A hardware/browser Back: pops the entry directly, running none of our own code. */
let goBack: () => void;
/** What an anchor does — a push carrying arbitrary router state, no handler of ours involved. */
let pushLikeAnchor: (search: string, state: unknown) => void;

function Probe() {
  guide = useGuideDialog();
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  goBack = () => navigate(-1);
  pushLikeAnchor = (search, state) => navigate(`${location.pathname}${search}`, { state });

  return (
    <div>
      <span data-testid="url">{`${location.pathname}${location.search}`}</span>
      <span data-testid="nav">{navigationType}</span>
    </div>
  );
}

type InitialEntries = NonNullable<ComponentProps<typeof MemoryRouter>['initialEntries']>;

/**
 * Renders at one entry, or at a history the reader already walked — the last
 * of the list is where they are standing. A single entry cannot tell a pop
 * from a replace by URL alone, because both land on the same path with the
 * query gone; the entry underneath is what makes the two distinguishable.
 */
function at(entries: InitialEntries[number] | InitialEntries) {
  render(
    <MemoryRouter
      initialEntries={Array.isArray(entries) ? entries : [entries]}
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

/**
 * The history the diagnostic error screen's CTA actually leaves behind on
 * /upload — `{ ...SAME_PATH_PUSH, source: 'error' }`, since `05cf29c`. Used
 * for the pop-mechanics tests below, which do not care about `source` but
 * should still exercise a shape production actually creates.
 */
const PUSHED_BY_ERROR_SCREEN: InitialEntries = [
  '/upload?utm_source=x',
  { pathname: '/upload', search: '?step=6', state: { ...SAME_PATH_PUSH, source: 'error' } },
];

/**
 * A same-path push naming no gesture — hypothetical rather than something
 * today's one `SAME_PATH_PUSH` caller (DiagnosticErrorScreen) produces, since
 * it always names `'error'`. Exercises the fallback-to-`'url'` path for
 * whichever future pusher adds `SAME_PATH_PUSH` without a `source` of its own.
 */
const PUSHED_ON_SAME_PATH_NO_SOURCE: InitialEntries = [
  '/upload?utm_source=x',
  { pathname: '/upload', search: '?step=6', state: SAME_PATH_PUSH },
];

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

  it('closes an arrival without adding a history entry', () => {
    // Arrived on ?step=5 from the landing page, the docs or an error screen:
    // the dialog sits on the entry the reader came in on, so there is nothing
    // of ours to pop and popping would leave the site.
    const page = at('/upload?step=5');

    act(() => guide.close());

    expect(page.url()).toBe('/upload');
    expect(page.nav()).toBe('REPLACE');
    expect(guide.isOpen).toBe(false);
  });

  it('gives one Back press one meaning, whichever control closed the dialog', () => {
    // open() pushes, on the reasoning at its own call site: on Android the
    // hardware Back is how a modal is dismissed. Closing by replace instead of
    // popping leaves two adjacent entries for the same /upload, so the reader's
    // next Back lands on a page that looks identical and appears to do nothing.
    // Every non-Back dismissal reaches close() — the X, the ghost button,
    // Escape and an overlay click all arrive through Dialog's onOpenChange.
    const page = at('/upload');

    act(() => guide.open('accordion', 5));

    expect(page.url()).toBe('/upload?step=5');
    expect(page.nav()).toBe('PUSH');

    act(() => guide.close());

    expect(page.url()).toBe('/upload');
    expect(page.nav()).toBe('POP');
    expect(guide.isOpen).toBe(false);
  });

  it('pops an entry a link on this same path pushed, though open() never ran', () => {
    // The sixth entrance: DiagnosticErrorScreen's CTA is an anchor to
    // /upload?step=N, so no handler of ours runs and pushedRef stays false.
    // Replacing here would leave two adjacent /upload entries whose only
    // difference is a query the reader cannot see — and the diagnostic screen
    // is driven by in-memory upload state that a same-route POP does not
    // clear, so the page they land on is the page they left.
    const page = at(PUSHED_BY_ERROR_SCREEN);

    expect(page.url()).toBe('/upload?step=6');

    act(() => guide.close());

    expect(page.url()).toBe('/upload?utm_source=x');
    expect(page.nav()).toBe('POP');
    expect(guide.isOpen).toBe(false);
  });

  it('pops once for two close() calls that land in the same pass', () => {
    // The mark lives on the entry, and the entry does not change until the
    // router commits the pop — so the condition that decided the first call is
    // still true for a second one arriving before the commit. Two pops would
    // take the reader an entry further back than they asked for, off the page.
    // Reachable programmatically rather than by gesture: a StrictMode
    // double-invoke, a test, a future caller wiring close() to two controls.
    const page = at([
      '/results',
      '/upload?utm_source=x',
      { pathname: '/upload', search: '?step=6', state: { ...SAME_PATH_PUSH, source: 'error' } },
    ]);

    act(() => {
      guide.close();
      guide.close();
    });

    expect(page.url()).toBe('/upload?utm_source=x');
    expect(page.nav()).toBe('POP');
  });

  it('pops again the next time the dialog is opened and closed', () => {
    // The latch is scoped to the entry the pop was issued from, not to the
    // hook's lifetime: closing once must not leave close() inert for the rest
    // of the session.
    const page = at(['/results', '/upload']);

    act(() => guide.open('accordion', 5));
    act(() => guide.close());
    expect(page.url()).toBe('/upload');
    expect(page.nav()).toBe('POP');

    act(() => guide.open('accordion', 5));
    act(() => guide.close());

    expect(page.url()).toBe('/upload');
    expect(page.nav()).toBe('POP');
  });

  it('replaces an unmarked arrival rather than popping the reader off the page', () => {
    // Same shape, no mark: the docs link to /upload?guide=1 from another path,
    // so the entry below is not this page and popping would undo the
    // navigation the reader asked for.
    const page = at(['/docs/instagram-export', '/upload?step=6']);

    act(() => guide.close());

    expect(page.url()).toBe('/upload');
    expect(page.nav()).toBe('REPLACE');
  });

  it('keeps the mark across a section change, which is a replace', () => {
    // goToStep replaces the marked entry. Carrying the state across is what
    // stops the fix repairing one sequence and leaving its neighbour broken:
    // pick a section in the rail first, and close() would fall back to
    // replacing.
    const page = at(PUSHED_BY_ERROR_SCREEN);

    act(() => guide.goToStep(3));

    expect(page.url()).toBe('/upload?step=3');
    expect(page.nav()).toBe('REPLACE');

    act(() => guide.close());

    expect(page.url()).toBe('/upload?utm_source=x');
    expect(page.nav()).toBe('POP');
  });

  it('keeps the locale prefix and any other query the page arrived with', () => {
    const page = at('/id/upload?utm_source=x');

    act(() => guide.open('error', 3));

    expect(page.url()).toBe('/id/upload?utm_source=x&step=3');
  });

  it('reads a same-path push naming the error source, though open() never ran', () => {
    // DiagnosticErrorScreen's CTA is an anchor to /upload?step=N, so no
    // handler of ours runs and `source` state is never set by open(). Only
    // the entry's own state can say this arrival was the error screen's link
    // rather than a plain URL visit.
    at(PUSHED_BY_ERROR_SCREEN);

    expect(guide).toMatchObject({ isOpen: true, step: 6, source: 'error' });
  });

  it('falls back to url when a same-path push names no source', () => {
    at(PUSHED_ON_SAME_PATH_NO_SOURCE);

    expect(guide.source).toBe('url');
  });

  describe('a stale pushedRef must not shadow a later arrival', () => {
    // Regression: pushedRef was cleared only inside close(), and close()'s own
    // comment says a hardware/browser Back never reaches it. Back-dismissing
    // an open('accordion') left pushedRef.current true for the rest of the
    // mount, so a later anchor arrival naming 'error' in location.state was
    // shadowed by the stale 'accordion' — reported as a plausible value, not
    // an obviously broken one, which is why nothing short of walking the
    // sequence would have caught it.
    it('reads the error source after a Back dismissed a prior open()', () => {
      const page = at('/upload');

      act(() => guide.open('accordion'));
      expect(page.url()).toBe('/upload?guide=1');

      act(() => goBack());
      expect(guide.isOpen).toBe(false);

      act(() => pushLikeAnchor('?step=6', { ...SAME_PATH_PUSH, source: 'error' }));

      expect(guide).toMatchObject({ isOpen: true, step: 6, source: 'error' });
    });

    it('keeps the named source across a section change within the same opening', () => {
      const page = at('/upload?utm_source=x');

      act(() => pushLikeAnchor('?step=6', { ...SAME_PATH_PUSH, source: 'error' }));
      expect(guide.source).toBe('error');

      act(() => guide.goToStep(3));

      expect(page.url()).toBe('/upload?step=3');
      expect(guide.source).toBe('error');
    });

    it('reports the fresh gesture, not one inherited from the entry close() left behind', () => {
      at('/upload');

      act(() => pushLikeAnchor('?step=6', { ...SAME_PATH_PUSH, source: 'error' }));
      expect(guide.source).toBe('error');

      act(() => guide.close());
      expect(guide.isOpen).toBe(false);

      act(() => guide.open('accordion'));

      expect(guide.source).toBe('accordion');
    });
  });
});

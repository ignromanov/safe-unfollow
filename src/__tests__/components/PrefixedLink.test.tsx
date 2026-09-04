import { fireEvent, screen } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { describe, it, expect } from 'vitest';

import { renderWithRouter } from '@/__tests__/test-utils';
import { PrefixedLink } from '@/components/PrefixedLink';
import { NON_ENGLISH_LANGUAGES } from '@/config/languages';

/** Reports the state of the entry the router is standing on. */
function EntryStateProbe() {
  const { state } = useLocation();
  return <span data-testid="entry-state">{JSON.stringify(state) ?? ''}</span>;
}

const MARK = { pushedOntoSamePath: true };

describe('PrefixedLink', () => {
  it('renders a real anchor, not a button', () => {
    // The entire reason this component exists: prerendered HTML is inert until React
    // hydrates, and only an href navigates in that window.
    renderWithRouter(<PrefixedLink to="/upload">Upload</PrefixedLink>);

    expect(screen.getByRole('link', { name: 'Upload' }).tagName).toBe('A');
  });

  it('leaves the path alone on English, which has no prefix', () => {
    renderWithRouter(<PrefixedLink to="/upload">Upload</PrefixedLink>);

    expect(screen.getByRole('link', { name: 'Upload' })).toHaveAttribute('href', '/upload');
  });

  it('prefixes the path with the current language', () => {
    renderWithRouter(<PrefixedLink to="/upload?guide=1">Guide</PrefixedLink>, {
      initialEntries: ['/id/upload'],
    });

    expect(screen.getByRole('link', { name: 'Guide' })).toHaveAttribute(
      'href',
      '/id/upload?guide=1'
    );
  });

  it('emits no trailing slash for the home link under a language prefix', () => {
    // `'/ru' + '/'` would be `/ru/`, and vercel.json sets trailingSlash:false — the
    // browser would be 308-redirected to `/ru`, costing a round trip in exactly the
    // pre-hydration window this component exists to serve. Client-side navigation
    // normalised that away; an href does not.
    renderWithRouter(<PrefixedLink to="/">Home</PrefixedLink>, { initialEntries: ['/ru'] });

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/ru');
  });

  it('still renders the bare root for English', () => {
    renderWithRouter(<PrefixedLink to="/">Home</PrefixedLink>);

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  });

  it('publishes the CTA slug as an attribute the pre-hydration listener can read', () => {
    // The listener in index.html runs before React exists, so it can only see what the
    // prerendered markup already says. A prop rather than a hand-written data-cta
    // because the slug is checked against the four the drain knows.
    renderWithRouter(
      <PrefixedLink to="/upload" cta="upload_direct">
        Upload
      </PrefixedLink>
    );

    expect(screen.getByRole('link', { name: 'Upload' })).toHaveAttribute(
      'data-cta',
      'upload_direct'
    );
  });

  it('leaves the attribute off a link that is not a CTA', () => {
    renderWithRouter(<PrefixedLink to="/docs">Docs</PrefixedLink>);

    expect(screen.getByRole('link', { name: 'Docs' })).not.toHaveAttribute('data-cta');
  });

  it('passes through className, aria-label and onClick', () => {
    const clicks: string[] = [];
    renderWithRouter(
      <PrefixedLink
        to="/sample"
        className="cta"
        aria-label="Try the sample"
        onClick={() => clicks.push('hit')}
      >
        Sample
      </PrefixedLink>
    );

    const link = screen.getByRole('link', { name: 'Try the sample' });
    expect(link).toHaveClass('cta');
    link.click();
    expect(clicks).toEqual(['hit']);
  });

  describe('samePathState', () => {
    // The decision lives here rather than at the call site because it is a
    // comparison against the href, and the href is built here. A caller that
    // rebuilt `${prefix}${to}` to make the same comparison would be a second
    // derivation of one fact, free to drift from this one in silence.
    it('attaches the state when the link stays on the path it is rendered on', () => {
      renderWithRouter(
        <>
          <PrefixedLink to="/upload?step=6" samePathState={MARK}>
            Guide
          </PrefixedLink>
          <EntryStateProbe />
        </>,
        { initialEntries: ['/upload'] }
      );

      fireEvent.click(screen.getByRole('link', { name: 'Guide' }));

      expect(screen.getByTestId('entry-state').textContent).toBe(JSON.stringify(MARK));
    });

    it('withholds it when the link leaves the page', () => {
      renderWithRouter(
        <>
          <PrefixedLink to="/upload?step=6" samePathState={MARK}>
            Guide
          </PrefixedLink>
          <EntryStateProbe />
        </>,
        { initialEntries: ['/results'] }
      );

      fireEvent.click(screen.getByRole('link', { name: 'Guide' }));

      expect(screen.getByTestId('entry-state').textContent).not.toContain('pushedOntoSamePath');
    });

    it.each(NON_ENGLISH_LANGUAGES)('sees through the /%s prefix it added itself', lang => {
      // The prefix is derived from the same pathname the comparison reads, so
      // the two cannot disagree about which locale they are in.
      renderWithRouter(
        <>
          <PrefixedLink to="/upload?step=6" samePathState={MARK}>
            Guide
          </PrefixedLink>
          <EntryStateProbe />
        </>,
        { initialEntries: [`/${lang}/upload`] }
      );

      fireEvent.click(screen.getByRole('link', { name: 'Guide' }));

      expect(screen.getByTestId('entry-state').textContent).toBe(JSON.stringify(MARK));
    });

    it('prefers samePathState over a plain state on the page, and falls back off it', () => {
      // Both are legal together. `state` is destructured out of the spread so
      // that a caller passing both cannot have it silently override the
      // computed one; the two answers are per-location, not per-precedence.
      const plain = { from: 'elsewhere' };
      const { unmount } = renderWithRouter(
        <>
          <PrefixedLink to="/upload?step=6" samePathState={MARK} state={plain}>
            Guide
          </PrefixedLink>
          <EntryStateProbe />
        </>,
        { initialEntries: ['/upload'] }
      );

      fireEvent.click(screen.getByRole('link', { name: 'Guide' }));
      expect(screen.getByTestId('entry-state').textContent).toBe(JSON.stringify(MARK));
      unmount();

      renderWithRouter(
        <>
          <PrefixedLink to="/upload?step=6" samePathState={MARK} state={plain}>
            Guide
          </PrefixedLink>
          <EntryStateProbe />
        </>,
        { initialEntries: ['/results'] }
      );

      fireEvent.click(screen.getByRole('link', { name: 'Guide' }));
      expect(screen.getByTestId('entry-state').textContent).toBe(JSON.stringify(plain));
    });
  });
});

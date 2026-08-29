import { screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { renderWithRouter } from '@/__tests__/test-utils';
import { PrefixedLink } from '@/components/PrefixedLink';

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
});

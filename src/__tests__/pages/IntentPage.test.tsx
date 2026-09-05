import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { INTENT_PAGES } from '@/config/intent-pages';
import { INTENT_CONTENT } from '@/pages/intent-content';
import IntentPage from '@/pages/IntentPage';

const firstPage = INTENT_PAGES[0];

const renderPage = (page = firstPage) =>
  render(
    <MemoryRouter initialEntries={[`/${page.slug}`]}>
      <IntentPage page={page} />
    </MemoryRouter>
  );

describe('IntentPage', () => {
  it('should render the page h1 exactly once', () => {
    renderPage();
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(firstPage.h1);
  });

  it('should render every section heading from the content module', () => {
    renderPage();
    for (const section of INTENT_CONTENT[firstPage.slug].sections) {
      expect(screen.getByRole('heading', { level: 2, name: section.heading })).toBeInTheDocument();
    }
  });

  it('should link into the matching filtered view, carrying the source', () => {
    renderPage();
    const cta = screen.getByRole('link', { name: INTENT_CONTENT[firstPage.slug].ctaLabel });
    expect(cta).toHaveAttribute('href', `/upload?filter=${firstPage.badge}&from=${firstPage.slug}`);
  });

  it('should offer exactly one call to action', () => {
    renderPage();
    // `who` alongside `my`/`your`: this page's grammatically natural CTA ("see who does not
    // follow you back") can't take a possessive the way the other two pages' can.
    expect(screen.getAllByRole('link', { name: /upload|see (my|your|who)/i })).toHaveLength(1);
  });

  // task 4 flips this back to it(...) when it adds the two remaining content entries
  it.fails('should have content for every page in the manifest', () => {
    for (const page of INTENT_PAGES) {
      expect(INTENT_CONTENT[page.slug]).toBeDefined();
    }
  });
});

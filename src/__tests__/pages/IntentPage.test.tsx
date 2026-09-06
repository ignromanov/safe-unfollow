import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { INTENT_PAGES } from '@/config/intent-pages';
import { INTENT_CONTENT, ctaHref } from '@/pages/intent-content';
import { INTENT_DEMO } from '@/config/intent-demo-rows';
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
    // By destination, not by label text: a label-word regex couples this test to future
    // ctaLabel copy, and this page's own label ("See who does not follow you back") already
    // broke a my/your-only version of it. Counting anchors that go to the CTA's href survives
    // whatever the label says, and survives task 5 adding sibling links elsewhere on the page.
    expect(
      screen.getAllByRole('link', { name: INTENT_CONTENT[firstPage.slug].ctaLabel })
    ).toHaveLength(1);
    const ctaLinks = screen
      .getAllByRole('link')
      .filter(link => link.getAttribute('href') === ctaHref(firstPage));
    expect(ctaLinks).toHaveLength(1);
  });

  it('should have content for every page in the manifest', () => {
    // Under Record<IntentSlug, IntentContent> this cannot go red at runtime — a fourth manifest
    // page with no content fails npm run type-check, not this assertion. Kept as a runtime
    // statement of the invariant, not as the gate that enforces it.
    for (const page of INTENT_PAGES) {
      expect(INTENT_CONTENT[page.slug]).toBeDefined();
    }
  });

  it("should label the demo as sample data, not the reader's own account", () => {
    renderPage();
    // The compliance weight is in "not your account", not "sample data" — a page that kept the
    // first half and dropped the disavowal must fail this test.
    expect(screen.getByText(/sample data.*not your account/i)).toBeInTheDocument();
  });

  it('should show the sample rows', () => {
    renderPage();
    for (const username of INTENT_DEMO[firstPage.slug].usernames) {
      expect(screen.getByText(username)).toBeInTheDocument();
    }
  });

  it('should say how many of the sample match, and out of how many', () => {
    renderPage();
    const slice = INTENT_DEMO[firstPage.slug];
    expect(
      screen.getByText(new RegExp(`${slice.matching}\\D+${slice.total.toLocaleString('en-US')}`))
    ).toBeInTheDocument();
  });

  for (const page of INTENT_PAGES) {
    it(`/${page.slug} should link to its two siblings and not to itself`, () => {
      renderPage(page);
      const siblings = INTENT_PAGES.filter(p => p.slug !== page.slug);

      for (const sibling of siblings) {
        expect(screen.getByRole('link', { name: sibling.h1 })).toHaveAttribute(
          'href',
          `/${sibling.slug}`
        );
      }
      expect(screen.queryByRole('link', { name: page.h1 })).not.toBeInTheDocument();
    });
  }
});

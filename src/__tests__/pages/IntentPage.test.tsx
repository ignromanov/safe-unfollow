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
    const ctas = screen.getAllByRole('link', { name: INTENT_CONTENT[firstPage.slug].ctaLabel });
    expect(ctas.length).toBeGreaterThan(0);
    for (const cta of ctas) {
      expect(cta).toHaveAttribute(
        'href',
        `/upload?filter=${firstPage.badge}&from=${firstPage.slug}`
      );
    }
  });

  it('should offer exactly one action, however many times it is offered', () => {
    renderPage();
    // By destination, not by label text: a label-word regex couples this test to future
    // ctaLabel copy, and this page's own label ("See who does not follow you back") already
    // broke a my/your-only version of it.
    //
    // This counted anchors until the page repeated its CTA at the end of ~950 words of body
    // copy. Repeating one action is not the thing the assertion was defending against —
    // *competing* actions are, and an anchor count could not tell the two apart. So the
    // invariant is now stated directly: every /upload link on this page goes to the same
    // filtered destination. A second, different upload target fails here as it did before.
    const uploadLinks = screen
      .getAllByRole('link')
      .filter(link => (link.getAttribute('href') ?? '').startsWith('/upload'));

    expect(uploadLinks.length).toBeGreaterThan(0);
    expect(new Set(uploadLinks.map(link => link.getAttribute('href')))).toEqual(
      new Set([ctaHref(firstPage)])
    );
  });

  it('should repeat that action after the body copy', () => {
    renderPage();
    // The page is ~950 words. A reader who reached the end has finished the argument, not
    // rejected it, and until this landed there was nothing to click there.
    const ctaLinks = screen
      .getAllByRole('link')
      .filter(link => link.getAttribute('href') === ctaHref(firstPage));

    expect(ctaLinks.length).toBeGreaterThanOrEqual(2);
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

  it('should show the sample rows the way the results screen shows them', () => {
    renderPage();
    // With the @, which is what AccountItem.tsx:50 renders. The preview is the only picture of
    // the product a search visitor sees before deciding to upload; a bare username was a
    // different product from the one behind the button.
    for (const username of INTENT_DEMO[firstPage.slug].usernames) {
      expect(screen.getByText(`@${username}`)).toBeInTheDocument();
    }
  });

  it('should label every sample row with the badge the page is about', () => {
    renderPage();
    const rows = INTENT_DEMO[firstPage.slug].usernames.length;
    // One chip per row plus the one in the panel header.
    expect(screen.getAllByText(firstPage.badgeLabel)).toHaveLength(rows + 1);
  });

  it('should say how many of the sample match, and out of how many', () => {
    renderPage();
    const slice = INTENT_DEMO[firstPage.slug];
    // Read off the labelled region, not off a single text node: the count and the total are
    // styled differently and therefore live in sibling elements, and getByText matches an
    // element's own text children only. What must hold is that a reader sees the two together,
    // which is a statement about the region and not about the markup inside it.
    const panel = screen.getByRole('region', { name: /sample data.*not your account/i });
    expect(panel.textContent).toMatch(
      new RegExp(`${slice.matching}\\D+${slice.total.toLocaleString('en-US')}`)
    );
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

  it('should mark exactly one CTA, carrying this page slug', () => {
    renderPage();
    const ctas = screen.getAllByRole('link', { name: INTENT_CONTENT[firstPage.slug].ctaLabel });
    const marked = ctas.filter(cta => cta.getAttribute('data-cta') === firstPage.slug);

    // Exactly one, and it is the first. data-cta is a closed literal union keyed on the slug,
    // so marking the repeated CTA too would add its clicks to this page's series with nothing
    // to say which position produced them — the same funnel-position collapse the hero links
    // were left unmarked for. Splitting them needs its own value, not a second marker.
    expect(marked).toHaveLength(1);
    expect(marked[0]).toBe(ctas[0]);
  });

  it('should not mark the sibling links', () => {
    renderPage();
    const sibling = INTENT_PAGES.find(p => p.slug !== firstPage.slug)!;

    expect(screen.getByRole('link', { name: sibling.h1 })).not.toHaveAttribute('data-cta');
  });
});

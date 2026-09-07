import type { ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { INTENT_PAGES } from '@/config/intent-pages';
import { INTENT_CONTENT, ctaHref } from '@/pages/intent-content';
import { INTENT_DEMO } from '@/config/intent-demo-rows';
import IntentPage from '@/pages/IntentPage';

const firstPage = INTENT_PAGES[0];

const SAMPLE_REGION = /sample data.*not your account/i;

/**
 * The flat text of a content node, rendered in isolation and thrown away.
 *
 * The order assertions below need to know where `answer` and `intro` sit relative to the sample
 * card, and both are ReactNode with nested markup — there is no string to match on. Rendering the
 * node the page renders is the only way to get its text without a second, hand-written copy of
 * the copy, which is the drift this whole file exists to prevent.
 */
function textOf(node: ReactNode): string {
  const view = render(<>{node}</>);
  const text = view.container.textContent ?? '';
  view.unmount();
  return text;
}

/** The rendered `@handle` cells of the sample card — the rows a reader can actually count. */
function renderedHandles(): string[] {
  const panel = screen.getByRole('region', { name: SAMPLE_REGION });
  // getByText matches an element's direct text children only, so this finds the handle spans
  // and not their <li> ancestors, whose text also begins with the @.
  return within(panel)
    .getAllByText(/^@/)
    .map(el => el.textContent ?? '');
}

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
    //
    // By prefix rather than by set: the card renders the first N of the slice, and which N is a
    // layout decision (see PREVIEW_ROWS). What must not change is that the rows are the slice's
    // own, in the slice's order, each carrying the @.
    const handles = renderedHandles();
    expect(handles.length).toBeGreaterThan(0);
    expect(handles).toEqual(
      INTENT_DEMO[firstPage.slug].usernames.slice(0, handles.length).map(u => `@${u}`)
    );
  });

  it('should count the rows it rendered, not the rows the slice holds', () => {
    renderPage();
    const slice = INTENT_DEMO[firstPage.slug];
    const handles = renderedHandles();
    const panel = screen.getByRole('region', { name: SAMPLE_REGION });

    // The card sits above the call to action now, so it shows fewer rows than the slice holds —
    // every row it renders pushes the button further down the page. That makes the caption's
    // number and the row count two things that can disagree, and the caption is the half a
    // reader would believe. `{demo.usernames.length}` there reads correct and is not.
    expect(handles.length).toBeLessThan(slice.usernames.length);
    expect(panel.textContent).toMatch(new RegExp(`${handles.length} of ${slice.matching} rows`));
  });

  it('should label every sample row with the badge the page is about', () => {
    renderPage();
    // One chip per rendered row plus the one in the panel header.
    expect(screen.getAllByText(firstPage.badgeLabel)).toHaveLength(renderedHandles().length + 1);
  });

  it('should answer the question and show the proof before it explains anything', () => {
    const answer = textOf(INTENT_CONTENT[firstPage.slug].answer);
    const intro = textOf(INTENT_CONTENT[firstPage.slug].intro);
    renderPage();

    // The order is the design: question (h1), answer, proof, action, then the copy that earns
    // the ranking. Read off the flat page text rather than off element positions, because what
    // is being asserted is the reader's sequence and not a particular DOM shape.
    const page = document.body.textContent ?? '';
    const at = (needle: string) => {
      const i = page.indexOf(needle);
      expect(i, `not found on the page: ${needle.slice(0, 40)}…`).toBeGreaterThan(-1);
      return i;
    };

    expect(at(answer)).toBeLessThan(at('Sample data'));
    expect(at('Sample data')).toBeLessThan(at(intro));
  });

  for (const page of INTENT_PAGES) {
    it(`/${page.slug} should keep its answer short enough to precede the proof`, () => {
      // Derived, not chosen. On a 390px phone the text column is 358px and the answer renders at
      // 16px, so ~45 characters a line and ~26px a line. The layout budgets 128px there, which
      // buys five lines — past that, the card header carrying the badge and the number falls
      // below the ~664px a phone shows, and the proof stops being on the first screen at all.
      //
      // Today: 190, 138 and 138 characters. This is a ceiling on a copy edit made years from now
      // by someone who will not have read the fold arithmetic, not a description of the present.
      const MAX_CHARS = 220;
      expect(textOf(INTENT_CONTENT[page.slug].answer).length).toBeLessThanOrEqual(MAX_CHARS);
    });
  }

  it('should not open a second <main>: Layout already renders one', () => {
    const { container } = renderPage();
    // Layout.tsx wraps <Outlet /> in <main id="main-content">. This page opened with its own
    // <main> until 2026-09-06, so every intent page prerendered two nested <main> elements —
    // invalid HTML, two `main` landmarks for a screen reader, and a skip link resolving to the
    // outer one. Of the nine page components it was the only one that did it.
    expect(container.querySelector('main')).toBeNull();
  });

  it('should say how many of the sample match, and out of how many', () => {
    renderPage();
    const slice = INTENT_DEMO[firstPage.slug];
    // Read off the labelled region, not off a single text node: the count and the total are
    // styled differently and therefore live in sibling elements, and getByText matches an
    // element's own text children only. What must hold is that a reader sees the two together,
    // which is a statement about the region and not about the markup inside it.
    const panel = screen.getByRole('region', { name: /sample data.*not your account/i });
    // The two words, with the spaces. This asserted `150\D+1,180` until 2026-09-06, and `\D+`
    // happily matched "150of 1,180" — which is what the page actually rendered once the count and
    // its unit became separately styled elements, because JSX drops the whitespace between
    // elements on separate lines. A screen reader read it as one word. Only the build suite
    // caught it, and that one skips in silence without a dist/, so the defect was reachable in CI
    // and invisible here.
    expect(panel.textContent).toContain(
      `${slice.matching} of ${slice.total.toLocaleString('en-US')} accounts`
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

import { ArrowRight, User } from 'lucide-react';
import { PrefixedLink } from '@/components/PrefixedLink';
import { BADGE_STYLES } from '@/constants/badge-styles';
import { INTENT_PAGES } from '@/config/intent-pages';
import type { IntentPageConfig, IntentSlug } from '@/config/intent-pages';
import { INTENT_CONTENT, ctaHref } from './intent-content';
import { INTENT_DEMO } from '@/config/intent-demo-rows';

interface IntentPageProps {
  page: IntentPageConfig & { slug: IntentSlug };
}

/**
 * The house primary button, lifted from Hero.tsx rather than re-invented at a smaller size.
 *
 * `w-full sm:w-auto` is the same mobile rule the hero follows and matters more here: 85% of
 * traffic is a phone, and an inline-flex button at this label length wraps against the viewport
 * edge. --primary-foreground on --primary measures 5.00:1 light and 6.15:1 dark, so the button's
 * own label is the one thing on this page that is comfortably above AA.
 */
const CTA_CLASS =
  'cursor-pointer w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-3xl bg-primary px-8 md:px-10 py-4 text-base md:text-lg font-bold text-primary-foreground shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all';

/** Reading measure. 768px of 16px text is ~95 characters a line; 40rem is ~73. */
const PROSE = 'max-w-[40rem]';

/**
 * How many demo rows the sample card shows, out of the eight the slice holds.
 *
 * Four rather than eight, and the reason is vertical rather than aesthetic: the card sits above
 * the call to action, so every row it renders pushes the button further down. Eight rows put the
 * button past 1150px on a desktop and out of reach of a second scroll on a phone. Four still
 * reads as a list rather than a specimen.
 *
 * Not a responsive count. Rendering three on a phone and four on a desktop would need either a
 * `hidden sm:flex` row — which leaves the caption below claiming a number that is wrong at one of
 * the two widths — or a branch on viewport, which the prerender cannot take. The caption counts
 * the rows it actually rendered, so the two cannot drift.
 */
const PREVIEW_ROWS = 4;

/**
 * One intent landing page. The route table binds a manifest entry to each instance, so this
 * component never looks a slug up — it is handed the entry it renders.
 *
 * The order is the whole design: question, answer, proof, action, then the long copy that earns
 * the ranking, then the same action again. A reader who arrives from a search for "who doesn't
 * follow me back" has asked a question, and the page answers it and then shows the answer's shape
 * before asking for anything.
 *
 * A <div>, NOT a <main>: Layout.tsx already wraps <Outlet /> in <main id="main-content">. This
 * file opened with its own <main> until this pass, so every intent page prerendered two nested
 * <main> elements — invalid HTML, two `main` landmarks for a screen reader, and a skip link that
 * resolves to the outer one. Verified in dist/who-doesnt-follow-me-back.html before the change;
 * of the nine page components this was the only one that did it. Guarded by IntentPage.test.tsx.
 *
 * PrefixedLink rather than a bare anchor: it renders a real href, which is what the browser
 * follows in the window before hydration, and becomes a client-side navigation afterwards. The
 * language prefix it adds is always empty here, these pages being English-only.
 */
export function Component({ page }: IntentPageProps) {
  const content = INTENT_CONTENT[page.slug];
  const demo = INTENT_DEMO[page.slug];
  const badgeChip = BADGE_STYLES[page.badge] || 'bg-muted text-muted-foreground';
  const rows = demo.usernames.slice(0, PREVIEW_ROWS);

  return (
    // No px-4: Layout's <main> is already `container mx-auto px-4`, and a second one took the
    // measure on a 390px phone from 358px down to 326px.
    <div className="mx-auto w-full max-w-3xl py-10 md:py-12">
      <h1
        className={`text-3xl md:text-4xl font-display font-extrabold tracking-tight mb-5 ${PROSE}`}
      >
        {page.h1}
      </h1>

      {/* The answer, and nothing else — see IntentContent.answer. A div rather than a <p>: it is
          ReactNode, and a block element inside a <p> is invalid markup that ships straight into
          the prerendered HTML a crawler reads. */}
      <div
        className={`text-base md:text-lg leading-relaxed text-zinc-600 dark:text-zinc-300 ${PROSE}`}
      >
        {content.answer}
      </div>

      {/* The proof, before the prose that explains it. This is the only picture of the product a
          search visitor sees before deciding to upload, so it renders the row AccountItem.tsx
          actually renders — @handle in the display face, the avatar placeholder, the badge chip
          from the shared BADGE_STYLES map — and the count in the vocabulary StatCard.tsx uses on
          /results: the number in the display face over a micro-caps caption.

          A <section> rather than a <figure>: the caption labels the region for assistive
          technology (aria-labelledby -> role="region"), which a <figcaption> does not do. */}
      <section
        aria-labelledby="sample-preview-caption"
        className="mt-8 rounded-4xl border border-border overflow-hidden bg-card shadow-sm"
      >
        <div className="flex flex-wrap items-end justify-between gap-3 px-5 md:px-6 py-4 md:py-5 border-b border-border">
          <div className="flex flex-col items-start gap-3">
            {/* The chip is BADGE_STYLES exactly as the results row renders it, and it does not
                clear AA as text: notFollowingBack measures 4.36:1 light and 4.32:1 dark, mutuals
                4.06:1, pending 3.44:1, all against the 4.5 that 10-12px type needs. That map is
                read by every row on /results, so it is a property-wide question like --primary
                and is filed as its own issue. Forking it here would make this preview advertise a
                row the reader will never actually see, which is worse than the defect. */}
            <span
              className={`text-xs uppercase tracking-wider font-black px-2.5 py-1 rounded-lg border leading-none ${badgeChip}`}
            >
              {page.badgeLabel}
            </span>
            <p className="flex items-baseline gap-2">
              <span className="font-display text-3xl md:text-4xl font-extrabold tracking-tight leading-none">
                {demo.matching}
              </span>
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                {/* The leading space is not cosmetic and is deliberately inside this span rather
                    than between the two. The halves are separate elements because they are styled
                    differently, and JSX drops the whitespace between elements on separate lines —
                    so the accessible text read "150of 1,180 accounts", and so did the prerendered
                    HTML a crawler reads. Placed between the spans it survives, but prettier parks
                    it on whatever line precedes it, where the next edit orphans it; here it is
                    attached to the word it separates. Leading whitespace in a flex item is
                    collapsed away, so nothing moves. */}{' '}
                of {demo.total.toLocaleString('en-US')} accounts
              </span>
            </p>
          </div>
          <span id="sample-preview-caption" className="text-sm font-semibold text-muted-foreground">
            Sample data — not your account
          </span>
        </div>

        <ul className="divide-y divide-border">
          {rows.map(username => (
            <li key={username} className="flex items-center gap-4 px-5 md:px-6 py-3">
              <div className="w-11 h-11 shrink-0 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 border border-border">
                <User size={22} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <span className="font-display font-bold text-base leading-tight block truncate text-zinc-900 dark:text-white">
                  @{username}
                </span>
                <span
                  className={`mt-1.5 inline-flex text-[10px] uppercase tracking-wider font-black px-2 py-0.5 rounded-lg border leading-none ${badgeChip}`}
                >
                  {page.badgeLabel}
                </span>
              </div>
            </li>
          ))}
        </ul>

        {/* text-muted-foreground, not text-zinc-500: the latter measures 4.20:1 on the dark page
            background and 3.67:1 on a dark card, both below AA. The token clears 4.85:1 light and
            8.45:1 dark on --card, and 4.64:1 over this bar's own bg-muted/40 in the light theme.
            Guarded by src/__tests__/a11y/muted-text-contrast.test.ts. */}
        <p className="px-5 md:px-6 py-3 text-xs text-muted-foreground border-t border-border bg-muted/40">
          {rows.length} of {demo.matching} rows from a demo archive. Your own archive produces your
          own list, in this browser — and your archive never leaves your device.
        </p>
      </section>

      <div className="mt-8 flex flex-col items-start gap-3">
        <PrefixedLink to={ctaHref(page)} cta={page.slug} className={CTA_CLASS}>
          {content.ctaLabel}
          <ArrowRight size={20} aria-hidden="true" />
        </PrefixedLink>
        {/* Both halves already ship on this page — "without logging in to anything" in the intro,
            and the archive sentence in the card. Restated at the point of the click because that
            is where the objection is, not where the paragraph is. */}
        <span className="text-sm text-muted-foreground">
          No login. Your archive never leaves your device.
        </span>
      </div>

      <div className="mt-14 space-y-10">
        <div className={`leading-relaxed text-zinc-600 dark:text-zinc-300 ${PROSE}`}>
          {content.intro}
        </div>

        {content.sections.map(section => (
          <section key={section.heading} className={PROSE}>
            <h2 className="text-xl font-bold tracking-tight mb-3">{section.heading}</h2>
            <div className="space-y-3 leading-relaxed text-zinc-600 dark:text-zinc-300">
              {section.body}
            </div>
          </section>
        ))}
      </div>

      {/* The same action, where the reading ends. ~950 words separate this from the first one, and
          a reader who scrolled past four sections has not rejected the offer — they have finished
          reading it. Deliberately NOT marked with `cta`: data-cta is a closed literal union keyed
          on the slug, so a second marked anchor would add clicks to this page's series with
          nothing to say which position produced them. Splitting the two positions needs its own
          value, which is a measurement decision rather than a layout one. */}
      <div className="mt-14 rounded-4xl border border-border bg-card px-6 py-7 flex flex-wrap items-center justify-between gap-5">
        <div className="flex flex-col gap-1 max-w-sm">
          <span className="font-display text-xl font-extrabold tracking-tight">
            Ready to read your own list?
          </span>
          <span className="text-sm text-muted-foreground">
            Drop in the ZIP Instagram sent you. Nothing is uploaded.
          </span>
        </div>
        <PrefixedLink to={ctaHref(page)} className={CTA_CLASS}>
          {content.ctaLabel}
          <ArrowRight size={20} aria-hidden="true" />
        </PrefixedLink>
      </div>

      <nav aria-labelledby="other-questions-heading" className="mt-16 border-t border-border pt-8">
        <h2 id="other-questions-heading" className="text-xl font-bold tracking-tight mb-4">
          Other questions your export answers
        </h2>
        {/* Underlined foreground text, not a bare text-primary link: --primary as *text* measures
            4.06:1 on --card and 3.95:1 on --background in the light theme, both below AA. (The
            comment shipped in 3f63a32 attributed the 4.05 figure to --background; it belonged to
            --card, and --background is the worse of the two.) That is a property-wide token
            question, 65 uses across src/, tracked separately — but nothing obliges a new public
            page to add three more instances of it while it is open. The shortLabel sits outside
            the anchor so the link's accessible name stays exactly the sibling's h1. */}
        <ul className="space-y-3">
          {INTENT_PAGES.filter(other => other.slug !== page.slug).map(other => (
            <li key={other.slug} className="leading-relaxed">
              <PrefixedLink
                to={`/${other.slug}`}
                className="font-semibold underline decoration-primary/50 underline-offset-4 hover:decoration-primary"
              >
                {other.h1}
              </PrefixedLink>
              <span className="text-muted-foreground"> — {other.shortLabel}</span>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export default Component;

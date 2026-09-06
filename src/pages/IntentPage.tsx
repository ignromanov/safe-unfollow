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
 * The first version of this page used `rounded-xl px-6 py-3 hover:opacity-90`, which made the
 * single control this page exists for the least prominent button on the property. `w-full
 * sm:w-auto` is the same mobile rule the hero follows and matters more here: 85% of traffic is
 * a phone, and an inline-flex button at this label length wraps against the viewport edge.
 */
const CTA_CLASS =
  'cursor-pointer w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-3xl bg-primary px-8 md:px-10 py-4 text-base md:text-lg font-bold text-primary-foreground shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all';

/** Reading measure. 768px of 16px text is ~95 characters a line; 40rem is ~73. */
const PROSE = 'max-w-[40rem]';

/**
 * One intent landing page. The route table binds a manifest entry to each instance, so this
 * component never looks a slug up — it is handed the entry it renders.
 *
 * PrefixedLink rather than a bare anchor: it renders a real href, which is what the browser
 * follows in the window before hydration, and becomes a client-side navigation afterwards. The
 * language prefix it adds is always empty here, these pages being English-only — that is
 * harmless, and it means the CTA needs no special case if the scope ever widens.
 */
export function Component({ page }: IntentPageProps) {
  const content = INTENT_CONTENT[page.slug];
  const demo = INTENT_DEMO[page.slug];
  const badgeChip = BADGE_STYLES[page.badge] || 'bg-muted text-muted-foreground';

  return (
    <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-12">
      <h1
        className={`text-3xl lg:text-4xl font-display font-extrabold tracking-tight mb-6 ${PROSE}`}
      >
        {page.h1}
      </h1>

      {/* A div, not a <p>: `intro` is ReactNode like a section body, and a block element inside
          a <p> is invalid markup that ships straight into the prerendered HTML a crawler reads. */}
      <div className={`text-lg leading-relaxed text-zinc-600 dark:text-zinc-300 mb-8 ${PROSE}`}>
        {content.intro}
      </div>

      <div className="flex flex-col items-start gap-3">
        <PrefixedLink to={ctaHref(page)} cta={page.slug} className={CTA_CLASS}>
          {content.ctaLabel}
          <ArrowRight size={20} aria-hidden="true" />
        </PrefixedLink>
        {/* Both halves already ship on this page — "without logging in to anything" in the
            intro, and the archive sentence under the preview. Restated at the point of the
            click because that is where the objection is, not where the paragraph is. */}
        <span className="text-sm text-muted-foreground">
          No login. Your archive never leaves your device.
        </span>
      </div>

      {/* The preview is the only picture of the product a search visitor sees before deciding to
          upload, so it renders the row AccountItem.tsx actually renders — @handle in the display
          face, the avatar placeholder, the badge chip from the shared BADGE_STYLES map. The first
          version was a plain list of bare usernames in body text, which advertised a different
          product from the one behind the button.

          A <section> rather than a <figure>: the caption labels the region for assistive
          technology (aria-labelledby -> role="region"), which a <figcaption> does not do. */}
      <section
        aria-labelledby="sample-preview-caption"
        className="mt-12 rounded-2xl border border-border overflow-hidden bg-card"
      >
        <div className="flex flex-wrap items-end justify-between gap-3 px-5 py-4 border-b border-border">
          <div className="flex flex-col items-start gap-1.5">
            <span
              className={`text-xs uppercase tracking-wider font-black px-2.5 py-1 rounded-lg border leading-none ${badgeChip}`}
            >
              {page.badgeLabel}
            </span>
            <p className="font-display text-2xl font-extrabold tracking-tight">
              {demo.matching}
              <span className="font-sans text-sm font-medium tracking-normal text-muted-foreground">
                {' '}
                of {demo.total.toLocaleString('en-US')} accounts
              </span>
            </p>
          </div>
          <span id="sample-preview-caption" className="text-sm font-semibold text-muted-foreground">
            Sample data — not your account
          </span>
        </div>

        <ul className="divide-y divide-border">
          {demo.usernames.map(username => (
            <li key={username} className="flex items-center gap-4 px-5 py-3">
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
            background and 3.67:1 on a dark card, both below AA. The token clears 7.9:1 on both.
            Guarded by src/__tests__/a11y/muted-text-contrast.test.ts. */}
        <p className="px-5 py-3 text-xs text-muted-foreground border-t border-border bg-muted/40">
          {demo.usernames.length} of {demo.matching} rows from a demo archive. Your own archive
          produces your own list, in this browser — and your archive never leaves your device.
        </p>
      </section>

      <div className="mt-12 space-y-10">
        {content.sections.map(section => (
          <section key={section.heading} className={PROSE}>
            <h2 className="text-xl font-bold tracking-tight mb-3">{section.heading}</h2>
            <div className="space-y-3 leading-relaxed text-zinc-600 dark:text-zinc-300">
              {section.body}
            </div>
          </section>
        ))}
      </div>

      {/* The same action, where the reading ends. ~950 words separate this from the first one,
          and a reader who scrolled past four sections has not rejected the offer — they have
          finished reading it. Deliberately NOT marked with `cta`: data-cta is a closed literal
          union keyed on the slug, so a second marked anchor would add clicks to this page's
          series with nothing to say which position produced them. Splitting the two positions
          needs its own value, which is a measurement decision rather than a layout one. */}
      <div className="mt-14 rounded-2xl border border-border bg-card px-6 py-7 flex flex-wrap items-center justify-between gap-5">
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
        {/* Underlined foreground text, not a bare text-primary link: --primary as *text* on
            --background measures 4.05:1 in the light theme, below AA. That is a property-wide
            token question (65 uses across src/), tracked separately — but nothing obliges a new
            public page to add three more instances of it while it is open. The shortLabel sits
            outside the anchor so the link's accessible name stays exactly the sibling's h1. */}
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
    </main>
  );
}

export default Component;

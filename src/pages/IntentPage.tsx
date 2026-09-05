import { PrefixedLink } from '@/components/PrefixedLink';
import type { IntentPageConfig, IntentSlug } from '@/config/intent-pages';
import { INTENT_CONTENT, ctaHref } from './intent-content';
import { INTENT_DEMO } from '@/config/intent-demo-rows';

interface IntentPageProps {
  page: IntentPageConfig;
}

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
  // page.slug is `string` on IntentPageConfig (task 1 widens it deliberately so the interface
  // stays generic); every real value is a manifest entry's slug, so it is a real IntentSlug.
  const demo = INTENT_DEMO[page.slug as IntentSlug];

  // Every manifest entry gets a route (src/routes.tsx), which the SSG build renders eagerly
  // for all three — including a page task 4 has not written content for yet. Falling back to
  // the bare h1 keeps the build green in that transitional state; IntentPage.test.tsx's "should
  // have content for every page in the manifest" is the gate that turns this a permanent no-op.
  if (!content) {
    return (
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-12">
        <h1 className="text-3xl lg:text-4xl font-display font-extrabold tracking-tight mb-6">
          {page.h1}
        </h1>
      </main>
    );
  }

  return (
    <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl lg:text-4xl font-display font-extrabold tracking-tight mb-6">
        {page.h1}
      </h1>

      {/* A div, not a <p>: `intro` is ReactNode like a section body, and a block element inside
          a <p> is invalid markup that ships straight into the prerendered HTML a crawler reads. */}
      <div className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-300 mb-10">
        {content.intro}
      </div>

      <PrefixedLink
        to={ctaHref(page)}
        className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-base font-bold text-primary-foreground hover:opacity-90 transition-opacity"
      >
        {content.ctaLabel}
      </PrefixedLink>

      <figure className="mt-12 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <figcaption className="flex flex-wrap items-baseline justify-between gap-2 bg-zinc-50 dark:bg-zinc-900 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <span className="text-xs font-black uppercase tracking-widest text-zinc-500">
            Sample data — not your account
          </span>
          <span className="text-sm text-zinc-500">
            {demo.matching} of {demo.total.toLocaleString('en-US')} accounts in this sample
          </span>
        </figcaption>
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {demo.usernames.map(username => (
            <li key={username} className="px-4 py-3 text-sm font-medium">
              {username}
            </li>
          ))}
        </ul>
        <p className="px-4 py-3 text-xs text-zinc-500 border-t border-zinc-200 dark:border-zinc-800">
          Eight of {demo.matching} rows from a demo archive. Your own export produces your own list,
          in this browser, and nothing is uploaded anywhere.
        </p>
      </figure>

      <div className="mt-12 space-y-10">
        {content.sections.map(section => (
          <section key={section.heading}>
            <h2 className="text-xl font-bold tracking-tight mb-3">{section.heading}</h2>
            <div className="space-y-3 leading-relaxed text-zinc-600 dark:text-zinc-300">
              {section.body}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

export default Component;

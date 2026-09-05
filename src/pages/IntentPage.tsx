import { PrefixedLink } from '@/components/PrefixedLink';
import type { IntentPageConfig } from '@/config/intent-pages';
import { INTENT_CONTENT, ctaHref } from './intent-content';

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

      <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-300 mb-10">
        {content.intro}
      </p>

      <PrefixedLink
        to={ctaHref(page)}
        className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-base font-bold text-primary-foreground hover:opacity-90 transition-opacity"
      >
        {content.ctaLabel}
      </PrefixedLink>

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

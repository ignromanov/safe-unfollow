import type { IntentPageConfig } from '@/config/intent-pages';

interface IntentPageProps {
  page: IntentPageConfig;
}

/**
 * One intent landing page. The route table binds a manifest entry to each instance, so this
 * component never looks a slug up — it is handed the entry it renders.
 */
export function Component({ page }: IntentPageProps) {
  return (
    <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl lg:text-4xl font-display font-extrabold tracking-tight mb-6">
        {page.h1}
      </h1>
    </main>
  );
}

export default Component;

import { I18N_NAMESPACES, type SupportedLanguage, type I18nNamespace } from '@/config/languages';

/**
 * Load resources for a specific language.
 *
 * Iterates I18N_NAMESPACES rather than naming each namespace, so a namespace added there is
 * fetched here automatically — the set of chunks requested can never drift from the set the
 * SSG build preloads (vite/ssg-meta-injector.ts reads the same constant).
 *
 * Typed `any` per namespace: the dynamic `import()` specifier is not a string literal, so
 * TypeScript cannot resolve the JSON's shape, and i18next's `Resource` type needs a value
 * assignable to `ResourceKey`, which `unknown` is not.
 *
 * Lives in its own module rather than inlined into src/locales/index.ts specifically so tests
 * can replace it with `vi.mock('@/locales/loadLanguageResources', ...)`. A same-file helper's
 * internal calls bind at compile time and vi.mock cannot intercept them; this split makes the
 * Promise.all fallback in initI18n (index.ts) testable without a real network/import failure.
 */
export async function loadLanguageResources(
  lang: SupportedLanguage
): Promise<Record<I18nNamespace, any>> {
  const modules = await Promise.all(I18N_NAMESPACES.map(ns => import(`./${lang}/${ns}.json`)));

  return Object.fromEntries(
    I18N_NAMESPACES.map((ns, index) => [ns, modules[index].default])
  ) as Record<I18nNamespace, any>;
}

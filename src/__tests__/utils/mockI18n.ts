import type { ReactNode } from 'react';

/**
 * Creates a mock factory for react-i18next that can be used with vi.mock().
 *
 * This function is designed to work with Vitest's hoisting mechanism.
 * Use it inside a vi.hoisted() call to make translations available to vi.mock().
 *
 * @param translationObject - Translation JSON object (e.g., heroEN, commonEN)
 *
 * @example
 * ```ts
 * import { vi } from 'vitest';
 *
 * const { mockI18n, heroEN } = vi.hoisted(() => {
 *   const translations = require('@/locales/en/hero.json');
 *   return {
 *     heroEN: translations,
 *     mockI18n: createI18nMockFactory(translations),
 *   };
 * });
 *
 * vi.mock('react-i18next', mockI18n);
 * ```
 */
export function createI18nMockFactory(translationObject: unknown) {
  // Navigate nested keys like 'buttons.next'.
  //
  // A leading `ns:` is read as one more level, so a component that calls
  // `useTranslation(['howto', 'wizard'])` and asks for `wizard:entry.cta`
  // resolves against `{ ...howtoEN, wizard: wizardEN }`. Only the FIRST colon
  // is rewritten, and a key without one behaves exactly as it did — real
  // i18next treats `ns:` as a namespace rather than a path segment, and this
  // is the smallest thing that makes a two-namespace component testable
  // without merging two bundles that both define `steps`.
  const lookup = (key: string): string | undefined => {
    const keys = key.replace(':', '.').split('.');
    let value: unknown = translationObject;

    for (const k of keys) {
      value = (value as Record<string, unknown>)?.[k];
    }

    return typeof value === 'string' ? value : undefined;
  };

  return () => ({
    useTranslation: (ns?: string) => ({
      t: (key: string, options?: Record<string, unknown>) => {
        let value = lookup(key);

        // i18next plural key resolution: when a `count` option is passed
        // and the bare key doesn't exist, fall back to `${key}_one` /
        // `${key}_other` — the two-way split every supported language
        // resource actually defines. This mirrors real i18next closely
        // enough for tests, which only ever load the English bundle.
        if (value === undefined && typeof options?.count === 'number') {
          value = lookup(`${key}${options.count === 1 ? '_one' : '_other'}`);
        }

        let result = value || key;

        // Handle interpolation (e.g., {{count}}, {{label}})
        if (options) {
          Object.entries(options).forEach(([k, v]) => {
            if (typeof v !== 'object') {
              result = result.replace(`{{${k}}}`, String(v));
            }
          });
        }

        return result;
      },
      i18n: {
        language: 'en',
      },
    }),
    Trans: ({ i18nKey, children }: { i18nKey?: string; children?: ReactNode }) => {
      return children || i18nKey;
    },
  });
}

/**
 * Helper function to create i18n mock implementation.
 * Use this directly in test files where vi.hoisted() is not needed.
 *
 * @param translationObject - Translation JSON object
 * @returns Mock implementation object
 *
 * @example
 * ```ts
 * import heroEN from '@/locales/en/hero.json';
 * import { createI18nMock } from '@/__tests__/utils/mockI18n';
 *
 * vi.mock('react-i18next', () => createI18nMock(heroEN));
 * ```
 */
export function createI18nMock(translationObject: unknown) {
  return createI18nMockFactory(translationObject)();
}

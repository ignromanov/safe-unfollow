import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES } from '@/config/languages';

// The locale gate (loadLanguageResources) has no interpolation check, so a
// dropped {{rows}} placeholder ships silently. Checked here instead.
const BUNDLES = import.meta.glob<Record<string, unknown>>('../../locales/*/results.json', {
  eager: true,
  import: 'default',
});

function bundleFor(language: string): Record<string, any> {
  const entry = Object.entries(BUNDLES).find(([path]) => path.includes(`/${language}/`));
  if (!entry) throw new Error(`no results.json for ${language}`);
  return entry[1] as Record<string, any>;
}

describe('export.freeHint', () => {
  it('exists in every supported language with {{rows}} intact', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const bundle = bundleFor(language);
      const hint = bundle.export?.freeHint;
      expect(hint, `${language} export.freeHint`).toBeTruthy();
      expect(String(hint), language).toContain('{{rows}}');
    }
  });

  // The docstring on runFreeExport (ResultsExportControls.tsx) explains why:
  // a price on the trigger's own caption reintroduces the filter the flow was
  // built to move after the value. $7 stays in the paywall.
  it('never states the price', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const bundle = bundleFor(language);
      expect(String(bundle.export?.freeHint), language).not.toMatch(/\$\s*7|\b7\s*\$/);
    }
  });
});

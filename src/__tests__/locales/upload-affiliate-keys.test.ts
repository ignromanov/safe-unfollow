import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES } from '@/config/languages';

const BUNDLES = import.meta.glob<Record<string, unknown>>('../../locales/*/upload.json', {
  eager: true,
  import: 'default',
});

function bundleFor(language: string): Record<string, any> {
  const entry = Object.entries(BUNDLES).find(([path]) => path.includes(`/${language}/`));
  if (!entry) throw new Error(`no upload.json for ${language}`);
  return entry[1] as Record<string, any>;
}

describe('upload affiliate copy', () => {
  it('is present and non-empty in every supported language', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const bundle = bundleFor(language);
      expect(bundle.affiliate?.nordvpn?.title, `${language} title`).toBeTruthy();
      expect(bundle.affiliate?.nordvpn?.desc, `${language} desc`).toBeTruthy();
      expect(bundle.affiliate?.disclosure, `${language} disclosure`).toBeTruthy();
      expect(bundle.affiliate?.opensInNewTab, `${language} opensInNewTab`).toBeTruthy();
      expect(bundle.affiliate?.adLabel, `${language} adLabel`).toBeTruthy();
    }
  });

  it('never claims we use the product ourselves', () => {
    // An unsupported endorsement is an FTC problem; a "We use NordVPN" line was
    // removed once already for exactly this reason.
    for (const language of SUPPORTED_LANGUAGES) {
      const bundle = bundleFor(language);
      expect(String(bundle.affiliate.nordvpn.desc)).not.toMatch(/\bwe use\b/i);
    }
  });

  it('leaves no affiliate copy behind under loadingTips', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const bundle = bundleFor(language);
      expect(bundle.loadingTips?.nordvpn, language).toBeUndefined();
      expect(bundle.loadingTips?.affiliateDisclosure, language).toBeUndefined();
      expect(bundle.loadingTips?.opensInNewTab, language).toBeUndefined();
    }
  });
});

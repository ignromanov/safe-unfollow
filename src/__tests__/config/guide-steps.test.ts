import { describe, expect, it } from 'vitest';

import { ACCOUNTS_CENTER_URL, GUIDE_STEPS } from '@/config/wizard-steps';

describe('GUIDE_STEPS', () => {
  it('numbers seven sections from one', () => {
    expect(GUIDE_STEPS.map(s => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('keeps the asset paths at their original names', () => {
    // The `visual` strings are files in public/wizard/, not routes: the hyphen
    // in `step-2` is what separates them from the old `/wizard/step/2` route.
    // They used to mirror `id` by construction and no longer do — renaming 35
    // files would break the 30-day asset cache for every reader who opened a
    // step page in the last month, for a cosmetic gain. This test is what the
    // mirror was.
    expect(GUIDE_STEPS.map(s => s.visual)).toEqual([
      '/wizard/step-2',
      '/wizard/step-3',
      '/wizard/step-4',
      '/wizard/step-5',
      '/wizard/step-6',
      '/wizard/step-7',
      '/wizard/step-8',
    ]);
  });

  it('marks the two steps that still carry a warning', () => {
    // Old 4 -> new 3 ("only Followers and following") and old 6 -> new 5
    // (format). Step 3 is the one that grows in weight: it governs file size,
    // and TOO_MANY_ENTRIES / FILE_TOO_LARGE survive HTML parsing while
    // html_format does not (design.md §6.5).
    expect(GUIDE_STEPS.filter(s => s.isWarning).map(s => s.id)).toEqual([3, 5]);
  });

  it('keeps the Accounts Center URL reachable without a step', () => {
    expect(ACCOUNTS_CENTER_URL).toContain('accountscenter.instagram.com');
  });

  it('carries one copy key per section, in every locale', () => {
    // The keys shift with the ids: `steps.2..8` become `steps.1..7`. i18next
    // falls back to the key string, not to English, so a locale that missed
    // the shift renders `wizard.steps.7.title` to a live reader rather than
    // failing anywhere a gate can see.
    const bundles = import.meta.glob<Record<string, any>>('../../locales/*/wizard.json', {
      eager: true,
      import: 'default',
    });

    expect(Object.keys(bundles)).toHaveLength(10);
    for (const [path, bundle] of Object.entries(bundles)) {
      expect(Object.keys(bundle.steps).sort(), path).toEqual(
        GUIDE_STEPS.map(s => String(s.id)).sort()
      );
    }
  });
});

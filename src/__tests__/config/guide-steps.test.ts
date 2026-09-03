import { describe, expect, it } from 'vitest';

import { ACCOUNTS_CENTER_URL, GUIDE_STEPS, guideStepPosterSize } from '@/config/wizard-steps';

describe('GUIDE_STEPS', () => {
  it('numbers eight sections from one', () => {
    expect(GUIDE_STEPS.map(s => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('gives every step the asset that shares its number', () => {
    // The `visual` strings are files in public/wizard/, not routes: the hyphen
    // in `step-2` is what separates them from the old `/wizard/step/2` route.
    // They mirror `id` again, which is the point of restoring step 1 — while
    // the entry screen sat outside the list, `id N` meant `step-(N+1)` and
    // this test was the only thing saying so.
    expect(GUIDE_STEPS.map(s => s.visual)).toEqual([
      '/wizard/step-1',
      '/wizard/step-2',
      '/wizard/step-3',
      '/wizard/step-4',
      '/wizard/step-5',
      '/wizard/step-6',
      '/wizard/step-7',
      '/wizard/step-8',
    ]);
  });

  it('marks step 4 as the only warning in the guide', () => {
    // Two amber cards out of eight are a colour, not a hierarchy, so exactly
    // one step carries the flag. It is the "Followers and following" step
    // rather than the format step because #152 made an HTML export readable:
    // the wrong format now costs reliability, while clearing the wrong
    // checkboxes leaves no follower data in the export at all.
    expect(GUIDE_STEPS.filter(s => s.isWarning).map(s => s.id)).toEqual([4]);
  });

  it('sends the reader off-site on step 1 and nowhere else', () => {
    // The guide walks one flow, and only its first instruction is "go there".
    // A second `externalLink` appearing here means a step is asking the reader
    // to leave a screen the previous step just told them to open.
    expect(GUIDE_STEPS.filter(s => s.externalLink).map(s => s.id)).toEqual([1]);
    expect(GUIDE_STEPS[0].externalLink).toBe(ACCOUNTS_CENTER_URL);
    expect(ACCOUNTS_CENTER_URL).toContain('accountscenter.instagram.com');
  });

  it('gives steps 1 and 2 their 5:3 poster size and every other step the 4:3 default', () => {
    // step-1 and step-2 are both 600x360, unlike every other step's 600x450 —
    // the one place StepAccordion and GuideStepSection both need to agree.
    // Two entries, not one: the override list is keyed by id, the ids moved,
    // and a stale single entry would letterbox the new step 1's poster.
    expect(guideStepPosterSize(1)).toEqual({ width: 600, height: 360 });
    expect(guideStepPosterSize(2)).toEqual({ width: 600, height: 360 });
    for (const step of GUIDE_STEPS.slice(2)) {
      expect(guideStepPosterSize(step.id)).toEqual({ width: 600, height: 450 });
    }
  });

  it('carries one copy key per section, in every locale', () => {
    // The keys shift with the ids: `steps.1..7` become `steps.2..8` and a new
    // `steps.1` arrives. i18next falls back to the key string, not to English,
    // so a locale that missed the shift renders `wizard.steps.8.title` to a
    // live reader rather than failing anywhere a gate can see.
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

  it('gives every section a title, a description and an alt, in every locale', () => {
    // The renumbering moves three strings per step across ten bundles. A step
    // that arrived with two of them still renders — the third comes out as the
    // raw key — so the shape is checked rather than assumed.
    const bundles = import.meta.glob<Record<string, any>>('../../locales/*/wizard.json', {
      eager: true,
      import: 'default',
    });

    for (const [path, bundle] of Object.entries(bundles)) {
      for (const step of GUIDE_STEPS) {
        const copy = bundle.steps[String(step.id)];
        expect(Object.keys(copy).sort(), `${path} steps.${step.id}`).toEqual([
          'alt',
          'description',
          'title',
        ]);
        for (const value of Object.values(copy)) {
          expect(typeof value, `${path} steps.${step.id}`).toBe('string');
          expect((value as string).trim().length, `${path} steps.${step.id}`).toBeGreaterThan(0);
        }
      }
    }
  });
});

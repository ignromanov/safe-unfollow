import { describe, expect, it } from 'vitest';

import type { GuideStepKey } from '@/config/wizard-steps';
import {
  ACCOUNTS_CENTER_URL,
  GUIDE_STEPS,
  guideStepId,
  guideStepPosterSize,
} from '@/config/wizard-steps';
import faqEN from '@/locales/en/faq.json';
import wizardEN from '@/locales/en/wizard.json';

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

  it('deep-links from the FAQ only into sections that exist, and identically in every locale', () => {
    // `items.downloadTime.relatedLink.href` is `/upload?step=8`, hand-written in
    // all ten bundles, and FAQSection renders the href straight out of the
    // bundle. The other `?step=N` producer — `guideHrefForError` — is bound by
    // `wizard-routing.test.ts`; this one was created without a gate.
    //
    // The failure it catches is silent by design: `useGuideDialog`'s `parseStep`
    // resolves an out-of-range step to `null`, so on the next renumbering a
    // reader following "How long does the download take?" opens the guide at
    // section 1, and nothing anywhere reports it.
    //
    // The regex runs over the serialized bundle rather than over one known key,
    // so a second such link added under any other key is bound the day it
    // appears rather than the day someone remembers this test exists.
    const bundles = import.meta.glob<Record<string, unknown>>('../../locales/*/faq.json', {
      eager: true,
      import: 'default',
    });

    const stepsIn = (bundle: unknown) =>
      [...JSON.stringify(bundle).matchAll(/\/upload\?step=(\d+)/g)]
        .map(m => Number(m[1]))
        .sort((a, b) => a - b);

    const ids = new Set(GUIDE_STEPS.map(s => s.id));
    const expected = stepsIn(faqEN);

    // English is the reference for the ten-way agreement, so it is anchored
    // first: without a link of its own the two assertions below hold vacuously,
    // and a sweep that deleted the link from all ten bundles would read green.
    expect(expected.length, 'the FAQ carries at least one guide deep link').toBeGreaterThan(0);

    expect(Object.keys(bundles)).toHaveLength(10);
    for (const [path, bundle] of Object.entries(bundles)) {
      const steps = stepsIn(bundle);
      // Membership, not a range: an id no step carries is the defect, and a
      // range check would pass a gap. Asserted per bundle rather than on the
      // reference alone — the agreement check below cannot see a step that ten
      // bundles are wrong about together, which is what a global find-replace
      // across the locales produces.
      for (const step of steps) expect(ids, `${path} /upload?step=${step}`).toContain(step);
      // A translator copying an older bundle can land on a step that exists but
      // is not the one the sentence promises — in range, so only the ten-way
      // comparison sees it.
      expect(steps, path).toEqual(expected);
    }
  });

  it('names every section with a key of its own', () => {
    // The keys are the identity `guideStepForError` points at instead of the
    // ordinals it used to hardcode. Two steps sharing one key would make
    // `guideStepId` answer with whichever sits earlier in the array — a wrong
    // section, resolved silently, which is the exact failure the keys exist to
    // remove.
    const keys = GUIDE_STEPS.map(s => s.key);
    for (const [index, key] of keys.entries()) {
      expect(typeof key, `GUIDE_STEPS[${index}]`).toBe('string');
      expect(key.length, `GUIDE_STEPS[${index}]`).toBeGreaterThan(0);
    }
    expect(new Set(keys).size).toBe(GUIDE_STEPS.length);
  });

  it('resolves every key to its own section, and refuses one no section carries', () => {
    // The list is derived from GUIDE_STEPS rather than typed out: a ninth step
    // is covered the moment it is added, which a hand-written list of eight
    // names would not be.
    for (const step of GUIDE_STEPS) {
      expect(guideStepId(step.key), step.key).toBe(step.id);
    }

    // Throwing is the contract, not an implementation detail: a fallback would
    // send a reader whose upload failed to an instruction that does not answer
    // them, and say nothing.
    expect(() => guideStepId('noSuchStep' as GuideStepKey)).toThrow(/noSuchStep/);
  });

  it('keeps the two keys the error routing depends on pointing at their own instructions', () => {
    // `guideStepForError` names these two and nothing else. Titles rather than
    // ids, because an id is what the keys were introduced to stop trusting: a
    // renumbering that moves "Change Format to JSON" out from under
    // `formatJson` — by renaming the key, or by attaching it to another step —
    // is exactly the mistake a number cannot see, and it ends with a reader
    // whose ZIP was not an export being told to check their file format.
    // Indexed through a widened alias: the literal keys of the imported JSON
    // would need the very number under test written into the cast.
    const steps = wizardEN.steps as Record<string, { title: string }>;

    expect(steps[String(guideStepId('selectFollowers'))].title).toBe(
      'Select Only "Followers and following"'
    );
    expect(steps[String(guideStepId('formatJson'))].title).toBe('Change Format to JSON');
  });
});

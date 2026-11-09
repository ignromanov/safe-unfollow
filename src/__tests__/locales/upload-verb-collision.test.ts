import { describe, expect, it } from 'vitest';

const BUNDLES = import.meta.glob<Record<string, unknown>>('../../locales/en/*.json', {
  eager: true,
  import: 'default',
});

/**
 * A privacy denial attaches to the destination, never to the reader's own verb
 * (`decisions/2026-09-08-lumen-cro-a-denial-must-not-negate-the-readers-own-verb.md`; plan
 * 2026-11-09-seo-aeo-geo task 04, step 2).
 *
 * The defect: one string tells the reader to upload their export and, in the same breath, says
 * it is never uploaded. Both halves cannot be true to the reader, who just watched themselves do
 * it; the denial reads as false and takes the true claim (no server receives the file) down with
 * it. The licensed form names the destination: "never sent to a server".
 *
 * English only, and deliberately: the nine locales carry the same rule in their own verbs, which
 * no regex here can read — that is the translation review's job, recorded in plan/STATE.md.
 */
const INSTRUCTS_UPLOAD = /\bupload\s+(?:your|the|a|it|this)\b|^upload\b/i;
const DENIES_UPLOAD =
  /\b(?:never|not|nothing\s+(?:is|gets))\s+(?:be\s+|get\s+|been\s+)?uploaded\b|\bnever\s+upload(?:s|ed)?\b/i;

function strings(value: unknown, path: string): Array<[string, string]> {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => strings(v, `${path}.${k}`));
  }
  return [];
}

const collides = (text: string) => INSTRUCTS_UPLOAD.test(text) && DENIES_UPLOAD.test(text);

describe('the reader’s verb is never the one denied', () => {
  it('reads the English bundles', () => {
    expect(Object.keys(BUNDLES).length).toBeGreaterThan(5);
  });

  it('no en string tells the reader to upload and denies uploading in the same string', () => {
    const offenders = Object.entries(BUNDLES).flatMap(([file, bundle]) =>
      strings(bundle, file.replace(/^.*\//, ''))
        .filter(([, text]) => collides(text))
        .map(([path, text]) => `${path}: ${text}`)
    );
    expect(offenders).toEqual([]);
  });

  it('the detector can go red, and leaves the licensed form and the neighbours alone', () => {
    expect(collides('Upload your ZIP. Your export is never uploaded.')).toBe(true);
    expect(collides('Upload the export — nothing is uploaded to us.')).toBe(true);
    // The licensed form, and two strings the scan above must not flag.
    expect(collides('Select your ZIP. SafeUnfollow never sends the file to a server.')).toBe(false);
    expect(collides('Not sure what to upload? See the guide')).toBe(false);
    expect(collides('See how badges work, with no upload needed.')).toBe(false);
  });
});

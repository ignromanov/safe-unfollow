import { readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { FAQSection } from '@/components/FAQSection';
import { HowToSection } from '@/components/HowToSection';
import { OrganizationSchema } from '@/components/OrganizationSchema';

import { renderWithRouter } from '../test-utils';

/**
 * What the machine-readable half of the site is allowed to assert.
 *
 * `.claude/CLAUDE.md` -> "Performance Targets (1M accounts)" states the rule this
 * file enforces: those figures are targets, and "never restate one of these as
 * achieved". Nothing in the repository measures them — there is no benchmark
 * harness, and the only 1M-scale test mocks IndexedDB entirely and asserts a
 * 500ms ceiling, so it measures in-memory bitset iteration rather than storage.
 *
 * JSON-LD is where breaking that rule costs the most. Prose can carry a caveat
 * beside a number; a `featureList` entry cannot. The format exists to be ingested
 * as fact, so a target written into it is served as a measurement to every
 * consumer that reads it, on every locale, with no adjacent sentence to qualify
 * it. `OrganizationSchema.tsx` shipped `'Sub-5ms filtering performance'` on all
 * ten homepage variants until this gate was written.
 *
 * WHY THIS IS A GATE AND NOT A DELETION. The claim was not merely present — it
 * was *pinned*: `OrganizationSchema.test.tsx` asserted `featureList` contained it,
 * under a test named "should include performance feature", and pinned the list's
 * length at 8. That is the fourth recorded case of a gate holding a wrong fact in
 * place (`c13059a`, P1 row 25, #202) and the first where the held fact is a public
 * promise. Deleting the line without replacing the assertion leaves the next
 * author free to add the claim back, and leaves a test suite that says the claim
 * is required.
 *
 * SCOPE, stated so it is not mistaken for more than it is: this reads the rendered
 * JSON-LD of the four components that emit it, not the source text. That is
 * deliberate — it is what actually ships, it follows the claim through `t()` into
 * the locale bundles, and it will cover a fifth emitter the moment one is added to
 * the list below. It does not police prose, `docs/`, or the README; a latency
 * figure there can carry its own caveat and `monetization-claims.test.ts` and
 * `architecture-facts.test.ts` own that ground.
 */
const LATENCY_CLAIM = /\b(?:sub[-\s]?)?\d+(?:[.,]\d+)?\s*(?:ms|milliseconds?)\b/i;

/**
 * The second claim JSON-LD carried that nothing measured: `'Works offline after loading'`
 * in the `SoftwareApplication` `featureList` (GH#224). The precache is icons only
 * (`vite/pwa-config.ts`), so the true statement needs the qualifier "already opened" —
 * and a `featureList` entry has no room for one. Same rule as latency: prose may carry
 * the caveat (`monetization-claims.test.ts` polices that), structured data may not make
 * the claim at all.
 */
const OFFLINE_CLAIM = /\boffline\b|\bwithout (?:an? )?internet\b/i;

/**
 * The control.
 *
 * A gate whose subject has just been deleted passes for two indistinguishable
 * reasons: the claim is absent, or the detector cannot see it. The second is an
 * absence wearing evidence's clothes, and this project has been burned by exactly
 * that shape more than once. So the detector is proved able to go red on the
 * literal string that was live, and on the two phrasings a future author is most
 * likely to reach for instead, before it is trusted to report green on the real
 * components.
 */
const KNOWN_VIOLATIONS = [
  'Sub-5ms filtering performance',
  'Filters 1,000,000 accounts in under 5 ms',
  'Search completes in 2 milliseconds',
];

const OFFLINE_KNOWN_VIOLATIONS = ['Works offline after loading', 'Works without internet', 'Offline-capable'];

/** Strings that must NOT trip it — a version, a duration, an ISO date, a count. */
const KNOWN_INNOCENTS = [
  'Instagram Unfollow Tracker',
  'PT5M',
  '1.5.0',
  '2025-11-22',
  'Analyze up to 1,000,000+ accounts',
];

/** Every string value anywhere in a parsed JSON-LD tree, at any depth. */
function stringsIn(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(stringsIn);
  }
  return [];
}

function jsonLdStrings(ui: React.ReactElement, route: string): string[] {
  const { container } = renderWithRouter(ui, { initialEntries: [route] });
  const blocks = container.querySelectorAll('script[type="application/ld+json"]');
  expect(
    blocks.length,
    `${route} rendered no JSON-LD — this gate would pass without reading anything`
  ).toBeGreaterThan(0);
  return [...blocks].flatMap(block => stringsIn(JSON.parse(block.textContent!)));
}

/**
 * Every component in `src/` that emits JSON-LD, with a route that makes it render.
 * `OrganizationSchema` renders only on a home path; `BreadcrumbSchema` renders only
 * off it.
 */
const EMITTERS: Array<[string, () => React.ReactElement, string]> = [
  ['OrganizationSchema', () => <OrganizationSchema />, '/'],
  ['BreadcrumbSchema', () => <BreadcrumbSchema />, '/upload'],
  ['HowToSection', () => <HowToSection />, '/'],
  ['FAQSection', () => <FAQSection />, '/'],
];

/**
 * The list above is hand-enumerated, and the docblock at the top of this file promised it
 * "will cover a fifth emitter the moment one is added to the list below" — which is a
 * promise about an author's attention, not about the code. A fifth emitter added without
 * that edit is not caught and not reported: the gate stays green because it never looks,
 * which is the same shape as the hand-typed lists in P1 row 14 and #254.
 *
 * So the list is coupled to the corpus it claims to cover. The scan reads the comment-
 * stripped source of everything under `src/` outside `__tests__/`, because a component
 * that only *mentions* the media type in prose is not an emitter — the inverse of the
 * 2026-09-14 grep that counted a docblock saying a file does NOT use a spelling.
 */
const SRC_DIR = join(process.cwd(), 'src');
const TESTS_DIR = join(SRC_DIR, '__tests__');
const LD_JSON = 'application/ld+json';

/** Comments carry prose *about* the code and must not be matched as code. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function emitsJsonLd(source: string): boolean {
  return stripComments(source).includes(LD_JSON);
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return full === TESTS_DIR ? [] : walk(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const shippedEmitters = walk(SRC_DIR)
  .filter(file => emitsJsonLd(readFileSync(file, 'utf8')))
  .map(file => basename(file, extname(file)))
  .sort();

describe('the emitter list is the set of emitters that ship', () => {
  it('tells an emission apart from prose about one', () => {
    expect(emitsJsonLd(`<script type="${LD_JSON}">{}</script>`)).toBe(true);
    expect(emitsJsonLd(`/* renders an ${LD_JSON} block */ export const a = 1;`)).toBe(false);
    expect(emitsJsonLd(`// TODO: emit ${LD_JSON} here\nexport const b = 2;`)).toBe(false);
    expect(emitsJsonLd('export const c = 3;')).toBe(false);
  });

  it('reaches real files, and this file is outside its reach', () => {
    // A walk that returns nothing satisfies the equality below with an empty list on both
    // sides only if EMITTERS is empty too — but a walk that silently narrows would still
    // let a real emitter through, so assert it is reading the tree it claims to read.
    expect(walk(SRC_DIR).length).toBeGreaterThan(50);
    expect(shippedEmitters.length).toBeGreaterThan(0);
    // This file carries the literal in its own assertions; counting it would be the gate
    // reading itself. Assert the exclusion really fires rather than trusting the path.
    expect(readdirSync(SRC_DIR).includes('__tests__')).toBe(true);
    expect(walk(SRC_DIR).some(file => file.startsWith(TESTS_DIR))).toBe(false);
  });

  it('covers every shipped emitter, and every entry still emits', () => {
    expect(
      shippedEmitters,
      'the JSON-LD emitters on disk and the EMITTERS list above have diverged — a new one ' +
        'is unguarded by both claim gates below, or a listed one no longer emits and its ' +
        'green says nothing'
    ).toEqual(EMITTERS.map(([name]) => name).sort());
  });
});

describe('shipped structured data does not claim the app works offline', () => {
  it('the detector can go red on the entry that was live', () => {
    expect(OFFLINE_KNOWN_VIOLATIONS.filter(text => !OFFLINE_CLAIM.test(text))).toEqual([]);
  });

  it('the detector does not fire on the entries that stay', () => {
    expect(KNOWN_INNOCENTS.filter(text => OFFLINE_CLAIM.test(text))).toEqual([]);
  });

  it.each(EMITTERS)('%s asserts nothing about offline', (name, render, route) => {
    const offenders = jsonLdStrings(render(), route).filter(text => OFFLINE_CLAIM.test(text));

    expect(
      offenders,
      `${name} claims offline capability in JSON-LD: ${offenders.join(' | ')} — ` +
        'the precache is icons only (vite/pwa-config.ts) and a featureList entry cannot ' +
        'carry the "already opened" qualifier that would make it true (GH#224)'
    ).toEqual([]);
  });
});

describe('shipped structured data states no unmeasured performance figure', () => {
  it('the detector can go red on the claims this gate exists to catch', () => {
    expect(KNOWN_VIOLATIONS.filter(text => !LATENCY_CLAIM.test(text))).toEqual([]);
  });

  it('the detector does not fire on versions, durations, dates or counts', () => {
    expect(KNOWN_INNOCENTS.filter(text => LATENCY_CLAIM.test(text))).toEqual([]);
  });

  it.each(EMITTERS)('%s asserts no latency figure', (name, render, route) => {
    const offenders = jsonLdStrings(render(), route).filter(text => LATENCY_CLAIM.test(text));

    expect(
      offenders,
      `${name} states a latency figure in JSON-LD: ${offenders.join(' | ')} — ` +
        'nothing in this repository measures it (.claude/CLAUDE.md -> Performance Targets: ' +
        'targets, never restated as achieved), and JSON-LD cannot carry the caveat that ' +
        'would make it honest'
    ).toEqual([]);
  });
});

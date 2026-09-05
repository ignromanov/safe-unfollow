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

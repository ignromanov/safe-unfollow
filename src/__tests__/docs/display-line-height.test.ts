import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const UI_ROOT = join(process.cwd(), 'src', 'components', 'ui');

/**
 * The measured floor. `font-loading.test.ts` records the worst-case ink span of the
 * shipped faces — Plus Jakarta Sans 1.229em, Inter 1.196em — and sets the
 * `h1, h2, h3, .font-display` stylesheet rule to 1.25 accordingly.
 *
 * That rule is only half the guarantee, and the other half is what this file covers:
 * a Tailwind utility at the point of use beats the stylesheet rule, and the existing
 * guard reads the built stylesheet. That is how `leading-none` survived on
 * DialogTitle — an 18px title in an 18px line box needing 21.5px — under a green
 * suite.
 *
 * Scope is the two dialog primitives and nothing else, deliberately. A source-wide
 * scan needs a heuristic for "is this utility on the heading itself or on something
 * nested inside it", and every version of that heuristic either misses the `cn()`
 * call inside the component body — the exact shape of the defect — or fires on
 * PaywallModal's price numeral, a display figure inside a DialogTitle that is
 * deliberately tight and whose rendered output is pinned. The ten `.font-display`
 * call sites carrying a sub-floor leading utility are a type-scale decision to be
 * made on a real device, not a correctness question; see progress.md, "On the
 * owner" item 7.
 */
const BELOW_FLOOR = ['leading-none', 'leading-tight'];
const TITLE_PRIMITIVES = ['dialog.tsx', 'alert-dialog.tsx'];

describe('the dialog primitives clear the measured line-height floor', () => {
  it.each(TITLE_PRIMITIVES)('%s carries no sub-floor leading utility', file => {
    const source = readFileSync(join(UI_ROOT, file), 'utf-8');
    expect(BELOW_FLOOR.filter(utility => source.includes(utility))).toEqual([]);
  });
});

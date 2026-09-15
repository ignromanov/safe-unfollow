import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The `web_vital` sample rate is stated once, at `analytics.webVital` in
 * `src/lib/stats/events.ts`. Two other files used to restate it, and both drifted:
 * they claimed 10% against a gate that has read `Math.random() > 0.03` at every
 * point in the analytics database's lifetime (checked at 2026-07-24, 08-21 and
 * 09-15). Those two files are the ones a developer opens first to answer "how
 * often does this sample", so the wrong number was also the reachable one.
 *
 * Scope, stated so nobody reads this as wider than it is: this guards exactly the
 * two files below against carrying a literal percentage. It does NOT prove the
 * rate is stated only once repo-wide, and it says nothing about any other event.
 * A third file restating the rate would pass.
 */
const ROOT = resolve(__dirname, '../../..');

const FILES_THAT_MUST_NOT_RESTATE_THE_RATE = ['src/lib/web-vitals.ts', 'src/main.tsx'];

describe('web_vital sampling has one source', () => {
  it.each(FILES_THAT_MUST_NOT_RESTATE_THE_RATE)('%s states no percentage of its own', file => {
    const source = readFileSync(resolve(ROOT, file), 'utf8');
    const percentages = source.match(/\d+(\.\d+)?\s?%/g) ?? [];
    expect(percentages).toEqual([]);
  });

  it('the rate itself is declared in events.ts, so the guard has something to point at', () => {
    const events = readFileSync(resolve(ROOT, 'src/lib/stats/events.ts'), 'utf8');
    expect(events).toMatch(/webVital:[\s\S]{0,120}Math\.random\(\)\s*>\s*0\.\d+/);
  });
});

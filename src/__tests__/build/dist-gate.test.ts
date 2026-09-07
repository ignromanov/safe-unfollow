import { describe, it, expect } from 'vitest';
import { distGateMode } from '../utils/dist-gate';

/**
 * Not `describe.runIf(built)` and not `describeDist` — deliberately. This suite tests the gate's
 * own decision, so gating it behind the gate would make it unobservable in exactly the runs where
 * the gate matters. Same shape as `locale-preload.test.ts`: assert the function against inputs,
 * not the artefact against a build.
 */
describe('distGateMode', () => {
  it('runs the suite whenever dist/ is there, promised or not', () => {
    expect(distGateMode(true, undefined)).toBe('run');
    expect(distGateMode(true, '1')).toBe('run');
  });

  it('skips silently when no build was promised — the local case', () => {
    expect(distGateMode(false, undefined)).toBe('skip');
  });

  it('treats an empty EXPECT_DIST as unset, not as a promise', () => {
    // A workflow that declares `EXPECT_DIST: ${{ something-undefined }}` yields '', and an
    // empty string must not arm the loud path: that would fail every job that merely mentions
    // the variable, which is the over-broad failure mode `process.env.CI` already has.
    expect(distGateMode(false, '')).toBe('skip');
  });

  it('fails loudly when a build was promised and dist/ is not there', () => {
    expect(distGateMode(false, '1')).toBe('fail');
    expect(distGateMode(false, 'true')).toBe('fail');
  });

  it('keeps the three outcomes distinct', () => {
    // The control. A refactor that collapses 'fail' into 'skip' restores GH#159 in full while
    // every other assertion above still passes, because each only checks one input.
    const modes = new Set([
      distGateMode(true, undefined),
      distGateMode(false, undefined),
      distGateMode(false, '1'),
    ]);
    expect(modes.size).toBe(3);
  });
});

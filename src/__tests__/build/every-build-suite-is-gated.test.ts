import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * PR #247 routed every dist-dependent suite in this directory through the loud three-outcome
 * gate, whose third outcome turns a missing `dist/` into a red test when `EXPECT_DIST` promised
 * a build. It fixed the twelve instances that existed. It did not fix the class: the next file
 * copied from an older sibling reintroduces the silent `runIf` spelling, which skips without a
 * word under the same conditions, and GH#159 returns one file at a time with every gate green.
 *
 * `progress.md` tried to hold this with prose plus a derivation command. Measured 2026-09-14,
 * that command returned exactly one match, and the match was a docblock sentence saying the
 * file does *not* use the spelling — a grep over source whose comments are still in it measures
 * what an author wrote about the code, not what the code does. Hence: strip comments first, and
 * assert it in a test rather than in a row nobody recomputes.
 *
 * This file is the instrument, so it is excluded from its own subject list rather than added to
 * the exemptions below: the assertion strings it carries are data, and a scan that cannot tell
 * a literal from a call would read them as offences.
 */

const BUILD_DIR = join(process.cwd(), 'src/__tests__/build');
const SELF = 'every-build-suite-is-gated.test.ts';

/**
 * Suites that legitimately run without a `dist/`, each with the reason it needs no gate.
 * An entry is a claim about a file, so the last assertion checks every key still names one:
 * removing a subject from a gate and removing an offence from a subject produce the same green.
 */
const UNGATED_BY_DESIGN: Record<string, string> = {
  'dist-gate.test.ts':
    'tests the gate itself; gating it behind the gate makes it unobservable exactly when it matters',
  'locale-preload.test.ts':
    'asserts the injector function against a fixture manifest, not an artefact against a build',
};

/** Comments carry prose *about* the code and must not be matched as code. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const subjects = readdirSync(BUILD_DIR)
  .filter(f => f.endsWith('.test.ts') && f !== SELF)
  .sort();

function codeOf(file: string): string {
  return stripComments(readFileSync(join(BUILD_DIR, file), 'utf8'));
}

describe('every suite in src/__tests__/build/ is gated loudly or exempt on the record', () => {
  it('finds more subjects than exemptions', () => {
    // The control. A glob that matches nothing satisfies every per-file assertion below.
    expect(subjects.length).toBeGreaterThan(Object.keys(UNGATED_BY_DESIGN).length);
    // Not `expect(subjects).not.toContain(SELF)` — that passes when SELF is misspelt, by
    // comparing a corrupted value against itself. Assert the file is really there and really
    // excluded, which a rename reddens.
    expect(readdirSync(BUILD_DIR)).toContain(SELF);
    expect(subjects).not.toContain(SELF);
  });

  it.each(subjects)('%s is gated by describeDist, or exempt with a reason', file => {
    if (file in UNGATED_BY_DESIGN) {
      expect(UNGATED_BY_DESIGN[file].length).toBeGreaterThan(20);
      return;
    }
    expect(codeOf(file)).toContain('describeDist(');
  });

  it.each(subjects)('%s does not gate with the silent runIf spelling', file => {
    expect(codeOf(file)).not.toMatch(/describe\.runIf\s*\(/);
  });

  it('every exemption names a file that is still here', () => {
    for (const file of Object.keys(UNGATED_BY_DESIGN)) {
      expect(subjects, `${file} is exempted but no longer exists`).toContain(file);
    }
  });
});

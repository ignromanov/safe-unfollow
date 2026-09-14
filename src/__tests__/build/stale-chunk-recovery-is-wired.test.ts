import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { expect, it } from 'vitest';

import { describeDist } from '../utils/dist-gate';

/**
 * The unit tests for `installStaleChunkRecovery` dispatch `vite:preloadError` themselves, because
 * nothing under Vitest can make Vite dispatch it: the helper that does is injected by
 * `vite:build-import-analysis`, which is build-only ("Build only. During serve this is performed
 * as part of ./importAnalysis" — vite/dist/node, v7.3.1). So those tests prove the handler is
 * right and prove nothing about whether anything ever calls it.
 *
 * This is the other half. A listener for an event no shipped code dispatches is a green suite
 * guarding a recovery that cannot happen — and it would look identical to a working one.
 *
 * Both halves are asserted against the same artefact so they cannot drift apart: dropping the
 * `installStaleChunkRecovery()` call from main.tsx, or a Vite upgrade that renames or removes the
 * event, each turns exactly one of these red.
 */
const dist = resolve(__dirname, '../../../dist');
const built = existsSync(dist) && existsSync(join(dist, 'index.html'));

/** `sessionStorage` key from src/lib/stale-chunk-recovery.ts — a string literal survives minification. */
const LISTENER_MARKER = 'stale-chunk-reload';
const VITE_EVENT = 'vite:preloadError';

function builtScripts(): string[] {
  const assets = join(dist, 'assets');
  if (!existsSync(assets)) return [];
  return readdirSync(assets)
    .filter(name => name.endsWith('.js'))
    .map(name => readFileSync(join(assets, name), 'utf-8'));
}

describeDist('the stale-chunk recovery is wired to something that fires', built, () => {
  it('reads a build with scripts in it', () => {
    // Guards the guard: against an empty asset list every "contains" below would be a vacuous
    // false, and the two assertions would fail for a reason that has nothing to do with wiring.
    expect(builtScripts().length).toBeGreaterThan(0);
  });

  it('ships the listener', () => {
    expect(builtScripts().some(code => code.includes(LISTENER_MARKER))).toBe(true);
  });

  it('ships something that dispatches the event it listens for', () => {
    // Vite's own preload helper. If a future version stops dispatching this, the recovery is
    // dead code and this is the line that says so.
    expect(builtScripts().some(code => code.includes(VITE_EVENT))).toBe(true);
  });
});

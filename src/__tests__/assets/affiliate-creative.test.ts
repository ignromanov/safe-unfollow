import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveAffiliateOffer } from '@/config/affiliate-offers';

/** 80 KB. The bandwidth diet (PR #7) exists; a banner must not undo it. */
const BUDGET_BYTES = 80 * 1024;

describe('affiliate creative', () => {
  const creative = resolveAffiliateOffer('en')?.creative;

  it('is declared for the main offer', () => {
    expect(creative).toBeDefined();
  });

  it('is self-hosted, not a third-party URL', () => {
    // Hot-linking would send every visitor's IP to the network on page load,
    // before any click.
    expect(creative?.src).toMatch(/^\/affiliate\//);
  });

  it('exists on disk at the declared path', () => {
    expect(existsSync(resolve('public', creative!.src.replace(/^\//, '')))).toBe(true);
  });

  it('is actually a WebP file, not a renamed GIF, and stays inside the size budget', () => {
    // The filename alone proves nothing — someone could drop a renamed GIF at
    // this exact path and every other assertion here would still pass. A
    // real WebP starts with the ASCII bytes "RIFF" at offset 0 and "WEBP" at
    // offset 8; check those, not the extension.
    const path = resolve('public', creative!.src.replace(/^\//, ''));
    const header = readFileSync(path).subarray(0, 12);
    expect(header.toString('ascii', 0, 4)).toBe('RIFF');
    expect(header.toString('ascii', 8, 12)).toBe('WEBP');

    expect(creative?.src).not.toMatch(/\.gif$/i);
    const bytes = statSync(path).size;
    expect(bytes).toBeLessThanOrEqual(BUDGET_BYTES);
  });
});

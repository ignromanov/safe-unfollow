import { existsSync, statSync } from 'node:fs';
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

  it('is not a GIF and stays inside the size budget', () => {
    expect(creative?.src).not.toMatch(/\.gif$/i);
    const bytes = statSync(resolve('public', creative!.src.replace(/^\//, ''))).size;
    expect(bytes).toBeLessThanOrEqual(BUDGET_BYTES);
  });
});

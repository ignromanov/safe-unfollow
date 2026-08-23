import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveAffiliateOffer } from '@/config/affiliate-offers';

import type { AffiliateCreativeVariant } from '@/config/affiliate-offers';

/** 80 KB. The bandwidth diet (PR #7) exists; a banner must not undo it. */
const BUDGET_BYTES = 80 * 1024;

/**
 * Canvas size straight out of the WebP header.
 *
 * The point is to read what the *file* is, never what its name or the registry
 * claims it is. All three chunk layouts are handled because a re-encode can
 * silently change which one the encoder emits, and a parser that understood
 * only today's chunk would start skipping the check instead of failing it.
 *
 * Layouts per the container spec: VP8 (lossy) keeps 14-bit dimensions at byte
 * 26; VP8L (lossless) packs width-1 and height-1 into 28 bits at byte 21;
 * VP8X (extended) stores canvas-1 as two 24-bit LE values at byte 24.
 */
function readWebPSize(bytes: Buffer): { width: number; height: number } {
  expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
  expect(bytes.toString('ascii', 8, 12)).toBe('WEBP');

  const chunk = bytes.toString('ascii', 12, 16);

  if (chunk === 'VP8 ') {
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff,
    };
  }

  if (chunk === 'VP8L') {
    const packed = bytes.readUInt32LE(21);
    return {
      width: (packed & 0x3fff) + 1,
      height: ((packed >> 14) & 0x3fff) + 1,
    };
  }

  if (chunk === 'VP8X') {
    return {
      width: (bytes.readUIntLE(24, 3) & 0xffffff) + 1,
      height: (bytes.readUIntLE(27, 3) & 0xffffff) + 1,
    };
  }

  throw new Error(`unrecognised WebP chunk "${chunk}" — extend the parser, do not skip the check`);
}

const offer = resolveAffiliateOffer('en');
const creative = offer?.creative;

/** Every cut the registry declares, labelled for a readable failure. */
const variants: ReadonlyArray<readonly [string, AffiliateCreativeVariant]> = [
  ...(creative ? ([['base', creative.base]] as const) : []),
];

describe('affiliate creative', () => {
  it('is declared for the main offer', () => {
    expect(creative).toBeDefined();
    expect(variants.length).toBeGreaterThan(0);
  });

  it.each(variants)('%s: is self-hosted, not a third-party URL', (_label, variant) => {
    // Hot-linking would send every visitor's IP to the network on page load,
    // before any click.
    expect(variant.src).toMatch(/^\/affiliate\//);
  });

  it.each(variants)('%s: is versioned, so an immutable cache stays safe', (_label, variant) => {
    // `vercel.json` caches `/affiliate/*` for a year with `immutable`. Reusing a
    // filename after that rule exists would pin returning visitors to the old
    // creative until their cache expired, with no way to push a correction.
    expect(variant.src).toMatch(/-v\d+-/);
  });

  it.each(variants)('%s: exists on disk at the declared path', (_label, variant) => {
    expect(existsSync(resolve('public', variant.src.replace(/^\//, '')))).toBe(true);
  });

  it.each(variants)(
    '%s: is a real WebP whose pixels match the registry, and fits the budget',
    (_label, variant) => {
      // Three separate lies this catches, none of which the filename can:
      // a renamed GIF, a re-crop that changed the aspect ratio, and a bloated
      // re-encode. The dimension check is the one that matters most — the
      // registry's width/height become the browser's aspect-ratio reservation,
      // so a wrong pair here is a layout shift that jsdom can never observe.
      const path = resolve('public', variant.src.replace(/^\//, ''));
      const bytes = readFileSync(path);

      expect(readWebPSize(bytes)).toEqual({ width: variant.width, height: variant.height });
      expect(variant.src).not.toMatch(/\.gif$/i);
      expect(bytes.byteLength).toBeLessThanOrEqual(BUDGET_BYTES);
    }
  );
});

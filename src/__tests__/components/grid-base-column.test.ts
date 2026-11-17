import { describe, expect, it } from 'vitest';

/**
 * A grid that only gains columns at a breakpoint has, below it, one implicit `auto` track —
 * and an `auto` track's minimum is the min-content width of its widest child. A fixed-width
 * child (an AdSense iframe is one) then widens the whole column past the viewport, and the
 * phone layout shifts sideways. `grid-cols-1` is `minmax(0, 1fr)`, which drops that minimum.
 * Found on /upload on a phone, 2026-11-16 (`UploadZone.tsx`, ~15px).
 *
 * Text-level and on purpose: jsdom computes no layout, so a render test would pass with the
 * defect in place. Grids hidden below the breakpoint (`hidden md:grid`) are exempt.
 */
const SOURCES = import.meta.glob<string>('/src/**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const CLASS_ATTR = /className="([^"]*)"/g;
const tokens = (cls: string) => cls.split(/\s+/).filter(Boolean);

function offenders(): string[] {
  const out: string[] = [];
  for (const [file, source] of Object.entries(SOURCES)) {
    for (const [, cls] of source.matchAll(CLASS_ATTR)) {
      const t = tokens(cls);
      if (!t.includes('grid')) continue;
      const responsive = t.some(x => /^(sm|md|lg|xl|2xl):grid-cols-/.test(x));
      const base = t.some(x => x.startsWith('grid-cols-'));
      if (responsive && !base) out.push(`${file}: "${cls}"`);
    }
  }
  return out;
}

describe('responsive grids declare their base column', () => {
  it('every grid with breakpoint columns also has a grid-cols-* below the breakpoint', () => {
    expect(offenders()).toEqual([]);
  });

  it('the scan sees the grids it is meant to see (control)', () => {
    const scanned = Object.values(SOURCES).join('\n');
    expect(scanned).toContain('lg:grid-cols-4');
    expect(Object.keys(SOURCES).some(f => f.endsWith('/UploadZone.tsx'))).toBe(true);
  });
});

/**
 * The outline variant used to make its own label vanish under the cursor.
 *
 * `hover:bg-accent hover:text-accent-foreground` is the shadcn default, and it
 * holds only while the hover surface really is `--accent`. This project also
 * overrides the surface per theme with `dark:hover:bg-input/50` — but not the
 * foreground, so `--accent-foreground` (near-black) landed on `--input`
 * (near-black) at 1.16:1. Light mode failed too, for the opposite reason:
 * near-white `--accent-foreground` on the vivid `--accent` is 3.50:1.
 *
 * The tests below do not hardcode which foreground token is correct. They read
 * whichever one the variant declares and measure it against both hover
 * surfaces, so reintroducing the old pairing fails on the numbers rather than
 * on a string comparison.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button, buttonVariants } from '@/components/ui/button';
import { contrastRatio, over, readThemeTokens, token, WCAG_AA_NORMAL } from '@tests/utils/contrast';

const outline = buttonVariants({ variant: 'outline' });
const ghost = buttonVariants({ variant: 'ghost' });

/** The token named by the variant's `hover:text-*` utility, e.g. `--foreground`. */
function hoverForegroundToken(classes: string): string {
  const match = classes.match(/(?:^|\s)hover:text-([a-z-]+)/);
  if (!match) throw new Error(`variant declares no hover:text-* class: ${classes}`);
  return `--${match[1]}`;
}

describe('button outline variant', () => {
  it('still renders and carries its hover surface classes', () => {
    render(<Button variant="outline">Cancel</Button>);

    const button = screen.getByRole('button', { name: 'Cancel' });
    expect(button).toHaveClass('hover:bg-accent', 'dark:hover:bg-input/50');
  });

  it('sets no resting text colour, so the label inherits the surface it sits on', () => {
    // Any *colour* `text-*` must be hover-scoped; a resting one would override
    // the ambient colour wherever an outline button is placed. Resolving the
    // suffix against the real theme tokens keeps size utilities like `text-sm`
    // out of it without maintaining a denylist.
    const colourNames = Object.keys(readThemeTokens('light')).map(t => t.replace(/^--/, ''));
    const isTextColour = (cls: string) => {
      if (!cls.startsWith('text-')) return false;
      const suffix = cls.slice('text-'.length);
      return colourNames.includes(suffix) || suffix === 'white' || suffix === 'black';
    };

    const restingColour = outline.split(/\s+/).filter(c => !c.includes(':') && isTextColour(c));
    expect(restingColour).toEqual([]);
  });

  describe('light hover', () => {
    it('keeps the label legible on --accent', () => {
      const fg = token('light', hoverForegroundToken(outline));
      expect(contrastRatio(fg, token('light', '--accent'))).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });
  });

  describe('dark hover', () => {
    // `hover:bg-accent` is unscoped, but in dark it is overridden by
    // `dark:hover:bg-input/50`, so that is the surface to measure against.
    // --popover is where the only outline button in the app actually sits
    // (AlertDialogCancel, in the clear-data dialog); --background covers any
    // future placement on the page itself.
    for (const surface of ['--popover', '--background'] as const) {
      it(`keeps the label legible on dark:hover:bg-input/50 over ${surface}`, () => {
        const fg = token('dark', hoverForegroundToken(outline));
        const blended = over(token('dark', '--input'), 0.5, token('dark', surface));
        expect(contrastRatio(fg, blended)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      });
    }
  });
});

/**
 * `ghost` carried the identical defect and needed the identical fix. It is not a
 * copy of the outline suite though: ghost's dark hover surface is `accent/50`,
 * not `input/50`, and that difference is the whole reason correcting
 * `--accent-foreground` was not sufficient on its own — a token that is right on
 * flat accent is wrong on accent composited over a dark page.
 */
describe('button ghost variant', () => {
  it('still renders and carries its hover surface classes', () => {
    render(<Button variant="ghost">Clear</Button>);

    const button = screen.getByRole('button', { name: 'Clear' });
    expect(button).toHaveClass('hover:bg-accent', 'dark:hover:bg-accent/50');
  });

  it('sets no resting text colour, so the label inherits the surface it sits on', () => {
    const colourNames = Object.keys(readThemeTokens('light')).map(t => t.replace(/^--/, ''));
    const isTextColour = (cls: string) => {
      if (!cls.startsWith('text-')) return false;
      const suffix = cls.slice('text-'.length);
      return colourNames.includes(suffix) || suffix === 'white' || suffix === 'black';
    };

    expect(ghost.split(/\s+/).filter(c => !c.includes(':') && isTextColour(c))).toEqual([]);
  });

  it('keeps the label legible on the light hover surface (flat --accent)', () => {
    const fg = token('light', hoverForegroundToken(ghost));
    expect(contrastRatio(fg, token('light', '--accent'))).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
  });

  // --card is the SearchBar's surface on /results; --background covers the page.
  for (const surface of ['--background', '--card'] as const) {
    it(`keeps the label legible on dark:hover:bg-accent/50 over ${surface}`, () => {
      const fg = token('dark', hoverForegroundToken(ghost));
      const blended = over(token('dark', '--accent'), 0.5, token('dark', surface));
      expect(contrastRatio(fg, blended)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });
  }
});

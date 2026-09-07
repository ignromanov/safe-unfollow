import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Sheet, SheetContent } from '@/components/ui/sheet';

/**
 * jsdom performs no layout, so these assert the *declarations* a design
 * review found missing or wrong — not what they look like on a real screen.
 * The visual half (does the opaque header actually cover scrolling content
 * and stop swallowing a tap, does the last row clear the iOS home indicator)
 * is on `.claude/owner-device-checks.md` and needs a real phone.
 */
describe('SheetContent', () => {
  it('gives the sticky header row its own opaque background, not just the content box', () => {
    render(
      <Sheet open>
        <SheetContent title="Filters">
          <button aria-label="Add Followers filter">Followers</button>
        </SheetContent>
      </Sheet>
    );

    // Queried by data-slot, not by searching the whole dialog for `bg-card`:
    // the content box also carries `bg-card`, so a search that did not scope
    // to the header row specifically would pass against the pre-fix markup,
    // where the sticky close control had no background of its own at all
    // (`rgba(0, 0, 0, 0)`, measured) and content scrolled underneath it.
    const header = document.querySelector('[data-slot="sheet-header"]');
    expect(header).not.toBeNull();
    expect(header?.className).toContain('sticky');
    expect(header?.className).toContain('bg-card');
  });

  it('exposes aria-labelledby pointing at a rendered title node', () => {
    render(
      <Sheet open>
        <SheetContent title="Filters">
          <p>option</p>
        </SheetContent>
      </Sheet>
    );

    const dialog = screen.getByRole('dialog');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();

    // Assert the wiring, not the string: the id Radix generated for the
    // title actually resolves to an element carrying the title's text.
    const titleNode = document.getElementById(labelledBy as string);
    expect(titleNode).not.toBeNull();
    expect(titleNode).toHaveTextContent('Filters');
  });

  it('still labels the sheet from a rendered title node when the caller only passes aria-label', () => {
    render(
      <Sheet open>
        <SheetContent aria-label="Filters">
          <p>option</p>
        </SheetContent>
      </Sheet>
    );

    // The fallback path (no explicit `title`) must not fall back to the bare
    // `aria-label` attribute alone — it still renders a real Title node, sr-only.
    const dialog = screen.getByRole('dialog');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy as string)).toHaveTextContent('Filters');
  });

  it('pads the bottom for the iOS safe area, and only below `sm`', () => {
    render(
      <Sheet open>
        <SheetContent title="Filters">
          <p>option</p>
        </SheetContent>
      </Sheet>
    );

    expect(screen.getByRole('dialog').className).toContain(
      'max-sm:pb-[calc(1.75rem+env(safe-area-inset-bottom))]'
    );
  });

  it('is a bottom sheet only below `sm`, and a width-capped centred dialog at `sm` and up', () => {
    render(
      <Sheet open>
        <SheetContent title="Filters">
          <p>option</p>
        </SheetContent>
      </Sheet>
    );

    const dialogClassName = screen.getByRole('dialog').className;

    // Bottom-anchoring geometry: scoped to max-sm:, not the base class list.
    expect(dialogClassName).toContain('max-sm:inset-x-0');
    expect(dialogClassName).toContain('max-sm:bottom-0');
    expect(dialogClassName).toContain('max-sm:rounded-t-4xl');

    // A width cap exists at sm and above.
    expect(dialogClassName).toContain('sm:max-w-lg');

    // ...and a width for that cap to cap. This assertion is the point of the
    // test's title: a `position: fixed` box with `left` set, `right: auto`
    // and `width: auto` is shrink-to-fit, so a `max-width` alone leaves the
    // panel's width to its content's max-content size — it would change
    // between locales, since German and French badge labels are longer than
    // the English ones. `dialog.tsx`'s `DialogContent` carries `w-full`
    // beside its own `sm:max-w-lg` for exactly this reason.
    //
    // Derived, not a literal: the utility only counts if it applies at `sm`
    // and up, so a bare `w-*` or an `sm:w-*` passes and a `max-sm:w-*`
    // (which stops at the breakpoint this test names) does not.
    const widthAtSmAndUp = dialogClassName.split(/\s+/).filter(c => /^(?:sm:)?w-/.test(c));
    expect(
      widthAtSmAndUp,
      'no width declaration applies at `sm` and up, so `sm:max-w-lg` caps a width the content decides'
    ).not.toEqual([]);
  });
});

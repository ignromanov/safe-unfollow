import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ExportSheet } from '@/components/export/ExportSheet';

describe('ExportSheet', () => {
  it('renders its children inside a dialog', () => {
    render(
      <ExportSheet open onOpenChange={vi.fn()}>
        <p>body</p>
      </ExportSheet>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('carries the bottom-sheet geometry the paywall was drawn against', () => {
    render(
      <ExportSheet open onOpenChange={vi.fn()}>
        <p>body</p>
      </ExportSheet>
    );

    // The four that decide it is a sheet and not a centred card. Asserting the
    // whole string would break on any unrelated class being added.
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-sm:bottom-0');
    expect(dialog.className).toContain('max-sm:rounded-t-3xl');
    expect(dialog.className).toContain('max-sm:translate-y-0');
    expect(dialog.className).toContain('max-sm:max-h-[90dvh]');
  });

  it('hides Radix’s own close button when the caller draws its own', () => {
    // Queried by data-slot, not by accessible name: the X's label comes from
    // t('buttons.close') in the `common` namespace, and this suite mocks only
    // `results`. A name query would pass or fail on the mock's shape rather than
    // on the prop under test.
    const { container, rerender } = render(
      <ExportSheet open onOpenChange={vi.fn()}>
        <p>body</p>
      </ExportSheet>
    );
    expect(document.querySelector('[data-slot="dialog-close"]')).not.toBeNull();

    rerender(
      <ExportSheet open onOpenChange={vi.fn()} showCloseButton={false}>
        <p>body</p>
      </ExportSheet>
    );
    expect(document.querySelector('[data-slot="dialog-close"]')).toBeNull();
    expect(container).toBeTruthy();
  });
});

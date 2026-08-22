import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mocked at the leaf, not at LicenseDialogMount itself — this file exists to
// exercise the real Suspense/lazy/memo composition that Layout.test.tsx mocks
// away wholesale. LicenseDialog's own behavior is covered by LicenseDialog.test.tsx.
vi.mock('@/components/export/LicenseDialog', () => ({
  LicenseDialog: vi.fn(() => <div data-testid="license-dialog-leaf" />),
}));

import { LicenseDialog } from '@/components/export/LicenseDialog';
import { LicenseDialogMount } from '@/components/export/LicenseDialogMount';
import { registerExportOpener } from '@/lib/export/export-opener';

describe('LicenseDialogMount', () => {
  // Nothing clears mocks globally (vitest.setup.ts sets no clearMocks), and every
  // case below reads mock.calls[0] — without this each would assert against the
  // first test's render.
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards props to LicenseDialog, renaming licenseKey to initialKey and hardcoding source', async () => {
    const onOpenChange = vi.fn();

    render(
      <LicenseDialogMount
        licenseKey="38b1460a-5104-4067-a91d-77b872934d51"
        open
        onOpenChange={onOpenChange}
      />
    );

    // The real lazy() import resolves asynchronously — unlike Layout.test.tsx,
    // where LicenseDialogMount itself is mocked as synchronous, this render
    // genuinely suspends for one tick.
    await screen.findByTestId('license-dialog-leaf');

    const [props] = vi.mocked(LicenseDialog).mock.calls[0];
    expect(props).toEqual({
      open: true,
      onOpenChange,
      initialKey: '38b1460a-5104-4067-a91d-77b872934d51',
      source: 'redirect',
    });
  });

  // The defect this pair covers: a buyer coming back from checkout was the one
  // reader whose activation could not reach the format dialog, because this
  // mount passed no onContinue at all and LicenseDialog draws that button only
  // when it has one. `toEqual` above ignores an undefined property, so asserting
  // the absence explicitly is what makes the two cases distinguishable here.
  it('offers no handoff while no export control is mounted', async () => {
    render(<LicenseDialogMount licenseKey="key-1" open onOpenChange={vi.fn()} />);
    await screen.findByTestId('license-dialog-leaf');

    const [props] = vi.mocked(LicenseDialog).mock.calls[0];
    expect(props.onContinue).toBeUndefined();
  });

  it('hands off to the mounted export control, closing itself first', async () => {
    const onOpenChange = vi.fn();
    const openFormatDialog = vi.fn();
    const unregister = registerExportOpener(openFormatDialog);

    try {
      render(<LicenseDialogMount licenseKey="key-1" open onOpenChange={onOpenChange} />);
      await screen.findByTestId('license-dialog-leaf');

      const [props] = vi.mocked(LicenseDialog).mock.calls[0];
      expect(props.onContinue).toBeInstanceOf(Function);

      props.onContinue?.();

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(openFormatDialog).toHaveBeenCalledTimes(1);
    } finally {
      // Inside act(): unregistering notifies the store while this mount is still
      // rendered, and that re-render is a real state update React warns about
      // otherwise.
      act(() => {
        unregister();
      });
    }
  });

  it('is memoized — the docblock names this load-bearing against React #421, so dropping memo() must fail this test', () => {
    // React.memo() marks its return value with this symbol; a plain function
    // component has no $$typeof at all. Asserting on the symbol, not just
    // "the component renders", is what makes a future accidental removal of
    // memo() visible here instead of only as an intermittent console warning
    // in production.
    expect(LicenseDialogMount.$$typeof).toBe(Symbol.for('react.memo'));
  });
});

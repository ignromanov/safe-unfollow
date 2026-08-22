import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import resultsEN from '@/locales/en/results.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(resultsEN));

vi.mock('@/lib/export/license', () => ({
  activateLicense: vi.fn(),
  isLicenseKeyFormat: (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim()),
}));

vi.mock('@/lib/stats', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/stats')>();
  return {
    ...actual,
    analytics: {
      ...actual.analytics,
      purchaseSuccess: vi.fn(),
      licenseRestored: vi.fn(),
      licenseError: vi.fn(),
    },
  };
});

import { LicenseDialog } from '@/components/export/LicenseDialog';
import { activateLicense } from '@/lib/export/license';
import { getStoredLicense, resetUnlockCache, storeLicense } from '@/lib/export/unlock';
import { analytics } from '@/lib/stats';

const KEY = '38b1460a-5104-4067-a91d-77b872934d51';
const INSTANCE = 'f90ec370-fd83-46a5-8bbd-44a241e78665';
const OTHER_KEY = '9f6c5b2a-1234-4d5e-8f9a-0b1c2d3e4f5a';
const OTHER_INSTANCE = 'a1b2c3d4-5e6f-4789-9abc-def012345678';

describe('LicenseDialog', () => {
  beforeEach(() => {
    localStorage.clear();
    resetUnlockCache();
    vi.clearAllMocks();
  });

  it('should activate immediately when opened with a key from the redirect', async () => {
    vi.mocked(activateLicense).mockResolvedValue({ ok: true, instanceId: INSTANCE });

    render(<LicenseDialog open initialKey={KEY} source="redirect" onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(activateLicense).toHaveBeenCalledWith(KEY);
    });
    await waitFor(() => {
      expect(getStoredLicense()).toEqual({ v: 1, key: KEY, instanceId: INSTANCE });
    });
    expect(analytics.purchaseSuccess).toHaveBeenCalled();
  });

  it('should confirm the unlock instead of closing itself', async () => {
    const onOpenChange = vi.fn();
    vi.mocked(activateLicense).mockResolvedValue({ ok: true, instanceId: INSTANCE });

    render(<LicenseDialog open initialKey={KEY} source="redirect" onOpenChange={onOpenChange} />);

    expect(await screen.findByText(resultsEN.export.license.successTitle)).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('should show the activation-limit message and report the reason', async () => {
    vi.mocked(activateLicense).mockResolvedValue({ ok: false, reason: 'limit_reached' });

    render(<LicenseDialog open initialKey={KEY} source="redirect" onOpenChange={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      resultsEN.export.license.blockedTitle
    );
    expect(analytics.licenseError).toHaveBeenCalledWith('limit_reached');
    expect(getStoredLicense()).toBeNull();
  });

  it('should show the not-found message for an unknown key', async () => {
    vi.mocked(activateLicense).mockResolvedValue({ ok: false, reason: 'not_found' });

    render(<LicenseDialog open initialKey={KEY} source="redirect" onOpenChange={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      resultsEN.export.license.errorNotFound
    );
  });

  it('should show the revoked message when the license was disabled', async () => {
    vi.mocked(activateLicense).mockResolvedValue({ ok: false, reason: 'disabled' });

    render(<LicenseDialog open initialKey={KEY} source="redirect" onOpenChange={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      resultsEN.export.license.revokedTitle
    );
  });

  it('should show the generic message for a network failure and allow a retry', async () => {
    const user = userEvent.setup();
    vi.mocked(activateLicense)
      .mockResolvedValueOnce({ ok: false, reason: 'network' })
      .mockResolvedValueOnce({ ok: true, instanceId: INSTANCE });

    render(<LicenseDialog open initialKey={KEY} source="redirect" onOpenChange={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      resultsEN.export.license.errorGeneric
    );

    await user.click(screen.getByRole('button', { name: resultsEN.export.license.retry }));

    await waitFor(() => {
      expect(getStoredLicense()).not.toBeNull();
    });
  });

  it('should render the manual form when opened without a key', () => {
    render(<LicenseDialog open initialKey={null} source="manual" onOpenChange={vi.fn()} />);

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(activateLicense).not.toHaveBeenCalled();
  });

  it('should reject a malformed key without spending a request', async () => {
    const user = userEvent.setup();

    render(<LicenseDialog open initialKey={null} source="manual" onOpenChange={vi.fn()} />);

    await user.type(screen.getByRole('textbox'), 'nope');
    await user.click(screen.getByRole('button', { name: resultsEN.export.license.submit }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      resultsEN.export.license.errorFormat
    );
    expect(activateLicense).not.toHaveBeenCalled();
  });

  it('should report a manual activation as restored, not as a purchase', async () => {
    const user = userEvent.setup();
    vi.mocked(activateLicense).mockResolvedValue({ ok: true, instanceId: INSTANCE });

    render(<LicenseDialog open initialKey={null} source="manual" onOpenChange={vi.fn()} />);

    await user.type(screen.getByRole('textbox'), KEY);
    await user.click(screen.getByRole('button', { name: resultsEN.export.license.submit }));

    await waitFor(() => {
      expect(analytics.licenseRestored).toHaveBeenCalled();
    });
    expect(analytics.purchaseSuccess).not.toHaveBeenCalled();
  });

  it('should not re-activate when a re-render passes a new onOpenChange identity', async () => {
    vi.mocked(activateLicense).mockResolvedValue({ ok: false, reason: 'network' });

    const { rerender } = render(
      <LicenseDialog open initialKey={KEY} source="redirect" onOpenChange={() => {}} />
    );

    await waitFor(() => {
      expect(activateLicense).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    // Simulates the most common way a parent wires onOpenChange: a fresh
    // inline closure on every render. The activation must not repeat —
    // activateLicense() is not idempotent and each key gets only 3 devices.
    rerender(<LicenseDialog open initialKey={KEY} source="redirect" onOpenChange={() => {}} />);

    expect(activateLicense).toHaveBeenCalledTimes(1);
  });

  it('should not re-activate a key that is already stored on this device', async () => {
    // Simulates clicking the receipt-email link a second time on a device
    // that already activated this key. activateLicense() is not idempotent —
    // it mints a new device instance every call — so re-clicking must be a
    // no-op rather than spending another of the 3 allowed activations.
    storeLicense(KEY, INSTANCE);
    const onOpenChange = vi.fn();

    render(<LicenseDialog open initialKey={KEY} source="redirect" onOpenChange={onOpenChange} />);

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(activateLicense).not.toHaveBeenCalled();
  });

  it('should still activate a different key even when another license is already stored', async () => {
    // A customer who buys a second key must be able to activate it — the
    // guard above must compare keys, not merely check "is something stored".
    storeLicense(KEY, INSTANCE);
    vi.mocked(activateLicense).mockResolvedValue({ ok: true, instanceId: OTHER_INSTANCE });

    render(<LicenseDialog open initialKey={OTHER_KEY} source="redirect" onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(activateLicense).toHaveBeenCalledWith(OTHER_KEY);
    });
    await waitFor(() => {
      expect(getStoredLicense()).toEqual({ v: 1, key: OTHER_KEY, instanceId: OTHER_INSTANCE });
    });
  });

  it('should show the manual form for an empty initialKey instead of activating', () => {
    render(<LicenseDialog open initialKey="" source="redirect" onOpenChange={vi.fn()} />);

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(activateLicense).not.toHaveBeenCalled();
  });

  it('should not offer a retry for a permanently unrecoverable reason', async () => {
    vi.mocked(activateLicense).mockResolvedValue({ ok: false, reason: 'limit_reached' });

    render(<LicenseDialog open initialKey={KEY} source="redirect" onOpenChange={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      resultsEN.export.license.blockedTitle
    );
    expect(
      screen.queryByRole('button', { name: resultsEN.export.license.retry })
    ).not.toBeInTheDocument();
  });

  it('should render a stable description for the redirect flow without triggering the Radix a11y warning', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(activateLicense).mockResolvedValue({ ok: true, instanceId: INSTANCE });

    render(<LicenseDialog open initialKey={KEY} source="redirect" onOpenChange={vi.fn()} />);

    // Radix portals DialogContent into document.body, not the RTL container.
    // The description stays fixed (not "Activating…") so the role="status"
    // region is the only element announcing that state change — otherwise a
    // screen reader would hear "Activating…" twice.
    expect(document.body.querySelector('[data-slot="dialog-description"]')).toHaveTextContent(
      resultsEN.export.paywall.instantNote
    );

    await waitFor(() => {
      expect(activateLicense).toHaveBeenCalled();
    });

    const loggedMissingDescription = consoleSpy.mock.calls.some(args =>
      args.some(arg => typeof arg === 'string' && /description/i.test(arg))
    );
    expect(loggedMissingDescription).toBe(false);

    consoleSpy.mockRestore();
  });

  it('should mask the key rather than printing it', async () => {
    vi.mocked(activateLicense).mockResolvedValue({ ok: true, instanceId: 'inst-1' });

    render(<LicenseDialog open initialKey={KEY} source="redirect" onOpenChange={vi.fn()} />);

    await screen.findByText(resultsEN.export.license.successTitle);
    expect(screen.queryByText(KEY)).not.toBeInTheDocument();
    expect(screen.getByText(new RegExp(KEY.slice(-4)))).toBeInTheDocument();
  });

  it('should offer a route out of the device cap instead of a dead sentence', async () => {
    vi.mocked(activateLicense).mockResolvedValue({ ok: false, reason: 'limit_reached' });

    render(<LicenseDialog open initialKey={KEY} source="redirect" onOpenChange={vi.fn()} />);

    expect(await screen.findByText(resultsEN.export.license.blockedTitle)).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:refunds@safeunfollow.app')
    );
  });

  it('should let a bad key from the purchase email be retyped by hand', async () => {
    vi.mocked(activateLicense).mockResolvedValue({ ok: false, reason: 'not_found' });
    const user = userEvent.setup();

    render(<LicenseDialog open initialKey={KEY} source="redirect" onOpenChange={vi.fn()} />);

    await user.click(
      await screen.findByRole('button', { name: resultsEN.export.license.enterManually })
    );
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should not render the manual form or Submit alongside a terminal error', async () => {
    // Reproduces the exact combination the whole-branch review found: no key from a
    // redirect (hasActivationKey === false), the manual form already showing (the
    // default when there is no key), and a terminal reason. Before the fix this
    // rendered TerminalErrorBody, the Input and Submit, and the mailto link all at
    // once — two primary-styled actions under a screen saying the cap is reached.
    vi.mocked(activateLicense).mockResolvedValue({ ok: false, reason: 'limit_reached' });
    const user = userEvent.setup();

    render(<LicenseDialog open initialKey={null} source="manual" onOpenChange={vi.fn()} />);

    await user.type(screen.getByRole('textbox'), KEY);
    await user.click(screen.getByRole('button', { name: resultsEN.export.license.submit }));

    expect(await screen.findByText(resultsEN.export.license.blockedTitle)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: resultsEN.export.license.submit })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: resultsEN.export.license.emailSupport })
    ).toHaveAttribute('href', expect.stringContaining('mailto:refunds@safeunfollow.app'));
  });

  it('should hand the reader on to the format choice when the caller supplied one', async () => {
    vi.mocked(activateLicense).mockResolvedValue({ ok: true, instanceId: 'inst-1' });
    const onContinue = vi.fn();
    const user = userEvent.setup();

    render(
      <LicenseDialog
        open
        initialKey={KEY}
        source="manual"
        onOpenChange={vi.fn()}
        onContinue={onContinue}
      />
    );

    await user.click(
      await screen.findByRole('button', { name: resultsEN.export.license.continue })
    );
    expect(onContinue).toHaveBeenCalledOnce();
  });
});

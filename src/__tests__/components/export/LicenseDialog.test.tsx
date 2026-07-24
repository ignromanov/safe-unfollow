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
import { getStoredLicense, resetUnlockCache } from '@/lib/export/unlock';
import { analytics } from '@/lib/stats';

const KEY = '38b1460a-5104-4067-a91d-77b872934d51';
const INSTANCE = 'f90ec370-fd83-46a5-8bbd-44a241e78665';

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

  it('should close itself after a successful redirect activation', async () => {
    const onOpenChange = vi.fn();
    vi.mocked(activateLicense).mockResolvedValue({ ok: true, instanceId: INSTANCE });

    render(<LicenseDialog open initialKey={KEY} source="redirect" onOpenChange={onOpenChange} />);

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('should show the activation-limit message and report the reason', async () => {
    vi.mocked(activateLicense).mockResolvedValue({ ok: false, reason: 'limit_reached' });

    render(<LicenseDialog open initialKey={KEY} source="redirect" onOpenChange={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(resultsEN.export.license.errorLimit);
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

    expect(await screen.findByRole('alert')).toHaveTextContent(resultsEN.export.license.revoked);
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
});

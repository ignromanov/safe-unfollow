import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import resultsEN from '@/locales/en/results.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(resultsEN));

import { PaywallModal, type PaywallModalProps } from '@/components/export/PaywallModal';

function renderModal(overrides: Partial<PaywallModalProps> = {}) {
  const props: PaywallModalProps = {
    open: true,
    onOpenChange: vi.fn(),
    onCheckout: vi.fn(),
    onManualEntry: vi.fn(),
    savedFilename: 'unfollowers.csv',
    totalRows: 8930,
    checkoutState: 'idle',
    ...overrides,
  };
  return { props, ...render(<PaywallModal {...props} />) };
}

describe('PaywallModal checkout states', () => {
  it('should offer a pressable CTA while idle', () => {
    renderModal();

    expect(screen.getByRole('button', { name: /unlock export/i })).toBeEnabled();
  });

  // The defect this whole change exists for: two of the six real checkout
  // sessions tapped again at 1.0-1.3s, which is what a control that
  // acknowledges nothing teaches a reader to do.
  it('should disable itself while opening, so the second tap has nothing to press', () => {
    renderModal({ checkoutState: 'opening' });

    const cta = screen.getByRole('button', { name: /opening checkout/i });
    expect(cta).toBeDisabled();
    expect(cta).toHaveAttribute('aria-busy', 'true');
  });

  // touch-action: manipulation removes the 300ms double-tap delay, which is
  // part of what makes a second tap likely in the first place.
  it('should opt the CTA out of the double-tap delay', () => {
    renderModal();

    expect(screen.getByRole('button', { name: /unlock export/i }).className).toContain(
      'touch-manipulation'
    );
  });

  it('should name a cause on failure instead of returning silently to idle', () => {
    renderModal({ checkoutState: 'failed' });

    expect(screen.getByRole('button', { name: /didn.t open/i })).toBeEnabled();
    expect(screen.getByRole('alert')).toHaveTextContent(/did not load/i);
  });

  // A word that asserts safety without evidence is the one word a phishing
  // page also uses.
  it('should never say "secure"', () => {
    renderModal();

    expect(screen.queryByText(/secure/i)).not.toBeInTheDocument();
  });
});

describe('PaywallModal handoff', () => {
  it('should replace the sales argument with the handoff while opening', () => {
    renderModal({ checkoutState: 'opening' });

    expect(screen.getByText(/stays in this browser/i)).toBeInTheDocument();
    expect(screen.queryByText(/accounts matched by this filter/i)).not.toBeInTheDocument();
  });

  // Surface ownership: the handoff carries the crossing, the paywall keeps the
  // terms of the deal. They are on one modal, so the terms do not stop being
  // true when the button is pressed — and they are not restated above it.
  it('should keep the deal terms visible underneath the handoff', () => {
    renderModal({ checkoutState: 'opening' });

    expect(screen.getByText(/up to 3 devices/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /refunds@/i })).toBeInTheDocument();
  });

  it('should show the sales argument in every state but opening', () => {
    renderModal({ checkoutState: 'failed' });

    expect(screen.getByText(/accounts matched by this filter/i)).toBeInTheDocument();
    expect(screen.queryByText(/stays in this browser/i)).not.toBeInTheDocument();
  });

  // The exit has to survive a redirect that never lands, or a hung navigation
  // strands the reader on a screen with one disabled control.
  it('should leave the reader a way out while opening', () => {
    renderModal({ checkoutState: 'opening' });

    expect(screen.getByRole('button', { name: /not now/i })).toBeEnabled();
  });
});

// The subtitle states two amounts side by side — our price and the category's
// monthly range — and both must come from the same country or the sentence
// tells the reader to convert currencies in their head. The timezone is
// stubbed rather than inherited from the host, per the note on
// CheckoutHandoff's equivalent case: without the stub this passes on a
// machine in Berlin and fails on one in Jakarta.
describe('PaywallModal contrast anchor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function stubTimeZone(timeZone: string): void {
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone }),
    } as unknown as Intl.DateTimeFormat);
  }

  // Both amounts recur across the screen (the price is on the CTA and the
  // terms line too), so this asserts against the rendered document rather
  // than a single element — `getByText` would throw on the intentional
  // duplication of `price`.
  it.each([
    ['Asia/Jakarta', 'Rp50.000', 'Rp69.000–169.000'],
    ['Asia/Kolkata', '₹200', '₹399–999'],
    ['Asia/Manila', '₱150', '₱249–499'],
  ])('should show both amounts in the same currency for %s', (timeZone, price, rivals) => {
    stubTimeZone(timeZone);

    renderModal();

    expect(document.body.textContent).toContain(price);
    expect(document.body.textContent).toContain(rivals);
  });

  it('should show both amounts in dollars outside the priced markets', () => {
    stubTimeZone('America/New_York');

    renderModal();

    expect(document.body.textContent).toContain('$7');
    expect(document.body.textContent).toContain('$5–10');
  });
});

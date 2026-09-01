import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import resultsEN from '@/locales/en/results.json';
import { createI18nMock } from '@/__tests__/utils/mockI18n';

vi.mock('react-i18next', () => createI18nMock(resultsEN));

import { CheckoutHandoff } from '@/components/export/CheckoutHandoff';
import { Dialog, DialogContent } from '@/components/ui/dialog';

/**
 * Mounted inside a Dialog because that is the component's actual contract: it
 * is a dialog body, and its heading is the accessible name Radix gives the
 * dialog while the redirect is in flight. Rendering it bare would be testing
 * something the product never renders.
 */
function renderHandoff(rows = 8930) {
  return render(
    <Dialog open onOpenChange={vi.fn()}>
      <DialogContent>
        <CheckoutHandoff rows={rows} />
      </DialogContent>
    </Dialog>
  );
}

describe('CheckoutHandoff', () => {
  it('should state the privacy claim we can actually keep', () => {
    renderHandoff();

    expect(screen.getByText(/stays in this browser/i)).toBeInTheDocument();
  });

  // The narrow claim is the true one and the only one worth making here. The
  // blanket denials are false on this site — it serves ads and loads a third
  // party's checkout — and `src/__tests__/docs/monetization-claims.test.ts`
  // bans them in prose for the same reason.
  it('should not widen the claim into one the product cannot keep', () => {
    renderHandoff();

    expect(screen.queryByText(/no third-party|no tracking|no ads/i)).not.toBeInTheDocument();
  });

  it('should say what is being bought, in the reader own number format', () => {
    renderHandoff();

    expect(screen.getByText(/8,930 rows/)).toBeInTheDocument();
    expect(screen.getByText(/CSV \+ JSON/)).toBeInTheDocument();
  });

  // We do not verify the processor's method list per country. Showing icons we
  // cannot guarantee — to an audience 26.8% of which is Indonesian — is the
  // bet that loses trust at the redirect, so the absence is stated instead.
  it('should state the absence of payment methods rather than guessing at them', () => {
    renderHandoff();

    expect(screen.getByText(/shown on the next page/i)).toBeInTheDocument();
    expect(screen.queryByAltText(/visa|mastercard|qris/i)).not.toBeInTheDocument();
  });

  // This used to read "quote no currency but dollars", and the reasoning was
  // that a converted amount would be a third exchange rate shipping beside two
  // others — $7 ≈ Rp 115 000 implies ~16 400 IDR/USD while id/faq.json already
  // converts $5–10 at ~15 000. The objection was to the *conversion*, not to
  // the currency, and it no longer applies: the local amounts are set in the
  // processor's dashboard in their own currency and read back off the live
  // checkout, so nothing here computes a rate.
  //
  // What remains worth pinning is the invariant that replaced it, and it is a
  // stronger one: this screen quotes whatever the resolver resolved, and the
  // checkout link is built from that same value. The timezone is stubbed rather
  // than inherited from the host — without the stub this case would assert one
  // thing on a machine in Berlin and the opposite on one in Jakarta, and pass
  // in CI for a reason unrelated to what it is checking.
  it('should quote the price its own resolver resolved, and no other', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'Asia/Jakarta' }),
    } as unknown as Intl.DateTimeFormat);

    renderHandoff();

    expect(screen.getByText(/Rp50\.000/)).toBeInTheDocument();
    expect(screen.queryByText(/\$|₹|₱|€/)).not.toBeInTheDocument();

    vi.restoreAllMocks();
  });

  // Surface ownership, pinned. The device cap and the refund are terms of the
  // deal and belong to the paywall, which the reader was on one tap ago and
  // which still shows them underneath. Restating them here would put the same
  // two sentences on the screen twice in a row.
  it('should leave the deal terms to the paywall that still shows them', () => {
    renderHandoff();

    expect(screen.queryByText(/3 devices/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/refund/i)).not.toBeInTheDocument();
  });
});

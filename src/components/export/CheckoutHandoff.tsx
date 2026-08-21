import { useTranslation } from 'react-i18next';

import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface CheckoutHandoffProps {
  /** Rows in the view the sample was cut from — what the buyer is paying for */
  rows: number;
}

/**
 * The last surface we own, shown while the redirect is in flight.
 *
 * It is reachable because the redirect is not instant: `location.href` starts a
 * navigation that the browser only completes when the checkout host answers,
 * and that gap is the 1.0-1.3s in which two of six real buyers pressed the
 * button again (GH#38). The paywall's argument is finished by then — the
 * reader has decided — so the argument is what gets replaced, with the three
 * things a person wants at the moment they leave a site for a payment domain.
 *
 * **What it deliberately does not carry.** The device cap and the refund
 * address are terms of the deal, not crossing anxieties: the reader saw them
 * one tap ago and the paywall still shows them below this block, because the
 * terms do not stop being true when the button is pressed. Restating them here
 * would put the same two sentences on screen twice in a row. The rule the split
 * follows: what the reader needs to *decide* stays on the paywall, what they
 * need to *cross* lives here.
 *
 * The state itself — "Opening checkout…" — is on the control, not repeated as a
 * heading. Same reason LicenseDialog.tsx:154-156 keeps purpose text in its
 * description: a screen reader would otherwise read the status twice.
 */
export function CheckoutHandoff({ rows }: CheckoutHandoffProps) {
  const { t, i18n } = useTranslation('results');

  return (
    // A live region, because this replaces a body the dialog already announced
    // once. Radix names the dialog from DialogTitle on open; a title that
    // changes mid-dialog is announced by nothing otherwise.
    <div role="status" className="flex flex-col gap-3">
      <DialogHeader className="text-start sm:text-start">
        {/* The load-bearing sentence, and the one this screen exists for. It is
            narrow on purpose: the export never leaves the browser, which is
            true and checkable. "No third-party requests" would be false on a
            page that serves ads and is about to load a processor's checkout,
            and `monetization-claims.test.ts` bans that class of denial.

            Sentence-weight rather than headline-weight: it is a statement to
            be read, not a heading to be scanned past. Radix builds the dialog's
            accessible name from it, which is the right name for this state. */}
        <DialogTitle className="text-base leading-normal font-semibold text-foreground">
          {t('export.checkout.privacy')}
        </DialogTitle>
      </DialogHeader>

      {/* The receipt of a decision already taken, not a second sales argument —
          which is why it is a flat line of facts and not the proportion bar the
          paywall makes its case with. Pre-formatted rather than interpolated
          raw: 8930 reads as "8,930" here and "8.930" in de, and the number is
          the part the buyer checks. */}
      <DialogDescription className="text-sm leading-normal text-foreground">
        {t('export.checkout.summary', { rows: rows.toLocaleString(i18n.language) })}
      </DialogDescription>

      {/* A stated absence. We do not verify which methods the processor offers
          in which country, and drawing card logos we cannot guarantee — to an
          audience 26.8% of which is Indonesian and may be looking for QRIS — is
          the bet that loses trust at the redirect. Saying "on the next page"
          costs nothing and cannot be wrong. */}
      <p className="text-xs leading-normal text-muted-foreground">{t('export.checkout.methods')}</p>
    </div>
  );
}

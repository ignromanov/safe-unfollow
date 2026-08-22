import { Check, CircleAlert, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExportSheet } from '@/components/export/ExportSheet';
import { RevokedLicenseNotice, SupportMailtoLink } from '@/components/export/RevokedLicenseNotice';
import { Input } from '@/components/ui/input';
import type { LicenseFailureReason } from '@/lib/export/license';
import { activateLicense, isLicenseKeyFormat } from '@/lib/export/license';
import { SUPPORT_EMAIL } from '@/lib/export/support-email';
import { getStoredLicense, storeLicense } from '@/lib/export/unlock';
import { analytics } from '@/lib/stats';

export interface LicenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Key carried by the checkout redirect; null means "ask the user for it". */
  initialKey: string | null;
  source: 'redirect' | 'manual';
  /** Where "Choose a format" goes. Absent on the redirect mount, which has no view. */
  onContinue?: () => void;
}

type DialogState =
  | { kind: 'form' }
  | { kind: 'activating' }
  | { kind: 'activated' }
  | { kind: 'error'; reason: LicenseFailureReason | 'format' };

type AllReasons = LicenseFailureReason | 'format';

// The two verdicts that get a screen of their own rather than a red sentence. Both are
// permanent and neither is the reader's fault, so both end in the one action that can
// actually resolve them.
const TERMINAL_REASONS = new Set<AllReasons>(['limit_reached', 'disabled', 'invalid']);

/**
 * A type predicate, not a bare `Set.has()` call — the difference matters here.
 * `ERROR_KEYS` below is keyed on exactly the non-terminal reasons, so a reader
 * who narrows `state.reason` with this function (rather than the set directly)
 * gets a compiler proof that a terminal reason can never reach `ERROR_KEYS[...]`.
 * That proof is what closed GH's `errorLimit` bug: the key used to exist for
 * `limit_reached`, which is terminal and was never read through this path —
 * dead copy that `satisfies` alone could not catch, because exhaustiveness
 * over the wrong set still type-checks.
 */
function isTerminalReason(reason: AllReasons): reason is 'limit_reached' | 'disabled' | 'invalid' {
  return TERMINAL_REASONS.has(reason);
}

// 'disabled' and 'invalid' are handled by TerminalErrorBody, not by this map — see
// isTerminalReason above. `as const` keeps the literal dot-paths so `t()` can
// type-check them below.
const ERROR_KEYS = {
  format: 'export.license.errorFormat',
  not_found: 'export.license.errorNotFound',
  invalid_input: 'export.license.errorGeneric',
  network: 'export.license.errorGeneric',
  unknown: 'export.license.errorGeneric',
} as const satisfies Record<Exclude<AllReasons, 'limit_reached' | 'disabled' | 'invalid'>, string>;

// not_found, limit_reached and disabled are permanent verdicts from Dodo —
// the same key fails the same way forever, so offering "Try again" for those
// reasons would just invite a click that cannot help.
const RETRYABLE_REASONS = new Set<AllReasons>(['invalid_input', 'network', 'unknown']);

/**
 * Shows enough of the key to recognise it, and no more.
 *
 * The reader does not need to retype it on the device that just activated — it is
 * already in localStorage. What they need is to tell this key apart from another one in
 * their inbox, which the last four characters do.
 */
function maskKey(key: string): string {
  const tail = key.slice(-4);
  return `${'•'.repeat(8)}${tail}`;
}

// Split out of LicenseDialog itself: the component's own render carries seven
// state-gated blocks already, and folding this one in pushed its cyclomatic
// complexity over the lint ceiling. The markup and classes are unchanged from
// what used to sit inline.
function ActivatedBody({ activatedKey }: { activatedKey: string }) {
  const { t } = useTranslation('results');

  return (
    <div role="status" className="flex flex-col gap-3">
      <DialogHeader className="text-start pe-8">
        {/* The same emerald check ExportDialog's saved screen and the paywall's
            receipt wear, so success looks like success at all three points of this
            one flow. The icon carries no text, so the accessible name Radix builds
            from this title is unchanged. */}
        <DialogTitle className="flex items-center gap-2">
          <Check className="h-5 w-5 shrink-0 text-emerald-500" />
          {t('export.license.successTitle')}
        </DialogTitle>
        <DialogDescription>{t('export.license.successBody')}</DialogDescription>
      </DialogHeader>
      <p className="text-xs text-muted-foreground">{t('export.license.successMeta')}</p>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">
          {t('export.license.keyLabel')}
        </span>
        <span className="rounded-2xl border bg-muted px-3 py-2 font-mono text-sm break-all">
          {maskKey(activatedKey)}
        </span>
        <span className="text-xs leading-normal text-muted-foreground">
          {t('export.license.keyNote')}
        </span>
      </div>
    </div>
  );
}

// Same reason as ActivatedBody: pulled out to keep LicenseDialog's own
// complexity under the lint ceiling, not for reuse — `reason` is always one
// of TERMINAL_REASONS by the time this renders. The `disabled`/`invalid`
// branch is RevokedLicenseNotice, shared with ExportDialog's own revocation
// screen — both describe the identical situation.
function TerminalErrorBody({ reason }: { reason: LicenseFailureReason | 'format' }) {
  const { t } = useTranslation('results');

  if (reason !== 'limit_reached') return <RevokedLicenseNotice />;

  return (
    <div role="alert" className="flex flex-col gap-3">
      {/* Muted, not destructive, and the difference is the copy's: "Your purchase is
          fine — this one cannot be the fourth." A red icon over that sentence would
          contradict it. The shape matches RevokedLicenseNotice so both read as the
          same kind of screen; the colour is what separates a dead end from a limit. */}
      <DialogHeader className="text-start pe-8">
        <DialogTitle className="flex items-center gap-2">
          <CircleAlert className="h-5 w-5 shrink-0 text-muted-foreground" />
          {t('export.license.blockedTitle')}
        </DialogTitle>
        <DialogDescription>{t('export.license.blockedBody')}</DialogDescription>
      </DialogHeader>
      <p className="text-sm leading-normal text-muted-foreground">
        {t('export.license.blockedAction', { email: SUPPORT_EMAIL })}
      </p>
    </div>
  );
}

interface LicenseFooterActionsProps {
  state: DialogState;
  isActivating: boolean;
  showManualForm: boolean;
  hasActivationKey: boolean;
  onContinue?: () => void;
  onDone: () => void;
  onSubmit: () => void;
  onRetry: () => void;
  onEnterManually: () => void;
}

// Same reason as ActivatedBody and TerminalErrorBody: this is the other half
// of LicenseDialog's render that pushed the component over the complexity
// ceiling. Every branch here is unchanged from what used to sit inline in
// DialogFooter.
function LicenseFooterActions({
  state,
  isActivating,
  showManualForm,
  hasActivationKey,
  onContinue,
  onDone,
  onSubmit,
  onRetry,
  onEnterManually,
}: LicenseFooterActionsProps) {
  const { t } = useTranslation('results');
  const isError = state.kind === 'error';
  const isRetryable = isError && RETRYABLE_REASONS.has(state.reason);
  const isTerminal = isError && isTerminalReason(state.reason);

  return (
    <>
      {isActivating ? (
        <Button size="lg" className="min-h-12 rounded-2xl font-bold" disabled aria-busy>
          <div className="animate-spin">
            <Loader2 className="h-4 w-4" />
          </div>
          {t('export.license.activating')}
        </Button>
      ) : null}

      {!isActivating && showManualForm && !isTerminal ? (
        <Button size="lg" className="min-h-12 rounded-2xl font-bold" onClick={onSubmit}>
          {t('export.license.submit')}
        </Button>
      ) : null}

      {!isActivating && hasActivationKey && isRetryable ? (
        <Button size="lg" className="min-h-12 rounded-2xl font-bold" onClick={onRetry}>
          {t('export.license.retry')}
        </Button>
      ) : null}

      {state.kind === 'activated' ? (
        <Button size="lg" className="min-h-12 rounded-2xl font-bold" onClick={onContinue ?? onDone}>
          {onContinue ? t('export.license.continue') : t('export.license.done')}
        </Button>
      ) : null}

      {isTerminal ? <SupportMailtoLink /> : null}

      {isError && hasActivationKey && !isRetryable && !isTerminal ? (
        <Button
          size="lg"
          variant="outline"
          className="min-h-12 rounded-2xl font-bold"
          onClick={onEnterManually}
        >
          {t('export.license.enterManually')}
        </Button>
      ) : null}
    </>
  );
}

/**
 * Activation surface for both entry points: the post-checkout redirect (key in
 * hand, activate on mount) and manual entry on a second device.
 *
 * This is the only place in the app where a paid user can be left with nothing
 * after handing over money, so every failure path ends in a visible message and
 * a retry rather than a console error.
 */
export function LicenseDialog({
  open,
  onOpenChange,
  initialKey,
  source,
  onContinue,
}: LicenseDialogProps) {
  const { t } = useTranslation('results');
  // A redirect URL can carry `?license_key=` with nothing after it — treat that
  // the same as "no key" (show the manual form) rather than activating an
  // empty string and paying for a network round-trip to learn what a regex
  // already knew.
  const activationKey = initialKey?.trim() ?? '';
  const hasActivationKey = activationKey.length > 0;
  const [state, setState] = useState<DialogState>(
    hasActivationKey ? { kind: 'activating' } : { kind: 'form' }
  );
  const [inputValue, setInputValue] = useState('');
  const [activatedKey, setActivatedKey] = useState('');
  // Starts where the old `!hasActivationKey` guard started, so nothing about the two
  // existing entry points changes. The escape below is the only thing that can turn it
  // on afterwards: a key that arrived in a redirect and was rejected for good is the one
  // case where the reader has to be able to type it themselves.
  const [showManualForm, setShowManualForm] = useState(!hasActivationKey);
  // Guards the automatic mount activation independently of runActivation's
  // identity: activateLicense() is treated as non-idempotent (a new device
  // instance per call, against a limit of 3 — see lib/export/license.ts for
  // why that is an inference rather than a documented guarantee), so this must
  // not re-fire just because a parent re-render gave onOpenChange a new closure.
  const activatedKeyRef = useRef<string | null>(null);
  // Synchronous, unlike the `isActivating` state Submit is disabled on: React
  // state updates land a tick late, and activateLicense() mints a device
  // instance per call against a cap of 3 with no deactivation route anywhere
  // in the product — a burnt slot from a double-fired call is unrecoverable.
  // Mirrors ResultsExportControls's isRunningRef guard on its own trigger.
  const isActivatingRef = useRef(false);

  const runActivation = useCallback(
    async (key: string): Promise<void> => {
      if (isActivatingRef.current) return;
      isActivatingRef.current = true;
      setState({ kind: 'activating' });

      try {
        const result = await activateLicense(key);

        if (result.ok) {
          storeLicense(key.trim(), result.instanceId);
          if (source === 'redirect') {
            analytics.purchaseSuccess();
          } else {
            analytics.licenseRestored();
          }
          // Not onOpenChange(false). This is the only moment in the product where a
          // reader has handed over money, and closing the dialog was the entire
          // confirmation they got — Layout.tsx:99-105 documents that being read as
          // another failure. The screen is terminal: activateLicense() mints a device
          // instance per call against a cap of 3, so nothing here may re-enter it.
          setActivatedKey(key.trim());
          setState({ kind: 'activated' });
          return;
        }

        analytics.licenseError(result.reason);
        setState({ kind: 'error', reason: result.reason });
      } finally {
        isActivatingRef.current = false;
      }
    },
    [onOpenChange, source]
  );

  useEffect(() => {
    if (!hasActivationKey) return;
    if (activatedKeyRef.current === activationKey) return;
    activatedKeyRef.current = activationKey;

    // activateLicense() is not idempotent — it mints a new device instance
    // every call, capped at 3 per key. If this device already holds this
    // exact key, re-clicking the receipt-email link must not spend another
    // activation: it would eventually lock the buyer out of their own phone.
    const stored = getStoredLicense();
    if (stored?.key === activationKey) {
      onOpenChange(false);
      return;
    }

    void runActivation(activationKey);
  }, [activationKey, hasActivationKey, onOpenChange, runActivation]);

  const handleSubmit = (): void => {
    if (!isLicenseKeyFormat(inputValue)) {
      setState({ kind: 'error', reason: 'format' });
      return;
    }
    void runActivation(inputValue);
  };

  const handleRetry = (): void => {
    if (hasActivationKey) {
      void runActivation(activationKey);
      return;
    }
    setState({ kind: 'form' });
  };

  const handleEnterManually = (): void => {
    setShowManualForm(true);
    setState({ kind: 'form' });
  };

  const handleDone = (): void => onOpenChange(false);

  const isActivating = state.kind === 'activating';
  // The states that draw their own DialogTitle: activation success, and the two
  // terminal verdicts routed through TerminalErrorBody / RevokedLicenseNotice.
  const hasOwnHeader =
    state.kind === 'activated' || (state.kind === 'error' && isTerminalReason(state.reason));

  return (
    <ExportSheet open={open} onOpenChange={onOpenChange}>
      {/* Drawn only while no other state supplies a title. Activation success and
          the two terminal verdicts bring their own header, and stacking this one
          above them put two DialogTitles in one DialogContent — and, worse to read,
          left "Activate your export" standing over a screen that says the export is
          already unlocked. `text-start` overrides DialogHeader's `text-center
          sm:text-start`: below 640px this title was centred over a left-aligned
          body, on the viewport 85% of sessions use. */}
      {hasOwnHeader ? null : (
        <DialogHeader className="text-start pe-8">
          <DialogTitle>{t('export.license.title')}</DialogTitle>
          <DialogDescription>
            {hasActivationKey
              ? // Stable purpose text, not state text: the role="status" region
                // below already announces "Activating…" on state change, so
                // repeating it here would have a screen reader read it twice.
                //
                // Borrowed from the paywall's namespace, and this dialog is now
                // its only reader — the paywall dropped its own feature line
                // when the proportion became the argument. Left where it is
                // rather than moved, because relocating a string on the
                // activation path buys nothing but risk; delete it there and
                // ten locales lose a description.
                t('export.paywall.instantNote')
              : t('export.license.manualDescription')}
          </DialogDescription>
        </DialogHeader>
      )}

      {/* sr-only, not a visible line. "Unlocking…" is already on the footer button
          during the only state this ever has text in, so visibly it said the same
          thing twice — and in every other state the `min-h-5` reserved 20px of
          blank sheet plus the dialog grid's own 16px gap under the header. The
          announcement it exists for is unchanged. */}
      <div role="status" aria-live="polite" className="sr-only">
        {isActivating ? t('export.license.activating') : ''}
      </div>

      {state.kind === 'activated' ? <ActivatedBody activatedKey={activatedKey} /> : null}

      {state.kind === 'error' && isTerminalReason(state.reason) ? (
        <TerminalErrorBody reason={state.reason} />
      ) : null}

      {state.kind === 'error' && !isTerminalReason(state.reason) ? (
        <p role="alert" className="text-sm text-destructive">
          {t(ERROR_KEYS[state.reason])}
        </p>
      ) : null}

      {showManualForm &&
      state.kind !== 'activating' &&
      state.kind !== 'activated' &&
      !(state.kind === 'error' && isTerminalReason(state.reason)) ? (
        <Input
          value={inputValue}
          onChange={event => setInputValue(event.target.value)}
          placeholder={t('export.license.placeholder')}
          aria-label={t('export.license.title')}
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
        />
      ) : null}

      <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
        <LicenseFooterActions
          state={state}
          isActivating={isActivating}
          showManualForm={showManualForm}
          hasActivationKey={hasActivationKey}
          onContinue={onContinue}
          onDone={handleDone}
          onSubmit={handleSubmit}
          onRetry={handleRetry}
          onEnterManually={handleEnterManually}
        />
      </DialogFooter>
    </ExportSheet>
  );
}

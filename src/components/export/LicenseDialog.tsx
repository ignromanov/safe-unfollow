import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExportSheet } from '@/components/export/ExportSheet';
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

// 'disabled' maps to the "revoked" copy, not "not found" — telling someone
// whose license was disabled that we "could not find" their key sends them
// hunting through their purchase email for a typo that does not exist.
// `as const` keeps the literal dot-paths so `t()` can type-check them below.
const ERROR_KEYS = {
  format: 'export.license.errorFormat',
  not_found: 'export.license.errorNotFound',
  limit_reached: 'export.license.errorLimit',
  disabled: 'export.license.revoked',
  // Unreachable from this dialog — 'invalid' is the reason validateLicense
  // returns for Dodo's bare `valid: false`, and this dialog only activates.
  // The exhaustive `satisfies` below still demands an entry, and "revoked" is
  // the honest copy for a key the server no longer accepts.
  invalid: 'export.license.revoked',
  invalid_input: 'export.license.errorGeneric',
  network: 'export.license.errorGeneric',
  unknown: 'export.license.errorGeneric',
} as const satisfies Record<LicenseFailureReason | 'format', string>;

// not_found, limit_reached and disabled are permanent verdicts from Dodo —
// the same key fails the same way forever, so offering "Try again" for those
// reasons would just invite a click that cannot help.
const RETRYABLE_REASONS = new Set<LicenseFailureReason | 'format'>([
  'invalid_input',
  'network',
  'unknown',
]);

// The two verdicts that get a screen of their own rather than a red sentence. Both are
// permanent and neither is the reader's fault, so both end in the one action that can
// actually resolve them.
const TERMINAL_REASONS = new Set<LicenseFailureReason | 'format'>([
  'limit_reached',
  'disabled',
  'invalid',
]);

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
      <DialogHeader className="text-start sm:text-start">
        <DialogTitle>{t('export.license.successTitle')}</DialogTitle>
        <DialogDescription>{t('export.license.successBody')}</DialogDescription>
      </DialogHeader>
      <p className="text-xs text-muted-foreground">{t('export.license.successMeta')}</p>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">
          {t('export.license.keyLabel')}
        </span>
        <span className="rounded-2xl border bg-muted px-3 py-2 font-mono text-sm">
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
// of TERMINAL_REASONS by the time this renders.
function TerminalErrorBody({ reason }: { reason: LicenseFailureReason | 'format' }) {
  const { t } = useTranslation('results');
  const isBlocked = reason === 'limit_reached';

  return (
    <div role="alert" className="flex flex-col gap-3">
      <DialogHeader className="text-start sm:text-start">
        <DialogTitle>
          {isBlocked ? t('export.license.blockedTitle') : t('export.license.revokedTitle')}
        </DialogTitle>
        <DialogDescription>
          {isBlocked
            ? t('export.license.blockedBody')
            : t('export.license.revokedBody', { email: SUPPORT_EMAIL })}
        </DialogDescription>
      </DialogHeader>
      {isBlocked ? (
        <p className="text-sm leading-normal text-muted-foreground">
          {t('export.license.blockedAction', { email: SUPPORT_EMAIL })}
        </p>
      ) : null}
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
  const isTerminal = isError && TERMINAL_REASONS.has(state.reason);

  return (
    <>
      {isActivating ? (
        <Button size="lg" className="min-h-12" disabled aria-busy>
          <div className="animate-spin">
            <Loader2 className="h-4 w-4" />
          </div>
          {t('export.license.activating')}
        </Button>
      ) : null}

      {!isActivating && showManualForm ? (
        <Button size="lg" className="min-h-12" onClick={onSubmit}>
          {t('export.license.submit')}
        </Button>
      ) : null}

      {!isActivating && hasActivationKey && isRetryable ? (
        <Button size="lg" className="min-h-12" onClick={onRetry}>
          {t('export.license.retry')}
        </Button>
      ) : null}

      {state.kind === 'activated' ? (
        <Button size="lg" className="min-h-12" onClick={onContinue ?? onDone}>
          {onContinue ? t('export.license.continue') : t('export.license.done')}
        </Button>
      ) : null}

      {isTerminal ? (
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Pro Export licence')}`}
          className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-primary px-6 font-bold text-primary-foreground"
        >
          {t('export.license.emailSupport')}
        </a>
      ) : null}

      {isError && hasActivationKey && !isRetryable && !isTerminal ? (
        <Button size="lg" variant="outline" className="min-h-12" onClick={onEnterManually}>
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

  const runActivation = useCallback(
    async (key: string): Promise<void> => {
      setState({ kind: 'activating' });

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

  return (
    <ExportSheet open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
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

      <div role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
        {isActivating ? t('export.license.activating') : ''}
      </div>

      {state.kind === 'activated' ? <ActivatedBody activatedKey={activatedKey} /> : null}

      {state.kind === 'error' && TERMINAL_REASONS.has(state.reason) ? (
        <TerminalErrorBody reason={state.reason} />
      ) : null}

      {state.kind === 'error' && !TERMINAL_REASONS.has(state.reason) ? (
        <p role="alert" className="text-sm text-destructive">
          {t(ERROR_KEYS[state.reason])}
        </p>
      ) : null}

      {showManualForm && state.kind !== 'activating' && state.kind !== 'activated' ? (
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

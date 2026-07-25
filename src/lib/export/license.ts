/**
 * LemonSqueezy License API client.
 *
 * The License API is deliberately public — the license key is the credential,
 * there is no store API key involved, and the endpoint answers with
 * `access-control-allow-origin: *`. That is what makes a server-free unlock
 * possible for a fully static site.
 *
 * Two response envelopes exist and both are handled here:
 *   domain:     { activated|valid, error, license_key, instance, meta }
 *   validation: { message, errors }           // no activated/valid at all
 * Verified live: unknown key -> 404 + domain envelope; missing instance_name ->
 * 422 + validation envelope.
 */

const LICENSE_API = 'https://api.lemonsqueezy.com/v1/licenses';

/**
 * Cosmetic: shown as the instance name in the seller dashboard. Note that
 * /activate creates a NEW instance on every call even for an identical name,
 * so callers must cache the returned id rather than re-activating.
 */
const INSTANCE_NAME = 'safeunfollow-web';

/** Validation is best-effort and fails open on any error, so a stuck request must not linger. */
const VALIDATE_TIMEOUT_MS = 4000;

/**
 * Activation is not idempotent — LemonSqueezy mints a new device instance
 * (capped at 3 per key) on every call. If the instance is minted server-side
 * but the response arrives after a short timeout, activateLicense() reports a
 * retryable 'network' failure and the UI offers "Try again", which spends
 * another one of the buyer's three devices on a request that may have already
 * succeeded. A longer budget here narrows that window; waiting is cheaper
 * than retrying.
 */
const ACTIVATE_TIMEOUT_MS = 15000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LicenseFailureReason =
  | 'not_found'
  | 'limit_reached'
  | 'disabled'
  | 'invalid_input'
  | 'network'
  | 'unknown';

export type ActivateResult =
  | { ok: true; instanceId: string }
  | { ok: false; reason: LicenseFailureReason };

export type ValidateResult = { ok: true } | { ok: false; reason: LicenseFailureReason };

interface LicenseApiBody {
  activated?: boolean;
  valid?: boolean;
  error?: string | null;
  message?: string;
  errors?: Record<string, string[]>;
  license_key?: { status?: string };
  instance?: { id?: string };
}

/** Whether a string looks like a LemonSqueezy key (UUID v4) before we spend a request on it. */
export function isLicenseKeyFormat(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

async function post(
  action: 'activate' | 'validate',
  params: Record<string, string>,
  timeoutMs: number
): Promise<LicenseApiBody | null> {
  try {
    const response = await fetch(`${LICENSE_API}/${action}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
      signal: AbortSignal.timeout(timeoutMs),
    });

    return (await response.json()) as LicenseApiBody;
  } catch {
    // Offline, timeout, DNS, or a body that is not JSON. Indistinguishable to
    // us and treated the same by every caller.
    return null;
  }
}

/**
 * Classifies a negative answer. Deliberately matches on body fields rather than
 * HTTP status: the exact status for "limit reached" and "disabled" is not
 * documented, and an unrecognised shape must land on `unknown` instead of being
 * mistaken for a definite verdict.
 */
function classifyFailure(body: LicenseApiBody): LicenseFailureReason {
  if (body.errors !== undefined) return 'invalid_input';
  if (body.activated === undefined && body.valid === undefined && body.message !== undefined) {
    return 'invalid_input';
  }

  const status = body.license_key?.status;
  if (status === 'disabled' || status === 'expired') return 'disabled';

  const error = body.error ?? '';
  if (/activation limit/i.test(error)) return 'limit_reached';
  if (/not found/i.test(error)) return 'not_found';

  return 'unknown';
}

/** Spends one of the key's activations and returns the instance id to cache. */
export async function activateLicense(licenseKey: string): Promise<ActivateResult> {
  const body = await post(
    'activate',
    {
      license_key: licenseKey.trim(),
      instance_name: INSTANCE_NAME,
    },
    ACTIVATE_TIMEOUT_MS
  );

  if (body === null) return { ok: false, reason: 'network' };

  const instanceId = body.instance?.id;
  if (body.activated === true && instanceId !== undefined) {
    return { ok: true, instanceId };
  }

  return { ok: false, reason: classifyFailure(body) };
}

/** Checks a cached key/instance pair. Costs nothing against the activation limit. */
export async function validateLicense(
  licenseKey: string,
  instanceId: string
): Promise<ValidateResult> {
  const body = await post(
    'validate',
    {
      license_key: licenseKey.trim(),
      instance_id: instanceId,
    },
    VALIDATE_TIMEOUT_MS
  );

  if (body === null) return { ok: false, reason: 'network' };
  if (body.valid === true) return { ok: true };

  return { ok: false, reason: classifyFailure(body) };
}

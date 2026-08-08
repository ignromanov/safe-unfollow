/**
 * Dodo Payments License API client.
 *
 * Both endpoints used here are public by design — the license key is the
 * credential, no merchant API key is involved, and Dodo answers a browser
 * preflight with our own origin. That is what keeps a server-free unlock
 * possible for a fully static site.
 *
 * Verified live against test.dodopayments.com: an unknown key yields
 * 404 `{"code":"NOT_FOUND"}` on activate and 200 `{"valid":false}` on validate;
 * a body missing `name` yields 422 `{"code":"INVALID_REQUEST_BODY"}`.
 */

const LIVE_API = 'https://live.dodopayments.com';
const TEST_API = 'https://test.dodopayments.com';

/**
 * Cosmetic: shown as the instance name in the seller dashboard. Note that
 * /licenses/activate mints a NEW instance on every call even for an identical
 * name, so callers must cache the returned id rather than re-activating.
 */
const INSTANCE_NAME = 'safeunfollow-web';

/** Validation is best-effort and fails open on any error, so a stuck request must not linger. */
const VALIDATE_TIMEOUT_MS = 4000;

/**
 * Activation is not idempotent — Dodo mints a new device instance (capped per
 * key) on every call. If the instance is minted server-side but the response
 * arrives after a short timeout, activateLicense() reports a retryable
 * 'network' failure and the UI offers "Try again", which spends another one of
 * the buyer's activations on a request that may have already succeeded. A
 * longer budget here narrows that window; waiting is cheaper than retrying.
 */
const ACTIVATE_TIMEOUT_MS = 15000;

/**
 * A key is only rejected locally for shapes no key could have. Dodo's own docs
 * show two different key shapes (UUIDs and grouped alphanumerics), so a tighter
 * pattern would refuse a valid key from someone who has already paid. The
 * server is the authority; this guard only saves an obviously wasted request.
 */
const KEY_PATTERN = /^[A-Za-z0-9._-]{6,64}$/;

export type LicenseFailureReason =
  | 'not_found'
  | 'limit_reached'
  | 'disabled'
  | 'invalid'
  | 'invalid_input'
  | 'network'
  | 'unknown';

export type ActivateResult =
  | { ok: true; instanceId: string }
  | { ok: false; reason: LicenseFailureReason };

export type ValidateResult = { ok: true } | { ok: false; reason: LicenseFailureReason };

interface LicenseApiBody {
  /** License key instance id, returned by activate (e.g. `lki_123`). */
  id?: string;
  /** Validation verdict — a bare boolean, with no reason attached. */
  valid?: boolean;
  /** Machine-readable error identifier, e.g. `NOT_FOUND`, `INVALID_REQUEST_BODY`. */
  code?: string;
  message?: string;
}

interface LicenseApiResponse {
  status: number;
  body: LicenseApiBody;
}

/**
 * Test mode is derived from the single configured checkout URL rather than a
 * second env var: a test checkout paired with live validation is a silent
 * failure, and one source of truth makes that pairing unrepresentable.
 */
function getApiBase(): string {
  const checkoutUrl = import.meta.env.VITE_DODO_CHECKOUT_URL;
  if (!checkoutUrl) return LIVE_API;

  try {
    return new URL(checkoutUrl).hostname.startsWith('test.') ? TEST_API : LIVE_API;
  } catch {
    // A malformed URL disables checkout anyway; defaulting to live keeps an
    // already-activated license working.
    return LIVE_API;
  }
}

/** Whether a string could be a license key at all, before we spend a request on it. */
export function isLicenseKeyFormat(value: string): boolean {
  return KEY_PATTERN.test(value.trim());
}

async function post(
  action: 'activate' | 'validate',
  payload: Record<string, string>,
  timeoutMs: number
): Promise<LicenseApiResponse | null> {
  try {
    const response = await fetch(`${getApiBase()}/licenses/${action}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });

    return { status: response.status, body: (await response.json()) as LicenseApiBody };
  } catch {
    // Offline, timeout, DNS, or a body that is not JSON. Indistinguishable to
    // us and treated the same by every caller.
    return null;
  }
}

/**
 * Classifies a negative answer from activate.
 *
 * `code` is read before `status` because Dodo overloads 422: the documented
 * meaning is "activation limit reached", but a malformed body returns the same
 * status with code INVALID_REQUEST_BODY. Getting that backwards would offer a
 * pointless "Try again" to someone whose key is genuinely exhausted.
 */
function classifyFailure(status: number, code: string | undefined): LicenseFailureReason {
  if (code === 'INVALID_REQUEST_BODY') return 'invalid_input';

  switch (status) {
    case 403:
      return 'disabled';
    case 404:
      return 'not_found';
    case 422:
      return 'limit_reached';
    default:
      return 'unknown';
  }
}

/** Spends one of the key's activations and returns the instance id to cache. */
export async function activateLicense(licenseKey: string): Promise<ActivateResult> {
  const response = await post(
    'activate',
    {
      license_key: licenseKey.trim(),
      name: INSTANCE_NAME,
    },
    ACTIVATE_TIMEOUT_MS
  );

  if (response === null) return { ok: false, reason: 'network' };

  const instanceId = response.body.id;
  if (instanceId !== undefined && instanceId !== '') {
    return { ok: true, instanceId };
  }

  return { ok: false, reason: classifyFailure(response.status, response.body.code) };
}

/** Checks a cached key/instance pair. Costs nothing against the activation limit. */
export async function validateLicense(
  licenseKey: string,
  instanceId: string
): Promise<ValidateResult> {
  const response = await post(
    'validate',
    {
      license_key: licenseKey.trim(),
      license_key_instance_id: instanceId,
    },
    VALIDATE_TIMEOUT_MS
  );

  if (response === null) return { ok: false, reason: 'network' };

  // Anything other than a delivered verdict is not a statement about the
  // license. Only a 200 carrying `valid: false` may cost a paying user their
  // stored key.
  if (response.status !== 200) return { ok: false, reason: 'unknown' };
  if (response.body.valid === true) return { ok: true };
  if (response.body.valid === false) return { ok: false, reason: 'invalid' };

  return { ok: false, reason: 'unknown' };
}

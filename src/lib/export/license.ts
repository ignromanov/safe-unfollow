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

/**
 * Checkout host → License API host. Both pairings were confirmed by response
 * headers, not inferred: checkout.dodopayments.com answers with
 * `set-cookie: mode=live`, test.checkout.dodopayments.com with `mode=test`.
 */
const API_BASE_BY_CHECKOUT_HOST: Record<string, string> = {
  'checkout.dodopayments.com': 'https://live.dodopayments.com',
  'test.checkout.dodopayments.com': 'https://test.dodopayments.com',
};

/**
 * Cosmetic: shown as the instance name in the seller dashboard.
 *
 * Callers must cache the returned id rather than re-activating, on the
 * assumption that /licenses/activate mints a NEW instance per call even for an
 * identical name. Dodo's docs do not state this either way — the inference is
 * from a 201 "License key instance created" that returns a fresh instance id
 * alongside a per-key `activations_limit`. Treated as non-idempotent because
 * the two ways of being wrong are not symmetric: a needless cache costs
 * nothing, a needless activation is one the buyer cannot get back.
 */
const INSTANCE_NAME = 'safeunfollow-web';

/** Validation is best-effort and fails open on any error, so a stuck request must not linger. */
const VALIDATE_TIMEOUT_MS = 4000;

/**
 * Assumed non-idempotent (see INSTANCE_NAME). If an instance is minted
 * server-side but the response arrives after a short timeout, activateLicense()
 * reports a retryable 'network' failure and the UI offers "Try again", which
 * spends another one of the buyer's activations on a request that may have
 * already succeeded. A longer budget here narrows that window; waiting is
 * cheaper than retrying.
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
  'not_found' | 'limit_reached' | 'disabled' | 'invalid' | 'invalid_input' | 'network' | 'unknown';

export type ActivateResult =
  { ok: true; instanceId: string } | { ok: false; reason: LicenseFailureReason };

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
 * The API host is read off the single configured checkout URL rather than a
 * second env var, so a test checkout can never be paired with live validation.
 *
 * It returns null rather than guessing, because a wrong guess is the most
 * expensive failure this module has: the buyer pays in one mode, receives a key
 * minted in that mode, and we reject it against the other host with a 404 they
 * can do nothing about. A dodo.pe short link is exactly this case — it 301s to
 * either mode and its own hostname says nothing about which.
 *
 * Null means "we cannot tell", and every caller treats that as "do not sell".
 */
export function getApiBase(): string | null {
  const checkoutUrl = import.meta.env.VITE_DODO_CHECKOUT_URL;
  if (!checkoutUrl) return null;

  try {
    return API_BASE_BY_CHECKOUT_HOST[new URL(checkoutUrl).hostname] ?? null;
  } catch {
    return null;
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
): Promise<LicenseApiResponse | null | 'unconfigured'> {
  const apiBase = getApiBase();
  if (apiBase === null) return 'unconfigured';

  try {
    const response = await fetch(`${apiBase}/licenses/${action}`, {
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

  // Unreachable through the UI — isExportFeatureEnabled() hides every export
  // control when the mode cannot be resolved. Kept because the two guards
  // defend different things: that one stops us selling, this one stops us
  // sending a paid key to a host that was picked by a coin flip.
  if (response === 'unconfigured') return { ok: false, reason: 'unknown' };
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

  if (response === 'unconfigured') return { ok: false, reason: 'unknown' };
  if (response === null) return { ok: false, reason: 'network' };

  // Anything other than a delivered verdict is not a statement about the
  // license. Only a 200 carrying `valid: false` may cost a paying user their
  // stored key.
  if (response.status !== 200) return { ok: false, reason: 'unknown' };
  if (response.body.valid === true) return { ok: true };
  if (response.body.valid === false) return { ok: false, reason: 'invalid' };

  return { ok: false, reason: 'unknown' };
}

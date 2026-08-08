import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { activateLicense, isLicenseKeyFormat, validateLicense } from '@/lib/export/license';

const KEY = '38b1460a-5104-4067-a91d-77b872934d51';
const INSTANCE = 'lki_kTBvzHrJq7xWnP3d';

/** Dodo answers are classified by HTTP status and the machine-readable `code`. */
function mockResponse(status: number, body: unknown): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status, json: () => Promise.resolve(body) }));
}

describe('export/license', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // A resolvable live checkout URL. Deliberately not the dodo.pe short link:
    // its hostname carries no mode, and the API host is derived from this value.
    vi.stubEnv('VITE_DODO_CHECKOUT_URL', 'https://checkout.dodopayments.com/buy/pdt_x');
    // So that "did not call the network" is assertable, not just unobserved.
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  describe('isLicenseKeyFormat', () => {
    it('should accept a UUID-shaped key', () => {
      expect(isLicenseKeyFormat(KEY)).toBe(true);
    });

    it('should accept a grouped alphanumeric key', () => {
      // Dodo's own docs show both UUIDs and grouped keys like this one. Pinning
      // the UUID shape here would reject a valid key before it ever reaches the
      // server, and the person holding it has already paid.
      expect(isLicenseKeyFormat('PRO-AAAA-BBBB-CCCC-DDDD')).toBe(true);
    });

    it('should accept a key with surrounding whitespace', () => {
      expect(isLicenseKeyFormat(`  ${KEY}\n`)).toBe(true);
    });

    it('should reject an empty string', () => {
      expect(isLicenseKeyFormat('   ')).toBe(false);
    });

    it('should reject a value with interior whitespace', () => {
      expect(isLicenseKeyFormat('not a key')).toBe(false);
    });
  });

  describe('API host selection', () => {
    it('should call the live host for a live checkout URL', async () => {
      vi.stubEnv('VITE_DODO_CHECKOUT_URL', 'https://checkout.dodopayments.com/buy/pdt_x');
      mockResponse(201, { id: INSTANCE });

      await activateLicense(KEY);

      expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
        'https://live.dodopayments.com/licenses/activate'
      );
    });

    it('should call the test host for a test-mode checkout URL', async () => {
      vi.stubEnv(
        'VITE_DODO_CHECKOUT_URL',
        'https://test.checkout.dodopayments.com/buy/pdt_0NkqSXsvL97EqSoBcfbcE'
      );
      mockResponse(201, { id: INSTANCE });

      await activateLicense(KEY);

      expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
        'https://test.dodopayments.com/licenses/activate'
      );
    });

    it('should refuse to guess a mode for a short link', async () => {
      // https://dodo.pe/vb124ghir3 — the link this product actually shipped
      // with — 301s to the TEST checkout, but its own hostname says nothing
      // about mode. Defaulting such a URL to live is the worst outcome
      // available: the buyer pays in test mode, gets a test-mode key, and we
      // reject it against the live host with a 404 they cannot act on.
      vi.stubEnv('VITE_DODO_CHECKOUT_URL', 'https://dodo.pe/vb124ghir3');

      await expect(activateLicense(KEY)).resolves.toEqual({ ok: false, reason: 'unknown' });
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should refuse to guess a mode for an unparseable checkout URL', async () => {
      vi.stubEnv('VITE_DODO_CHECKOUT_URL', 'not-a-url');

      await expect(activateLicense(KEY)).resolves.toEqual({ ok: false, reason: 'unknown' });
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should not validate against a guessed host either', async () => {
      vi.stubEnv('VITE_DODO_CHECKOUT_URL', 'https://dodo.pe/vb124ghir3');

      await expect(validateLicense(KEY, INSTANCE)).resolves.toEqual({
        ok: false,
        reason: 'unknown',
      });
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('activateLicense', () => {
    it('should post a JSON body to the activate endpoint', async () => {
      mockResponse(201, { id: INSTANCE });

      await activateLicense(KEY);

      const [, init] = vi.mocked(fetch).mock.calls[0];
      expect(init?.method).toBe('POST');
      expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
      expect(JSON.parse(init?.body as string)).toEqual({
        license_key: KEY,
        name: expect.any(String) as string,
      });
    });

    it('should return the instance id on success', async () => {
      mockResponse(201, { id: INSTANCE, license_key_id: 'lic_123' });

      await expect(activateLicense(KEY)).resolves.toEqual({ ok: true, instanceId: INSTANCE });
    });

    it('should trim the key before sending it', async () => {
      mockResponse(201, { id: INSTANCE });

      await activateLicense(`  ${KEY}  `);

      expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)).toMatchObject({
        license_key: KEY,
      });
    });

    it('should map 404 to not_found', async () => {
      mockResponse(404, { code: 'NOT_FOUND', message: 'The requested resource…' });

      await expect(activateLicense(KEY)).resolves.toEqual({ ok: false, reason: 'not_found' });
    });

    it('should map 403 to disabled', async () => {
      mockResponse(403, { code: 'FORBIDDEN' });

      await expect(activateLicense(KEY)).resolves.toEqual({ ok: false, reason: 'disabled' });
    });

    it('should map 422 to limit_reached', async () => {
      mockResponse(422, { code: 'ACTIVATION_LIMIT_REACHED' });

      await expect(activateLicense(KEY)).resolves.toEqual({ ok: false, reason: 'limit_reached' });
    });

    it('should map a 422 schema rejection to invalid_input, not limit_reached', async () => {
      // Dodo overloads 422: the docs assign it to "activation limit reached",
      // but a malformed body gets the same status with code
      // INVALID_REQUEST_BODY (observed live). Reading the code first is what
      // keeps a genuinely exhausted key from being offered a pointless retry.
      mockResponse(422, {
        code: 'INVALID_REQUEST_BODY',
        message: 'Failed to deserialize the JSON body into the target type: missing field `name`',
      });

      await expect(activateLicense(KEY)).resolves.toEqual({ ok: false, reason: 'invalid_input' });
    });

    it('should map 500 to unknown', async () => {
      mockResponse(500, { code: 'INTERNAL_SERVER_ERROR' });

      await expect(activateLicense(KEY)).resolves.toEqual({ ok: false, reason: 'unknown' });
    });

    it('should treat a 201 without an instance id as unknown', async () => {
      mockResponse(201, {});

      await expect(activateLicense(KEY)).resolves.toEqual({ ok: false, reason: 'unknown' });
    });

    it('should map a thrown fetch to network', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

      await expect(activateLicense(KEY)).resolves.toEqual({ ok: false, reason: 'network' });
    });

    it('should map a non-JSON response to network', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ status: 201, json: () => Promise.reject(new Error('bad')) })
      );

      await expect(activateLicense(KEY)).resolves.toEqual({ ok: false, reason: 'network' });
    });

    it('should use a longer timeout budget than validate', async () => {
      // A timed-out activate may already have minted a device instance
      // server-side (activation is not idempotent, capped at 3/key), so
      // retrying is more expensive than waiting. Validate is best-effort and
      // fails open, so it keeps the tight bound.
      const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
      mockResponse(201, { id: INSTANCE });

      await activateLicense(KEY);

      expect(timeoutSpy).toHaveBeenCalledWith(15000);
    });
  });

  describe('validateLicense', () => {
    it('should post both credentials to the validate endpoint', async () => {
      mockResponse(200, { valid: true });

      await validateLicense(KEY, INSTANCE);

      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(url).toBe('https://live.dodopayments.com/licenses/validate');
      expect(JSON.parse(init?.body as string)).toEqual({
        license_key: KEY,
        license_key_instance_id: INSTANCE,
      });
    });

    it('should return ok for a valid license', async () => {
      mockResponse(200, { valid: true });

      await expect(validateLicense(KEY, INSTANCE)).resolves.toEqual({ ok: true });
    });

    it('should map valid:false to invalid', async () => {
      // Dodo answers validation with a bare boolean — no reason, no status
      // code. Every cause (deleted, disabled, expired, wrong instance) means
      // the same thing for a stored license, so one honest reason covers them.
      mockResponse(200, { valid: false });

      await expect(validateLicense(KEY, INSTANCE)).resolves.toEqual({
        ok: false,
        reason: 'invalid',
      });
    });

    it('should map a non-200 answer to unknown rather than revoking', async () => {
      // A 5xx is not a verdict about the license. Calling it invalid here would
      // clear a paying user's stored key on the strength of a server hiccup.
      mockResponse(500, { code: 'INTERNAL_SERVER_ERROR' });

      await expect(validateLicense(KEY, INSTANCE)).resolves.toEqual({
        ok: false,
        reason: 'unknown',
      });
    });

    it('should map a timeout to network', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')));

      await expect(validateLicense(KEY, INSTANCE)).resolves.toEqual({
        ok: false,
        reason: 'network',
      });
    });

    it('should use a shorter timeout budget than activate', async () => {
      const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
      mockResponse(200, { valid: true });

      await validateLicense(KEY, INSTANCE);

      expect(timeoutSpy).toHaveBeenCalledWith(4000);
    });
  });
});

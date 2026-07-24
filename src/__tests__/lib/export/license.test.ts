import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { activateLicense, isLicenseKeyFormat, validateLicense } from '@/lib/export/license';

const KEY = '38b1460a-5104-4067-a91d-77b872934d51';
const INSTANCE = 'f90ec370-fd83-46a5-8bbd-44a241e78665';

function mockJson(body: unknown): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve(body) }));
}

describe('export/license', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('isLicenseKeyFormat', () => {
    it('should accept a UUID v4 key', () => {
      expect(isLicenseKeyFormat(KEY)).toBe(true);
    });

    it('should accept a key with surrounding whitespace', () => {
      expect(isLicenseKeyFormat(`  ${KEY}\n`)).toBe(true);
    });

    it('should reject a non-UUID string', () => {
      expect(isLicenseKeyFormat('not-a-uuid')).toBe(false);
    });
  });

  describe('activateLicense', () => {
    it('should post form-encoded credentials to the activate endpoint', async () => {
      mockJson({ activated: true, instance: { id: INSTANCE } });

      await activateLicense(KEY);

      const fetchMock = vi.mocked(fetch);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.lemonsqueezy.com/v1/licenses/activate');
      expect(init?.method).toBe('POST');
      expect(init?.body).toContain(`license_key=${KEY}`);
      expect(init?.body).toContain('instance_name=');
    });

    it('should return the instance id on success', async () => {
      mockJson({ activated: true, error: null, instance: { id: INSTANCE } });

      await expect(activateLicense(KEY)).resolves.toEqual({
        ok: true,
        instanceId: INSTANCE,
      });
    });

    it('should trim the key before sending it', async () => {
      mockJson({ activated: true, instance: { id: INSTANCE } });

      await activateLicense(`  ${KEY}  `);

      expect(vi.mocked(fetch).mock.calls[0][1]?.body).toContain(`license_key=${KEY}`);
    });

    it('should map an unknown key to not_found', async () => {
      mockJson({ activated: false, error: 'license_key not found.' });

      await expect(activateLicense(KEY)).resolves.toEqual({
        ok: false,
        reason: 'not_found',
      });
    });

    it('should map an exhausted activation limit to limit_reached', async () => {
      mockJson({
        activated: false,
        error: 'This license key has reached the activation limit.',
      });

      await expect(activateLicense(KEY)).resolves.toEqual({
        ok: false,
        reason: 'limit_reached',
      });
    });

    it('should map the Laravel validation envelope to invalid_input', async () => {
      mockJson({
        message: 'The instance name field is required.',
        errors: { instance_name: ['The instance name field is required.'] },
      });

      await expect(activateLicense(KEY)).resolves.toEqual({
        ok: false,
        reason: 'invalid_input',
      });
    });

    it('should map an unrecognised domain error to unknown', async () => {
      mockJson({ activated: false, error: 'something we have never seen' });

      await expect(activateLicense(KEY)).resolves.toEqual({
        ok: false,
        reason: 'unknown',
      });
    });

    it('should map a thrown fetch to network', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

      await expect(activateLicense(KEY)).resolves.toEqual({
        ok: false,
        reason: 'network',
      });
    });

    it('should map a non-JSON response to network', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ json: () => Promise.reject(new Error('bad json')) })
      );

      await expect(activateLicense(KEY)).resolves.toEqual({
        ok: false,
        reason: 'network',
      });
    });

    it('should treat a success flag without an instance id as unknown', async () => {
      mockJson({ activated: true, instance: {} });

      await expect(activateLicense(KEY)).resolves.toEqual({
        ok: false,
        reason: 'unknown',
      });
    });
  });

  describe('validateLicense', () => {
    it('should post both credentials to the validate endpoint', async () => {
      mockJson({ valid: true });

      await validateLicense(KEY, INSTANCE);

      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(url).toBe('https://api.lemonsqueezy.com/v1/licenses/validate');
      expect(init?.body).toContain(`instance_id=${INSTANCE}`);
    });

    it('should return ok for a valid license', async () => {
      mockJson({ valid: true, error: null });

      await expect(validateLicense(KEY, INSTANCE)).resolves.toEqual({ ok: true });
    });

    it('should map a disabled license to disabled', async () => {
      mockJson({ valid: false, error: 'license is disabled', license_key: { status: 'disabled' } });

      await expect(validateLicense(KEY, INSTANCE)).resolves.toEqual({
        ok: false,
        reason: 'disabled',
      });
    });

    it('should map an expired license to disabled', async () => {
      mockJson({ valid: false, license_key: { status: 'expired' } });

      await expect(validateLicense(KEY, INSTANCE)).resolves.toEqual({
        ok: false,
        reason: 'disabled',
      });
    });

    it('should map a deleted key to not_found', async () => {
      mockJson({ valid: false, error: 'license_key not found.' });

      await expect(validateLicense(KEY, INSTANCE)).resolves.toEqual({
        ok: false,
        reason: 'not_found',
      });
    });

    it('should map a timeout to network', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')));

      await expect(validateLicense(KEY, INSTANCE)).resolves.toEqual({
        ok: false,
        reason: 'network',
      });
    });
  });
});

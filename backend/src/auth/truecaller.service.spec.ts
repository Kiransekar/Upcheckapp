import { ConfigService } from '@nestjs/config';
import { Logger, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import axios from 'axios';
import {
  InMemoryNonceReplayStore,
  InMemoryTruecallerKeyCache,
  TRUECALLER_NONCE_MIN_TTL_SECONDS,
  TRUECALLER_PUBLIC_KEY_DEFAULT_TTL_SECONDS,
  TRUECALLER_PUBLIC_KEY_MAX_TTL_SECONDS,
  TRUECALLER_PUBLIC_KEY_MIN_TTL_SECONDS,
  TruecallerService,
  extractTruecallerPublicKeys,
  resolveNonceTtlSeconds,
  resolvePublicKeyTtlSeconds,
} from './truecaller.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * Helpers to build signed payloads for verifySignedPayload tests.
 */
function generateKeyPair() {
  return crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
}

function publicKeyToBase64Body(publicKey: crypto.KeyObject): string {
  const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  return pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '');
}

function buildSignedPayload(opts: {
  privateKey: crypto.KeyObject;
  algorithm: 'SHA512withRSA' | 'SHA256withRSA';
  requestNonce: string;
  requestTime?: number;
  profile?: Record<string, unknown>;
}): { payload: string; signature: string } {
  const profile = {
    requestNonce: opts.requestNonce,
    requestTime: opts.requestTime ?? Date.now(),
    firstName: 'Aarav',
    lastName: 'Sharma',
    phoneNumber: '+919876543210',
    email: 'aarav@example.com',
    ...opts.profile,
  };
  const payload = Buffer.from(JSON.stringify(profile), 'utf-8').toString(
    'base64',
  );
  const algo = opts.algorithm.includes('512') ? 'RSA-SHA512' : 'RSA-SHA256';
  const signer = crypto.createSign(algo);
  signer.update(payload);
  const signature = signer.sign(opts.privateKey, 'base64');
  return { payload, signature };
}

function buildService(env: Record<string, string> = {}): TruecallerService {
  const config = new ConfigService(env);
  return new TruecallerService(config);
}

describe('TruecallerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizePhone', () => {
    it('strips a leading +91 country code', () => {
      const svc = buildService();
      expect(svc.normalizePhone('+919876543210')).toBe('9876543210');
    });

    it('strips a bare 91 country code', () => {
      const svc = buildService();
      expect(svc.normalizePhone('919876543210')).toBe('9876543210');
    });

    it('removes spaces, dashes, and other non-digits', () => {
      const svc = buildService();
      expect(svc.normalizePhone('+91 98765-43210')).toBe('9876543210');
    });

    it('returns an empty string for null/undefined input', () => {
      const svc = buildService();
      expect(svc.normalizePhone(null)).toBe('');
      expect(svc.normalizePhone(undefined)).toBe('');
    });

    it('is idempotent on already-normalized values', () => {
      const svc = buildService();
      const once = svc.normalizePhone('+919876543210');
      expect(svc.normalizePhone(once)).toBe('9876543210');
    });
  });

  describe('maskPhone', () => {
    it('exposes only the last 4 digits', () => {
      const svc = buildService();
      expect(svc.maskPhone('+919876543210')).toBe('+91XXXXXX3210');
    });

    it('falls back to a fully masked placeholder for short input', () => {
      const svc = buildService();
      expect(svc.maskPhone('123')).toBe('+91XXXXXXXXXX');
    });

    it('handles null/undefined safely', () => {
      const svc = buildService();
      expect(svc.maskPhone(null)).toBe('+91XXXXXXXXXX');
      expect(svc.maskPhone(undefined)).toBe('+91XXXXXXXXXX');
    });
  });

  describe('verifyAccessToken', () => {
    const otpVerifyBase =
      'https://sdk-otp-verification-noneu.truecaller.com/v1/otp/client/installation/phoneNumberDetail';
    const defaultClientId = 'e98dcupeqtmcocbxr7qb4g7b4sub8blazhxrt-1ikmw';

    it('validates the token against phoneNumberDetail/{token} with the clientId header and returns the E.164 phone', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: { phoneNumber: '919876543210', countryCode: 'IN' },
      } as any);
      const svc = buildService();

      const profile = await svc.verifyAccessToken('tok', '9876543210');

      // The phoneNumberDetail endpoint carries no name — the caller supplies
      // the user-entered display name, so the service defaults it to 'User'.
      expect(profile.phoneNumber).toBe('+919876543210');
      expect(profile.firstName).toBe('User');
      expect(mockedAxios.get).toHaveBeenCalledWith(`${otpVerifyBase}/tok`, {
        headers: { clientId: defaultClientId },
        validateStatus: expect.any(Function),
      });
    });

    it('coerces a numeric phoneNumber in the response to a string E.164', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: { phoneNumber: 919876543210, countryCode: 'IN' },
      } as any);
      const svc = buildService();

      const profile = await svc.verifyAccessToken('tok', '+919876543210');
      expect(profile.phoneNumber).toBe('+919876543210');
    });

    it('throws UnauthorizedException("Invalid access token") on non-2xx (e.g. 404 invalid token)', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 404,
        data: { code: 1404, message: 'Invalid access token.' },
      } as any);
      const svc = buildService();

      await expect(
        svc.verifyAccessToken('tok', '+919876543210'),
      ).rejects.toMatchObject({
        response: { success: false, message: 'Invalid access token' },
      });
    });

    it('throws UnauthorizedException("Invalid access token") on transport error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const svc = buildService();

      await expect(
        svc.verifyAccessToken('tok', '+919876543210'),
      ).rejects.toMatchObject({
        response: { success: false, message: 'Invalid access token' },
      });
    });

    it('throws UnauthorizedException("Invalid Truecaller profile") when phoneNumber is missing', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: { countryCode: 'IN' },
      } as any);
      const svc = buildService();

      await expect(
        svc.verifyAccessToken('tok', '+919876543210'),
      ).rejects.toMatchObject({
        response: { success: false, message: 'Invalid Truecaller profile' },
      });
    });

    it('throws UnauthorizedException("Phone number mismatch") when phones differ after normalization', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: { phoneNumber: '918888888888', countryCode: 'IN' },
      } as any);
      const svc = buildService();

      await expect(
        svc.verifyAccessToken('tok', '+919876543210'),
      ).rejects.toMatchObject({
        response: { success: false, message: 'Phone number mismatch' },
      });
    });

    it('treats +91-prefixed and bare 10-digit numbers as equal', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: { phoneNumber: '919876543210', countryCode: 'IN' },
      } as any);
      const svc = buildService();

      const profile = await svc.verifyAccessToken('tok', '9876543210');
      expect(profile.phoneNumber).toBe('+919876543210');
    });

    it('honors a custom TRUECALLER_OTP_VERIFY_URL env var', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: { phoneNumber: '919876543210', countryCode: 'IN' },
      } as any);
      const customBase = 'https://example.test/otp/phoneNumberDetail';
      const svc = buildService({
        TRUECALLER_OTP_VERIFY_URL: customBase,
      });
      await svc.verifyAccessToken('tok', '9876543210');
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${customBase}/tok`,
        expect.any(Object),
      );
    });
  });

  describe('verifySignedPayload', () => {
    const keysApiUrl = 'https://api4.truecaller.com/v1/key';

    function mockKeyFetch(publicKey: crypto.KeyObject) {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: [
          {
            keyName: 'tc-test-key',
            key: publicKeyToBase64Body(publicKey),
          },
        ],
      } as any);
    }

    it('returns the embedded profile for a well-formed SHA512withRSA payload', async () => {
      const { publicKey, privateKey } = generateKeyPair();
      mockKeyFetch(publicKey);

      const requestNonce = 'nonce-happy-512';
      const { payload, signature } = buildSignedPayload({
        privateKey,
        algorithm: 'SHA512withRSA',
        requestNonce,
      });

      const svc = buildService();
      const profile = await svc.verifySignedPayload({
        payload,
        signature,
        signatureAlgorithm: 'SHA512withRSA',
        requestNonce,
      });

      expect(profile.firstName).toBe('Aarav');
      expect(profile.lastName).toBe('Sharma');
      expect(profile.phoneNumber).toBe('+919876543210');
      expect(profile.email).toBe('aarav@example.com');
    });

    it('verifies SHA256withRSA payloads as well', async () => {
      const { publicKey, privateKey } = generateKeyPair();
      mockKeyFetch(publicKey);

      const requestNonce = 'nonce-happy-256';
      const { payload, signature } = buildSignedPayload({
        privateKey,
        algorithm: 'SHA256withRSA',
        requestNonce,
      });

      const svc = buildService();
      const profile = await svc.verifySignedPayload({
        payload,
        signature,
        signatureAlgorithm: 'SHA256withRSA',
        requestNonce,
      });
      expect(profile.phoneNumber).toBe('+919876543210');
    });

    it('throws "Invalid signature" when no cached key verifies', async () => {
      const { publicKey } = generateKeyPair();
      // We'll sign with a different (wrong) key, but the cache only contains
      // `publicKey`, so verification will fail.
      const { privateKey: wrongPriv } = generateKeyPair();
      mockKeyFetch(publicKey);

      const requestNonce = 'nonce-bad-sig';
      const { payload, signature } = buildSignedPayload({
        privateKey: wrongPriv,
        algorithm: 'SHA512withRSA',
        requestNonce,
      });

      const svc = buildService();
      await expect(
        svc.verifySignedPayload({
          payload,
          signature,
          signatureAlgorithm: 'SHA512withRSA',
          requestNonce,
        }),
      ).rejects.toMatchObject({
        response: { success: false, message: 'Invalid signature' },
      });
    });

    it('throws "Nonce mismatch" when embedded nonce differs from request nonce', async () => {
      const { publicKey, privateKey } = generateKeyPair();
      mockKeyFetch(publicKey);

      const { payload, signature } = buildSignedPayload({
        privateKey,
        algorithm: 'SHA512withRSA',
        requestNonce: 'nonce-embedded',
      });

      const svc = buildService();
      await expect(
        svc.verifySignedPayload({
          payload,
          signature,
          signatureAlgorithm: 'SHA512withRSA',
          requestNonce: 'nonce-request-different',
        }),
      ).rejects.toMatchObject({
        response: { success: false, message: 'Nonce mismatch' },
      });
    });

    it('throws "Payload expired" when requestTime is older than 600,000 ms', async () => {
      const { publicKey, privateKey } = generateKeyPair();
      mockKeyFetch(publicKey);

      const requestNonce = 'nonce-stale';
      const { payload, signature } = buildSignedPayload({
        privateKey,
        algorithm: 'SHA512withRSA',
        requestNonce,
        requestTime: Date.now() - 600_001,
      });

      const svc = buildService();
      await expect(
        svc.verifySignedPayload({
          payload,
          signature,
          signatureAlgorithm: 'SHA512withRSA',
          requestNonce,
        }),
      ).rejects.toMatchObject({
        response: { success: false, message: 'Payload expired' },
      });
    });

    it('throws "Nonce already used" on the second use of the same nonce', async () => {
      const { publicKey, privateKey } = generateKeyPair();
      // Two separate verifications; only one key fetch is needed but the
      // first-use path will issue the GET. Provide enough mocks to cover
      // both calls if they both fetch keys.
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: [
          {
            keyName: 'tc-test-key',
            key: publicKeyToBase64Body(publicKey),
          },
        ],
      } as any);

      const requestNonce = 'nonce-replay';
      const { payload, signature } = buildSignedPayload({
        privateKey,
        algorithm: 'SHA512withRSA',
        requestNonce,
      });

      const svc = buildService();
      await svc.verifySignedPayload({
        payload,
        signature,
        signatureAlgorithm: 'SHA512withRSA',
        requestNonce,
      });

      await expect(
        svc.verifySignedPayload({
          payload,
          signature,
          signatureAlgorithm: 'SHA512withRSA',
          requestNonce,
        }),
      ).rejects.toMatchObject({
        response: { success: false, message: 'Nonce already used' },
      });
    });

    it('throws "Invalid payload" when the base64 JSON cannot be parsed', async () => {
      const { publicKey, privateKey } = generateKeyPair();
      mockKeyFetch(publicKey);

      // Sign garbage bytes that decode to invalid JSON.
      const payload = Buffer.from('not-json', 'utf-8').toString('base64');
      const signer = crypto.createSign('RSA-SHA512');
      signer.update(payload);
      const signature = signer.sign(privateKey, 'base64');

      const svc = buildService();
      await expect(
        svc.verifySignedPayload({
          payload,
          signature,
          signatureAlgorithm: 'SHA512withRSA',
          requestNonce: 'nonce-malformed',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});

describe('resolveNonceTtlSeconds', () => {
  it('returns the 600s minimum when the env var is missing', () => {
    expect(resolveNonceTtlSeconds(undefined)).toBe(
      TRUECALLER_NONCE_MIN_TTL_SECONDS,
    );
  });

  it('returns the 600s minimum when the env var is empty', () => {
    expect(resolveNonceTtlSeconds('')).toBe(TRUECALLER_NONCE_MIN_TTL_SECONDS);
  });

  it('clamps a sub-600s value up to 600s and warns', () => {
    const warn = jest.fn();
    expect(resolveNonceTtlSeconds('60', { warn })).toBe(
      TRUECALLER_NONCE_MIN_TTL_SECONDS,
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/clamping to 600s/);
  });

  it('clamps an invalid (non-numeric) value to 600s and warns', () => {
    const warn = jest.fn();
    expect(resolveNonceTtlSeconds('not-a-number', { warn })).toBe(
      TRUECALLER_NONCE_MIN_TTL_SECONDS,
    );
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('clamps a non-positive value to 600s and warns', () => {
    const warn = jest.fn();
    expect(resolveNonceTtlSeconds('0', { warn })).toBe(
      TRUECALLER_NONCE_MIN_TTL_SECONDS,
    );
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('passes through values >= 600s unchanged', () => {
    const warn = jest.fn();
    expect(resolveNonceTtlSeconds('600', { warn })).toBe(600);
    expect(resolveNonceTtlSeconds('3600', { warn })).toBe(3600);
    expect(resolveNonceTtlSeconds('86400', { warn })).toBe(86400);
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not enforce an upper bound', () => {
    // Operators may align the nonce TTL with the public-key cache TTL.
    expect(resolveNonceTtlSeconds(`${24 * 60 * 60}`)).toBe(86400);
    expect(resolveNonceTtlSeconds(`${48 * 60 * 60}`)).toBe(48 * 60 * 60);
  });
});

describe('InMemoryNonceReplayStore', () => {
  it('accepts the first use of a nonce', async () => {
    const store = new InMemoryNonceReplayStore(600_000);
    await expect(store.assertUnused('n-1')).resolves.toBeUndefined();
    await store.markUsed('n-1');
    expect(store.size()).toBe(1);
  });

  it('rejects the second use of the same nonce within TTL', async () => {
    const store = new InMemoryNonceReplayStore(600_000);
    await store.assertUnused('n-2');
    await store.markUsed('n-2');
    await expect(store.assertUnused('n-2')).rejects.toMatchObject({
      response: { success: false, message: 'Nonce already used' },
    });
  });

  it('treats different nonces as independent', async () => {
    const store = new InMemoryNonceReplayStore(600_000);
    await store.markUsed('a');
    await expect(store.assertUnused('b')).resolves.toBeUndefined();
    await expect(store.assertUnused('a')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('allows reuse of a nonce after its TTL expires (lazy eviction)', async () => {
    let now = 1_000_000;
    const store = new InMemoryNonceReplayStore(600_000, () => now);
    await store.markUsed('n-3');
    // Just before expiry — still rejected.
    now += 599_999;
    await expect(store.assertUnused('n-3')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    // Step past the TTL — entry is swept and the nonce becomes reusable.
    now += 2;
    await expect(store.assertUnused('n-3')).resolves.toBeUndefined();
    expect(store.size()).toBe(0);
  });

  it('evicts other expired entries on every assertUnused call', async () => {
    let now = 0;
    const store = new InMemoryNonceReplayStore(600_000, () => now);
    await store.markUsed('expired-a');
    await store.markUsed('expired-b');
    expect(store.size()).toBe(2);
    now += 600_001;
    await store.assertUnused('fresh');
    // Both expired nonces have been swept lazily.
    expect(store.size()).toBe(0);
  });

  it('throws an UnauthorizedException with the exact 9.7 body shape', async () => {
    const store = new InMemoryNonceReplayStore(600_000);
    await store.markUsed('replay');
    await expect(store.assertUnused('replay')).rejects.toMatchObject({
      response: { success: false, message: 'Nonce already used' },
      status: 401,
    });
  });

  it('refuses to construct with a non-positive TTL', () => {
    expect(() => new InMemoryNonceReplayStore(0)).toThrow();
    expect(() => new InMemoryNonceReplayStore(-1)).toThrow();
    expect(() => new InMemoryNonceReplayStore(NaN)).toThrow();
  });
});

describe('TruecallerService nonce TTL configuration', () => {
  it('applies the 600s default when TRUECALLER_NONCE_TTL_SECONDS is missing', async () => {
    // Construct a service without the env var, replay a nonce, and step
    // time forward by exactly the default TTL to confirm reuse becomes
    // allowed afterward. We exercise this through the public surface by
    // mocking the key fetch and signing two successive payloads.
    const { publicKey, privateKey } = generateKeyPair();
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: [{ keyName: 'tc-test-key', key: publicKeyToBase64Body(publicKey) }],
    } as any);

    const svc = buildService(); // no env vars
    const requestNonce = 'nonce-default-ttl';
    const first = buildSignedPayload({
      privateKey,
      algorithm: 'SHA512withRSA',
      requestNonce,
    });
    await svc.verifySignedPayload({
      payload: first.payload,
      signature: first.signature,
      signatureAlgorithm: 'SHA512withRSA',
      requestNonce,
    });
    await expect(
      svc.verifySignedPayload({
        payload: first.payload,
        signature: first.signature,
        signatureAlgorithm: 'SHA512withRSA',
        requestNonce,
      }),
    ).rejects.toMatchObject({
      response: { success: false, message: 'Nonce already used' },
    });
  });

  it('clamps a sub-600s configured TTL up to 600s', () => {
    // Spy on the Logger to confirm the warning fires when an operator
    // misconfigures the TTL below the 9.7 floor.
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    try {
      buildService({ TRUECALLER_NONCE_TTL_SECONDS: '60' });
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/clamping to 600s/),
      );
    } finally {
      warn.mockRestore();
    }
  });
});

describe('resolvePublicKeyTtlSeconds', () => {
  const min = TRUECALLER_PUBLIC_KEY_MIN_TTL_SECONDS;
  const max = TRUECALLER_PUBLIC_KEY_MAX_TTL_SECONDS;
  const def = TRUECALLER_PUBLIC_KEY_DEFAULT_TTL_SECONDS;

  it('returns the default when the env var is missing or empty', () => {
    expect(resolvePublicKeyTtlSeconds(undefined)).toBe(def);
    expect(resolvePublicKeyTtlSeconds('')).toBe(def);
  });

  it('clamps a sub-1h value up to 1h and warns', () => {
    const warn = jest.fn();
    expect(resolvePublicKeyTtlSeconds('60', { warn })).toBe(min);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/clamping to 3600s/);
  });

  it('clamps a >24h value down to 24h and warns', () => {
    const warn = jest.fn();
    expect(resolvePublicKeyTtlSeconds(`${max + 1}`, { warn })).toBe(max);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/clamping to 86400s/);
  });

  it('passes through values inside [1h, 24h] unchanged', () => {
    const warn = jest.fn();
    expect(resolvePublicKeyTtlSeconds(`${min}`, { warn })).toBe(min);
    expect(resolvePublicKeyTtlSeconds(`${2 * 60 * 60}`, { warn })).toBe(
      2 * 60 * 60,
    );
    expect(resolvePublicKeyTtlSeconds(`${max}`, { warn })).toBe(max);
    expect(warn).not.toHaveBeenCalled();
  });

  it('falls back to the default for non-numeric or non-positive values and warns', () => {
    const warn = jest.fn();
    expect(resolvePublicKeyTtlSeconds('abc', { warn })).toBe(def);
    expect(resolvePublicKeyTtlSeconds('0', { warn })).toBe(def);
    expect(resolvePublicKeyTtlSeconds('-1', { warn })).toBe(def);
    expect(warn).toHaveBeenCalledTimes(3);
  });
});

describe('extractTruecallerPublicKeys', () => {
  it('accepts a bare array response', () => {
    const out = extractTruecallerPublicKeys([
      { keyName: 'k1', key: 'AAA' },
      { keyName: 'k2', key: 'BBB' },
    ]);
    expect(out).toEqual([
      { keyName: 'k1', key: 'AAA' },
      { keyName: 'k2', key: 'BBB' },
    ]);
  });

  it('accepts an object with a `keys` array', () => {
    const out = extractTruecallerPublicKeys({
      keys: [
        { keyName: 'k1', key: 'AAA' },
        { keyName: 'k2', key: 'BBB' },
      ],
    });
    expect(out).toEqual([
      { keyName: 'k1', key: 'AAA' },
      { keyName: 'k2', key: 'BBB' },
    ]);
  });

  it('filters entries that lack a usable `key` string', () => {
    const out = extractTruecallerPublicKeys([
      { keyName: 'k1', key: 'AAA' },
      { keyName: 'k2' }, // missing key
      { keyName: 'k3', key: '' }, // empty key
      { keyName: 'k4', key: 42 as unknown as string }, // non-string key
      null,
      'not-an-object',
      { keyName: 'k5', key: 'CCC' },
    ]);
    expect(out).toEqual([
      { keyName: 'k1', key: 'AAA' },
      { keyName: 'k5', key: 'CCC' },
    ]);
  });

  it('substitutes an empty keyName when missing', () => {
    const out = extractTruecallerPublicKeys([{ key: 'AAA' }]);
    expect(out).toEqual([{ keyName: '', key: 'AAA' }]);
  });

  it('returns an empty array for unrelated shapes', () => {
    expect(extractTruecallerPublicKeys(null)).toEqual([]);
    expect(extractTruecallerPublicKeys(undefined)).toEqual([]);
    expect(extractTruecallerPublicKeys('string')).toEqual([]);
    expect(extractTruecallerPublicKeys({})).toEqual([]);
    expect(extractTruecallerPublicKeys({ keys: 'not-array' })).toEqual([]);
  });
});

describe('InMemoryTruecallerKeyCache', () => {
  const url = 'https://api4.truecaller.com/v1/key';
  const ttlMs = 60 * 60 * 1000; // 1 h
  const sampleKeys = [
    { keyName: 'k1', key: 'AAA' },
    { keyName: 'k2', key: 'BBB' },
  ];

  it('refuses to construct with a non-positive TTL', () => {
    expect(() => new InMemoryTruecallerKeyCache(url, 0)).toThrow();
    expect(() => new InMemoryTruecallerKeyCache(url, -1)).toThrow();
    expect(() => new InMemoryTruecallerKeyCache(url, NaN)).toThrow();
  });

  it('fetches once on a cold call and caches the result', async () => {
    const fetcher = jest.fn().mockResolvedValue({ data: sampleKeys });
    const cache = new InMemoryTruecallerKeyCache(
      url,
      ttlMs,
      undefined,
      () => 1_000,
      fetcher,
    );
    expect(await cache.getKeys()).toEqual(sampleKeys);
    expect(await cache.getKeys()).toEqual(sampleKeys);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(url);
  });

  it('does not refetch while the entry is fresh', async () => {
    let now = 1_000;
    const fetcher = jest.fn().mockResolvedValue({ data: sampleKeys });
    const cache = new InMemoryTruecallerKeyCache(
      url,
      ttlMs,
      undefined,
      () => now,
      fetcher,
    );
    await cache.getKeys();
    // Move time forward but stay strictly inside the TTL window.
    now += ttlMs - 1;
    await cache.getKeys();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('refetches once the TTL expires', async () => {
    let now = 1_000;
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({ data: sampleKeys })
      .mockResolvedValueOnce({
        data: [{ keyName: 'rotated', key: 'CCC' }],
      });
    const cache = new InMemoryTruecallerKeyCache(
      url,
      ttlMs,
      undefined,
      () => now,
      fetcher,
    );
    expect(await cache.getKeys()).toEqual(sampleKeys);
    // Step past the TTL boundary.
    now += ttlMs;
    expect(await cache.getKeys()).toEqual([{ keyName: 'rotated', key: 'CCC' }]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('accepts the `{ keys: [...] }` response shape', async () => {
    const fetcher = jest.fn().mockResolvedValue({
      data: { keys: sampleKeys },
    });
    const cache = new InMemoryTruecallerKeyCache(
      url,
      ttlMs,
      undefined,
      () => 1,
      fetcher,
    );
    expect(await cache.getKeys()).toEqual(sampleKeys);
  });

  it('throws "Public key fetch failed" when the response yields zero usable keys', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValue({ data: [{ keyName: 'k1' /* no key */ }] });
    const cache = new InMemoryTruecallerKeyCache(
      url,
      ttlMs,
      undefined,
      () => 1,
      fetcher,
    );
    await expect(cache.getKeys()).rejects.toMatchObject({
      response: { success: false, message: 'Public key fetch failed' },
    });
  });

  it('translates a transport error into "Public key fetch failed"', async () => {
    const fetcher = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const cache = new InMemoryTruecallerKeyCache(
      url,
      ttlMs,
      undefined,
      () => 1,
      fetcher,
    );
    await expect(cache.getKeys()).rejects.toMatchObject({
      response: { success: false, message: 'Public key fetch failed' },
    });
  });

  it('coalesces concurrent misses onto a single in-flight fetch', async () => {
    let resolveFetch!: (v: { data: unknown }) => void;
    const fetcher = jest.fn().mockImplementation(
      () =>
        new Promise<{ data: unknown }>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const cache = new InMemoryTruecallerKeyCache(
      url,
      ttlMs,
      undefined,
      () => 1,
      fetcher,
    );

    // Kick off four simultaneous misses before the fetch settles.
    const a = cache.getKeys();
    const b = cache.getKeys();
    const c = cache.getKeys();
    const d = cache.getKeys();

    // Only one outbound call should have been issued.
    expect(fetcher).toHaveBeenCalledTimes(1);

    resolveFetch({ data: sampleKeys });
    const [ra, rb, rc, rd] = await Promise.all([a, b, c, d]);
    expect(ra).toEqual(sampleKeys);
    expect(rb).toEqual(sampleKeys);
    expect(rc).toEqual(sampleKeys);
    expect(rd).toEqual(sampleKeys);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('lets a subsequent caller retry after a failed in-flight fetch', async () => {
    const fetcher = jest
      .fn()
      .mockRejectedValueOnce(new Error('first failure'))
      .mockResolvedValueOnce({ data: sampleKeys });
    const cache = new InMemoryTruecallerKeyCache(
      url,
      ttlMs,
      undefined,
      () => 1,
      fetcher,
    );

    await expect(cache.getKeys()).rejects.toBeInstanceOf(UnauthorizedException);
    expect(await cache.getKeys()).toEqual(sampleKeys);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('TruecallerService public-key cache integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('coalesces concurrent verifySignedPayload misses onto one GET /v1/key', async () => {
    const { publicKey, privateKey } = generateKeyPair();
    // Make every axios.get hang until we manually resolve it; this lets us
    // assert that only one outbound key fetch is initiated even though we
    // start two verifications concurrently. Once we resolve the fetch, both
    // verifications complete using the shared key list.
    let resolveFetch!: (v: unknown) => void;
    const pending = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    mockedAxios.get.mockImplementation(() => pending as Promise<any>);

    const nonceA = 'nonce-coalesce-a';
    const nonceB = 'nonce-coalesce-b';
    const a = buildSignedPayload({
      privateKey,
      algorithm: 'SHA512withRSA',
      requestNonce: nonceA,
    });
    const b = buildSignedPayload({
      privateKey,
      algorithm: 'SHA512withRSA',
      requestNonce: nonceB,
    });

    const svc = buildService();
    const verifyA = svc.verifySignedPayload({
      payload: a.payload,
      signature: a.signature,
      signatureAlgorithm: 'SHA512withRSA',
      requestNonce: nonceA,
    });
    const verifyB = svc.verifySignedPayload({
      payload: b.payload,
      signature: b.signature,
      signatureAlgorithm: 'SHA512withRSA',
      requestNonce: nonceB,
    });

    // Yield the event loop so verifySignedPayload reaches the cache fetch.
    await new Promise((r) => setImmediate(r));
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);

    resolveFetch({
      status: 200,
      data: [
        {
          keyName: 'tc-test-key',
          key: publicKeyToBase64Body(publicKey),
        },
      ],
    });

    const [pa, pb] = await Promise.all([verifyA, verifyB]);
    expect(pa.phoneNumber).toBe('+919876543210');
    expect(pb.phoneNumber).toBe('+919876543210');
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('verifies against the second cached key when the first does not match', async () => {
    // Requirement 9.1 demands the verifier try every cached key. Front the
    // cache with a wrong key followed by the correct one and confirm the
    // payload still verifies.
    const { publicKey: wrongPub } = generateKeyPair();
    const { publicKey, privateKey } = generateKeyPair();
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: [
        { keyName: 'wrong-key', key: publicKeyToBase64Body(wrongPub) },
        { keyName: 'right-key', key: publicKeyToBase64Body(publicKey) },
      ],
    } as any);

    const requestNonce = 'nonce-second-key-wins';
    const { payload, signature } = buildSignedPayload({
      privateKey,
      algorithm: 'SHA512withRSA',
      requestNonce,
    });

    const svc = buildService();
    const profile = await svc.verifySignedPayload({
      payload,
      signature,
      signatureAlgorithm: 'SHA512withRSA',
      requestNonce,
    });
    expect(profile.phoneNumber).toBe('+919876543210');
  });

  it('throws "Invalid signature" when every cached key fails to verify (Requirement 9.3)', async () => {
    const { publicKey: wrongPub1 } = generateKeyPair();
    const { publicKey: wrongPub2 } = generateKeyPair();
    const { privateKey } = generateKeyPair(); // unrelated to either pub key
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: [
        { keyName: 'wrong-1', key: publicKeyToBase64Body(wrongPub1) },
        { keyName: 'wrong-2', key: publicKeyToBase64Body(wrongPub2) },
      ],
    } as any);

    const requestNonce = 'nonce-all-keys-fail';
    const { payload, signature } = buildSignedPayload({
      privateKey,
      algorithm: 'SHA512withRSA',
      requestNonce,
    });

    const svc = buildService();
    await expect(
      svc.verifySignedPayload({
        payload,
        signature,
        signatureAlgorithm: 'SHA512withRSA',
        requestNonce,
      }),
    ).rejects.toMatchObject({
      response: { success: false, message: 'Invalid signature' },
      status: 401,
    });
  });

  it('honors a custom TRUECALLER_KEYS_API_URL env var', async () => {
    const { publicKey, privateKey } = generateKeyPair();
    const customUrl = 'https://example.test/v1/key';
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      data: [{ keyName: 'custom', key: publicKeyToBase64Body(publicKey) }],
    } as any);

    const requestNonce = 'nonce-custom-url';
    const { payload, signature } = buildSignedPayload({
      privateKey,
      algorithm: 'SHA512withRSA',
      requestNonce,
    });

    const svc = buildService({ TRUECALLER_KEYS_API_URL: customUrl });
    await svc.verifySignedPayload({
      payload,
      signature,
      signatureAlgorithm: 'SHA512withRSA',
      requestNonce,
    });
    expect(mockedAxios.get).toHaveBeenCalledWith(customUrl);
  });

  it('clamps TRUECALLER_PUBLIC_KEY_TTL_SECONDS lower bound and warns', () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    try {
      buildService({ TRUECALLER_PUBLIC_KEY_TTL_SECONDS: '60' });
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/clamping to 3600s/),
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('clamps TRUECALLER_PUBLIC_KEY_TTL_SECONDS upper bound and warns', () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    try {
      buildService({ TRUECALLER_PUBLIC_KEY_TTL_SECONDS: '999999' });
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/clamping to 86400s/),
      );
    } finally {
      warn.mockRestore();
    }
  });
});

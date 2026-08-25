/**
 * Integration tests for {@link TruecallerService} that exercise the real
 * `axios` HTTP client (no `jest.mock('axios')`) and intercept outbound
 * requests with `nock` against the canonical Truecaller endpoints
 * `api4.truecaller.com/v1/key` and `api5.truecaller.com/v1/otp/.../verify/profile`.
 *
 * These tests complement {@link ./truecaller.service.spec.ts} (which mocks
 * axios at the module level and tests the verifier in isolation): here we
 * verify that the service correctly drives axios's real request pipeline
 * — URL construction, headers, response handling, and error translation —
 * end-to-end against a network interceptor, satisfying task 11.1.
 *
 * The missed-call/OTP access token is validated against the documented
 * `GET .../phoneNumberDetail/{accessToken}` endpoint on
 * `sdk-otp-verification-noneu.truecaller.com`, with the client id sent as
 * a `clientId` header.
 *
 * Validates: Requirements 9.1, 9.3, 9.5, 9.6, 9.7, 10.2, 10.3, 10.4
 */

import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import nock from 'nock';

import { TruecallerService } from './truecaller.service';

const API4_HOST = 'https://api4.truecaller.com';
const API4_PATH = '/v1/key';
const OTP_HOST = 'https://sdk-otp-verification-noneu.truecaller.com';
const OTP_PATH_BASE = '/v1/otp/client/installation/phoneNumberDetail';
const DEFAULT_CLIENT_ID = 'e98dcupeqtmcocbxr7qb4g7b4sub8blazhxrt-1ikmw';

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

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
  return new TruecallerService(new ConfigService(env));
}

// Each test gets its own service instance so the in-memory key cache and
// nonce replay store start empty. `nock` resets between tests so leftover
// interceptors do not cross-contaminate.

describe('TruecallerService integration (nock)', () => {
  beforeAll(() => {
    // Hard-fail any test that escapes the interceptor; the verifier must
    // never make uninstrumented network calls during these tests.
    nock.disableNetConnect();
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    // Surface any interceptors that were set up but never matched — usually
    // a sign that the service hit a different URL than expected.
    if (!nock.isDone()) {
      const pending = nock.pendingMocks();
      nock.cleanAll();
      throw new Error(
        `Unmatched nock interceptors: ${JSON.stringify(pending)}`,
      );
    }
  });

  // ──────────────────────────────────────────────────────────────────
  // verifySignedPayload — One-Tap flow against api4.truecaller.com
  // ──────────────────────────────────────────────────────────────────

  describe('verifySignedPayload against api4.truecaller.com/v1/key', () => {
    it('Requirement 9.1 — accepts a valid RSA-SHA512 signature using a key returned by /v1/key', async () => {
      const { publicKey, privateKey } = generateKeyPair();
      nock(API4_HOST)
        .get(API4_PATH)
        .reply(200, [
          { keyName: 'tc-prod-1', key: publicKeyToBase64Body(publicKey) },
        ]);

      const requestNonce = `nonce-happy-512-${Date.now()}`;
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
      expect(profile.firstName).toBe('Aarav');
      expect(profile.lastName).toBe('Sharma');
      expect(profile.email).toBe('aarav@example.com');
    });

    it('Requirement 9.1 — accepts a valid RSA-SHA256 signature when the SDK reports SHA256withRSA', async () => {
      const { publicKey, privateKey } = generateKeyPair();
      nock(API4_HOST)
        .get(API4_PATH)
        .reply(200, [
          { keyName: 'tc-prod-1', key: publicKeyToBase64Body(publicKey) },
        ]);

      const requestNonce = `nonce-happy-256-${Date.now()}`;
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

    it('Requirement 9.1 — accepts the `{ keys: [...] }` response shape', async () => {
      const { publicKey, privateKey } = generateKeyPair();
      nock(API4_HOST)
        .get(API4_PATH)
        .reply(200, {
          keys: [
            { keyName: 'tc-prod-1', key: publicKeyToBase64Body(publicKey) },
          ],
        });

      const requestNonce = `nonce-keys-shape-${Date.now()}`;
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

    it('Requirement 9.1 — tries every cached key and accepts when any one verifies', async () => {
      const { publicKey: pkRight, privateKey } = generateKeyPair();
      const { publicKey: pkOther1 } = generateKeyPair();
      const { publicKey: pkOther2 } = generateKeyPair();
      nock(API4_HOST)
        .get(API4_PATH)
        .reply(200, [
          // Two unrelated keys first, then the matching one — the service
          // must iterate until a key validates rather than bailing on the
          // first non-match.
          { keyName: 'rotated-out-1', key: publicKeyToBase64Body(pkOther1) },
          { keyName: 'rotated-out-2', key: publicKeyToBase64Body(pkOther2) },
          { keyName: 'tc-prod-current', key: publicKeyToBase64Body(pkRight) },
        ]);

      const requestNonce = `nonce-multi-key-${Date.now()}`;
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

    it('Requirement 9.3 — rejects a forged payload with "Invalid signature" when no cached key verifies', async () => {
      const { publicKey } = generateKeyPair();
      // Sign with a key that is not in the cache so verification has no
      // chance of succeeding.
      const { privateKey: wrongPriv } = generateKeyPair();
      nock(API4_HOST)
        .get(API4_PATH)
        .reply(200, [
          { keyName: 'tc-prod-1', key: publicKeyToBase64Body(publicKey) },
        ]);

      const requestNonce = `nonce-bad-sig-${Date.now()}`;
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
        status: 401,
      });
    });

    it('Requirement 9.3 — rejects a one-byte tampered payload with "Invalid signature"', async () => {
      const { publicKey, privateKey } = generateKeyPair();
      nock(API4_HOST)
        .get(API4_PATH)
        .reply(200, [
          { keyName: 'tc-prod-1', key: publicKeyToBase64Body(publicKey) },
        ]);

      const requestNonce = `nonce-tamper-${Date.now()}`;
      const { payload, signature } = buildSignedPayload({
        privateKey,
        algorithm: 'SHA512withRSA',
        requestNonce,
      });

      // Flip a single byte in the base64 payload so the signature no longer
      // matches; the "Tamper one byte → expect 401" Manual QA Gate C.
      const buf = Buffer.from(payload, 'base64');
      buf[0] = buf[0] ^ 0x01;
      const tampered = buf.toString('base64');

      const svc = buildService();
      await expect(
        svc.verifySignedPayload({
          payload: tampered,
          signature,
          signatureAlgorithm: 'SHA512withRSA',
          requestNonce,
        }),
      ).rejects.toMatchObject({
        response: { success: false, message: 'Invalid signature' },
      });
    });

    it('Requirement 9.5 — rejects with "Nonce mismatch" when embedded nonce differs from request nonce', async () => {
      const { publicKey, privateKey } = generateKeyPair();
      nock(API4_HOST)
        .get(API4_PATH)
        .reply(200, [
          { keyName: 'tc-prod-1', key: publicKeyToBase64Body(publicKey) },
        ]);

      // The payload embeds nonce A but the request body claims nonce B.
      const embeddedNonce = `nonce-embedded-${Date.now()}`;
      const requestNonce = `nonce-request-${Date.now()}-different`;
      const { payload, signature } = buildSignedPayload({
        privateKey,
        algorithm: 'SHA512withRSA',
        requestNonce: embeddedNonce,
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
        response: { success: false, message: 'Nonce mismatch' },
        status: 401,
      });
    });

    it('Requirement 9.6 — rejects with "Payload expired" when requestTime is older than 600,000 ms', async () => {
      const { publicKey, privateKey } = generateKeyPair();
      nock(API4_HOST)
        .get(API4_PATH)
        .reply(200, [
          { keyName: 'tc-prod-1', key: publicKeyToBase64Body(publicKey) },
        ]);

      const requestNonce = `nonce-stale-${Date.now()}`;
      const { payload, signature } = buildSignedPayload({
        privateKey,
        algorithm: 'SHA512withRSA',
        requestNonce,
        // Push requestTime just past the 10-minute freshness window.
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
        status: 401,
      });
    });

    it('Requirement 9.7 — rejects a replay of the same nonce with "Nonce already used"', async () => {
      const { publicKey, privateKey } = generateKeyPair();
      // The first verification fetches keys (cold cache); the second
      // verification reuses the cache, so only one /v1/key interceptor is
      // needed. Manual QA Gate D mirrors this scenario end-to-end.
      nock(API4_HOST)
        .get(API4_PATH)
        .reply(200, [
          { keyName: 'tc-prod-1', key: publicKeyToBase64Body(publicKey) },
        ]);

      const requestNonce = `nonce-replay-${Date.now()}`;
      const { payload, signature } = buildSignedPayload({
        privateKey,
        algorithm: 'SHA512withRSA',
        requestNonce,
      });

      const svc = buildService();
      // First use: success.
      await svc.verifySignedPayload({
        payload,
        signature,
        signatureAlgorithm: 'SHA512withRSA',
        requestNonce,
      });
      // Second use of the same nonce: rejected.
      await expect(
        svc.verifySignedPayload({
          payload,
          signature,
          signatureAlgorithm: 'SHA512withRSA',
          requestNonce,
        }),
      ).rejects.toMatchObject({
        response: { success: false, message: 'Nonce already used' },
        status: 401,
      });
    });

    it('translates a /v1/key transport failure into "Public key fetch failed"', async () => {
      // No interceptor for the path → nock rejects the request, simulating
      // a Truecaller outage. The verifier surfaces this distinct from
      // "Invalid signature" so operations can tell the two apart.
      nock(API4_HOST).get(API4_PATH).replyWithError('ECONNREFUSED');

      const { privateKey } = generateKeyPair();
      const requestNonce = `nonce-transport-fail-${Date.now()}`;
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
        response: { success: false, message: 'Public key fetch failed' },
      });
    });

    it('translates a /v1/key 5xx response into "Public key fetch failed"', async () => {
      nock(API4_HOST).get(API4_PATH).reply(503, '<html>maintenance</html>');

      const { privateKey } = generateKeyPair();
      const requestNonce = `nonce-5xx-${Date.now()}`;
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
        response: { success: false, message: 'Public key fetch failed' },
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // verifyAccessToken — OTP flow against api5.truecaller.com
  // ──────────────────────────────────────────────────────────────────

  describe('verifyAccessToken against phoneNumberDetail OTP API', () => {
    it('happy path — validates token via path segment + clientId header and returns E.164 phone', async () => {
      nock(OTP_HOST, {
        reqheaders: { clientid: DEFAULT_CLIENT_ID },
      })
        .get(`${OTP_PATH_BASE}/access-tok-happy`)
        .reply(200, { phoneNumber: '919876543210', countryCode: 'IN' });

      const svc = buildService();
      const profile = await svc.verifyAccessToken(
        'access-tok-happy',
        '9876543210',
      );

      // Endpoint returns no name — the caller supplies the display name, so
      // the verifier defaults firstName to 'User'.
      expect(profile.phoneNumber).toBe('+919876543210');
      expect(profile.firstName).toBe('User');
    });

    it('Requirement 10.4 — accepts +91-prefixed and bare 10-digit numbers as equal', async () => {
      nock(OTP_HOST)
        .get(`${OTP_PATH_BASE}/tok`)
        .reply(200, { phoneNumber: '919876543210', countryCode: 'IN' });

      const svc = buildService();
      const profile = await svc.verifyAccessToken('tok', '9876543210');
      expect(profile.phoneNumber).toBe('+919876543210');
    });

    it('Requirement 10.2 — rejects with "Invalid access token" on HTTP 404 (invalid token)', async () => {
      nock(OTP_HOST)
        .get(`${OTP_PATH_BASE}/expired-tok`)
        .reply(404, { code: 1404, message: 'Invalid access token.' });

      const svc = buildService();
      await expect(
        svc.verifyAccessToken('expired-tok', '+919876543210'),
      ).rejects.toMatchObject({
        response: { success: false, message: 'Invalid access token' },
        status: 401,
      });
    });

    it('Requirement 10.2 — rejects with "Invalid access token" on HTTP 404 (invalid partner credentials)', async () => {
      nock(OTP_HOST)
        .get(`${OTP_PATH_BASE}/forbidden-tok`)
        .reply(404, { code: 404, message: 'Invalid partner credentials.' });

      const svc = buildService();
      await expect(
        svc.verifyAccessToken('forbidden-tok', '+919876543210'),
      ).rejects.toMatchObject({
        response: { success: false, message: 'Invalid access token' },
      });
    });

    it('Requirement 10.2 — rejects with "Invalid access token" on HTTP 500', async () => {
      nock(OTP_HOST).get(`${OTP_PATH_BASE}/tok`).reply(500, 'internal error');

      const svc = buildService();
      await expect(
        svc.verifyAccessToken('tok', '+919876543210'),
      ).rejects.toMatchObject({
        response: { success: false, message: 'Invalid access token' },
      });
    });

    it('Requirement 10.3 — rejects with "Invalid Truecaller profile" when phoneNumber is missing', async () => {
      nock(OTP_HOST)
        .get(`${OTP_PATH_BASE}/tok`)
        .reply(200, { countryCode: 'IN' });

      const svc = buildService();
      await expect(
        svc.verifyAccessToken('tok', '+919876543210'),
      ).rejects.toMatchObject({
        response: { success: false, message: 'Invalid Truecaller profile' },
        status: 401,
      });
    });

    it('Requirement 10.3 — rejects with "Invalid Truecaller profile" when phoneNumber is empty string', async () => {
      nock(OTP_HOST)
        .get(`${OTP_PATH_BASE}/tok`)
        .reply(200, { phoneNumber: '', countryCode: 'IN' });

      const svc = buildService();
      await expect(
        svc.verifyAccessToken('tok', '+919876543210'),
      ).rejects.toMatchObject({
        response: { success: false, message: 'Invalid Truecaller profile' },
      });
    });

    it('Requirement 10.4 — rejects with "Phone number mismatch" when normalized phones differ', async () => {
      nock(OTP_HOST)
        .get(`${OTP_PATH_BASE}/tok`)
        .reply(200, { phoneNumber: '918888888888', countryCode: 'IN' });

      const svc = buildService();
      await expect(
        svc.verifyAccessToken('tok', '+919876543210'),
      ).rejects.toMatchObject({
        response: { success: false, message: 'Phone number mismatch' },
        status: 401,
      });
    });

    it('translates a transport failure into "Invalid access token"', async () => {
      // Connection drops before the response is received; the verifier
      // collapses every network-level failure into the standard 10.2
      // response so no implementation detail leaks to the client.
      nock(OTP_HOST).get(`${OTP_PATH_BASE}/tok`).replyWithError('ECONNRESET');

      const svc = buildService();
      await expect(
        svc.verifyAccessToken('tok', '+919876543210'),
      ).rejects.toMatchObject({
        response: { success: false, message: 'Invalid access token' },
      });
    });

    it('honors a custom TRUECALLER_OTP_VERIFY_URL env var', async () => {
      const customBase = 'https://staging-otp.example.test/v1/phoneNumberDetail';
      nock('https://staging-otp.example.test', {
        reqheaders: { clientid: DEFAULT_CLIENT_ID },
      })
        .get('/v1/phoneNumberDetail/staging-tok')
        .reply(200, { phoneNumber: '919876543210', countryCode: 'IN' });

      const svc = buildService({
        TRUECALLER_OTP_VERIFY_URL: customBase,
      });
      const profile = await svc.verifyAccessToken(
        'staging-tok',
        '+919876543210',
      );
      expect(profile.phoneNumber).toBe('+919876543210');
    });
  });
});

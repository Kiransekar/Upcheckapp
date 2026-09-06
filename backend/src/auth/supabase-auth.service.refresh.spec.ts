/**
 * A refresh that FAILS TO REACH Supabase is not proof the session is gone.
 *
 * `refreshSession` mapped every error to `UnauthorizedException`. The phone
 * treats a 401 from this endpoint as "the refresh token was revoked" and calls
 * `clearSession()` — wiping the session and every cached read. So a transient
 * failure between this server and Supabase (timeout, 5xx, rate limit) signed
 * the farmer out of their phone and then asked them to sign in again against
 * the service that is currently unreachable. That is the reported "app logs me
 * out on network errors".
 *
 * Only Supabase SAYING the credential is bad (400/401/403) ends the session.
 * Everything else is a 503, which the client already handles by staying
 * authenticated against cached data and retrying on reconnect.
 */
import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SupabaseAuthService } from './supabase-auth.service';

const createClientMock = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

const buildService = (refreshResult: { data: any; error: any }) => {
  createClientMock.mockReturnValue({
    auth: { refreshSession: jest.fn().mockResolvedValue(refreshResult) },
  });
  return new SupabaseAuthService(
    new ConfigService({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_ANON_KEY: 'anon',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
    }),
  );
};

describe('SupabaseAuthService.refreshSession', () => {
  beforeEach(() => createClientMock.mockReset());

  it('returns the refreshed session on success', async () => {
    const session = { access_token: 'at', refresh_token: 'rt' };
    const service = buildService({
      data: { user: { id: 'u1' }, session },
      error: null,
    });

    await expect(service.refreshSession('rt-old')).resolves.toEqual({
      user: { id: 'u1' },
      session,
    });
  });

  it.each([400, 401, 403])(
    'ends the session when Supabase rejects the token (%i)',
    async (status) => {
      const service = buildService({
        data: {},
        error: { status, message: 'Invalid Refresh Token' },
      });

      await expect(service.refreshSession('rt-revoked')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    },
  );

  it.each([500, 502, 503, 429])(
    'does NOT end the session when Supabase itself is failing (%i)',
    async (status) => {
      const service = buildService({
        data: {},
        error: { status, message: 'upstream boom' },
      });

      await expect(service.refreshSession('rt-good')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    },
  );

  it('does NOT end the session when the request never got a status at all', async () => {
    // What `AuthRetryableFetchError` looks like: the fetch died, so there is no
    // HTTP status. This is the exact shape a farmer's flaky connection produces
    // and the exact case that used to log them out.
    const service = buildService({
      data: {},
      error: { message: 'fetch failed' },
    });

    await expect(service.refreshSession('rt-good')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

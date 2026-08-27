/**
 * Auth and data must not share a Supabase client.
 *
 * The failure this pins was found in production logs, and it is invisible in
 * code review because nothing looks wrong at any single call site:
 *
 *   GET  /rest/v1/users        200   (returned NOTHING — RLS filtered it)
 *   GET  /rest/v1/users        200   (same)
 *   POST /auth/v1/admin/users  200   (so the service key is genuinely valid)
 *   POST /rest/v1/users        403   "new row violates row-level security policy"
 *
 * `mintSession` signs a user in via `auth.verifyOtp` on the shared client.
 * `persistSession: false` keeps that session out of storage but NOT out of
 * memory, so from that moment supabase-js attaches the USER's access token to
 * every `.from()` call instead of the service key. PostgREST then sees
 * `authenticated` rather than `service_role`, RLS applies, and — with RLS
 * enabled and no policies — SELECT silently returns zero rows while INSERT
 * 403s. The silent SELECT is the dangerous half: the Truecaller flow concluded
 * the user did not exist and tried to create them again.
 *
 * So the invariant is structural: the client used for `.from()` is a different
 * instance from the one that signs people in.
 */
import { ConfigService } from '@nestjs/config';

const createClientMock = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

import { SupabaseAuthService } from './supabase-auth.service';

const config = () =>
  new ConfigService({
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
  });

describe('auth and data clients are separate instances', () => {
  beforeEach(() => createClientMock.mockReset());

  it('constructs two clients, not one', () => {
    createClientMock.mockImplementation(() => ({ auth: {}, from: jest.fn() }));

    new SupabaseAuthService(config());

    expect(createClientMock).toHaveBeenCalledTimes(2);
  });

  it('gives the data client its own object identity', () => {
    // Same key, same options — but two objects, so a session established on one
    // cannot change the Authorization header used by the other.
    const made: unknown[] = [];
    createClientMock.mockImplementation(() => {
      const client = { auth: {}, from: jest.fn() };
      made.push(client);
      return client;
    });

    const svc = new SupabaseAuthService(config()) as unknown as Record<string, unknown>;

    expect(made).toHaveLength(2);
    expect(svc.supabase).not.toBe(svc.supabaseData);
  });

  it('builds both with the service-role key', () => {
    // The data client must NOT quietly fall back to the anon key: it needs to
    // bypass RLS, which is the whole point of separating it.
    createClientMock.mockImplementation(() => ({ auth: {}, from: jest.fn() }));

    new SupabaseAuthService(config());

    for (const call of createClientMock.mock.calls) {
      expect(call[0]).toBe('https://example.supabase.co');
      expect(call[1]).toBe('service');
    }
  });
});

describe('no data call rides on the auth client', () => {
  it('the service source contains no `.from(` on the auth client', () => {
    // A structural check, because the runtime symptom only appears AFTER some
    // unrelated auth call has left a session behind — which no unit test of a
    // single method would reproduce.
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const source = fs.readFileSync(path.join(__dirname, 'supabase-auth.service.ts'), 'utf8');

    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    // `this.supabase.from(` or `this.supabase\n  .from(` — either shape is the bug.
    const offenders = code.match(/this\.supabase\s*\.from\(/g) ?? [];
    expect(offenders).toEqual([]);
  });

  it('the data client never signs anyone in', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const source = fs.readFileSync(path.join(__dirname, 'supabase-auth.service.ts'), 'utf8');
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    // The reverse mistake: putting an auth call on the data client would
    // re-create exactly the same poisoning, in the other direction.
    const offenders = code.match(/this\.supabaseData\s*\.auth\b/g) ?? [];
    expect(offenders).toEqual([]);
  });
});

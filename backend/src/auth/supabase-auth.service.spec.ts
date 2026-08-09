import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SupabaseAuthService } from './supabase-auth.service';

// Capture every Supabase client returned to the service under test so
// individual tests can drive its scripted responses. `jest.mock` is the
// only way to swap out the real `createClient` because the module's
// exports are non-configurable in the published build.
const createClientMock = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

/**
 * Unit tests for {@link SupabaseAuthService.signInWithTruecaller}.
 *
 * Goals:
 * - Confirm Branch 3's rollback semantics from the design's
 *   "Account Linking → Failure-mode considerations" section: if the
 *   `users.insert` fails after `auth.admin.createUser` succeeded, the
 *   orphaned auth user MUST be deleted via `auth.admin.deleteUser` so
 *   that idempotence (Property 8) and Requirement 11.4 are preserved.
 * - Confirm Branches 1, 2, 3 each return the expected `user.id` per
 *   the design's "Account linking branches" decision tree.
 *
 * The Supabase client is mocked end-to-end so the tests don't touch
 * the network or a real database.
 */

type SbResult<T> = { data: T; error: any };

interface MockSupabase {
  from: jest.Mock;
  auth: {
    admin: {
      createUser: jest.Mock;
      updateUserById: jest.Mock;
      deleteUser: jest.Mock;
      generateLink: jest.Mock;
    };
    verifyOtp: jest.Mock;
  };
}

interface FromBuilder {
  select: jest.Mock;
  eq: jest.Mock;
  single: jest.Mock;
  update: jest.Mock;
  insert: jest.Mock;
  upsert: jest.Mock;
}

/**
 * Build a minimal Supabase mock whose `.from('users')` query builder
 * returns scripted results for the lookup, update, and insert calls
 * issued by `signInWithTruecaller`.
 *
 * - `phoneLookup`: result of `select('*').eq('phone', ...).single()`.
 * - `emailLookup`: result of `select('*').eq('email', ...).single()`.
 * - `insertResult`: result of `from('users').insert(row)` (Branch 3).
 *
 * Each lookup is consumed in order so callers can express both the
 * "no row" and "row found" cases without coupling to the underlying
 * builder shape.
 */
function buildMockSupabase(opts: {
  phoneLookup: SbResult<any>;
  emailLookup?: SbResult<any>;
  insertResult?: SbResult<null>;
  updateResult?: SbResult<null>;
  createUserResult?: SbResult<{ user: { id: string; email: string } }>;
  updateUserResult?: SbResult<{ user: { id: string; email: string } }>;
  generateLinkResult?: SbResult<{ properties?: { action_link?: string } }>;
}): MockSupabase {
  const lookupQueue: SbResult<any>[] = [opts.phoneLookup];
  if (opts.emailLookup) {
    lookupQueue.push(opts.emailLookup);
  }

  const fromMock = jest.fn().mockImplementation((_table: string) => {
    const builder: FromBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve(lookupQueue.shift() ?? { data: null, error: null }),
        ),
      update: jest.fn().mockReturnValue({
        eq: jest
          .fn()
          .mockResolvedValue(opts.updateResult ?? { data: null, error: null }),
      }),
      insert: jest
        .fn()
        .mockResolvedValue(opts.insertResult ?? { data: null, error: null }),
      // The new-user create branch upserts (trigger already inserted the row);
      // `insertResult` scripts the outcome of that write.
      upsert: jest
        .fn()
        .mockResolvedValue(opts.insertResult ?? { data: null, error: null }),
    };
    return builder;
  });

  return {
    from: fromMock,
    auth: {
      admin: {
        createUser: jest.fn().mockResolvedValue(
          opts.createUserResult ?? {
            data: { user: { id: 'new-user-id', email: 'new@example.com' } },
            error: null,
          },
        ),
        updateUserById: jest.fn().mockResolvedValue(
          opts.updateUserResult ?? {
            data: { user: { id: 'unused', email: 'unused@example.com' } },
            error: null,
          },
        ),
        deleteUser: jest.fn().mockResolvedValue({ data: null, error: null }),
        generateLink: jest.fn().mockResolvedValue(
          opts.generateLinkResult ?? {
            data: { properties: { hashed_token: 'stub-hashed-token' } },
            error: null,
          },
        ),
      },
      // mintSession redeems the admin link into a real session via the
      // public verifyOtp API; return a stub session so the success path
      // completes.
      verifyOtp: jest.fn().mockResolvedValue({
        data: { session: { access_token: 'stub-access-token' } },
        error: null,
      }),
    },
  };
}

function buildService(mock: MockSupabase): SupabaseAuthService {
  // Inject the scripted Supabase client. `createClient` is mocked at the
  // module level above; here we just point it at the per-test mock.
  createClientMock.mockReturnValueOnce(mock);

  const config = new ConfigService({
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
  });
  return new SupabaseAuthService(config);
}

describe('SupabaseAuthService.signInWithTruecaller', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const sampleProfile = {
    phoneNumber: '+919876543210',
    firstName: 'Aarav',
    lastName: 'Sharma',
    email: 'aarav@example.com',
    avatarUrl: undefined as string | undefined,
  };

  // ──────────────────────────────────────────────────────────────────
  // Branch correctness — design "Account linking branches"
  // ──────────────────────────────────────────────────────────────────

  it('Branch 1 (phone-match): returns the existing user id (Req 11.2)', async () => {
    const mock = buildMockSupabase({
      phoneLookup: {
        data: { id: 'existing-phone-id', email: 'aarav@example.com' },
        error: null,
      },
      // createSessionForUser uses updateUserById to refresh metadata
      // and generateLink to mint a session. Both should fire on the
      // existing user's id.
      updateUserResult: {
        data: { user: { id: 'existing-phone-id', email: 'aarav@example.com' } },
        error: null,
      },
    });
    const svc = buildService(mock);

    const result = await svc.signInWithTruecaller(sampleProfile);

    expect(result.user.id).toBe('existing-phone-id');
    expect(mock.auth.admin.createUser).not.toHaveBeenCalled();
    expect(mock.auth.admin.deleteUser).not.toHaveBeenCalled();
    // The phone-update path executed against the matched id.
    expect(mock.auth.admin.updateUserById).toHaveBeenCalledWith(
      'existing-phone-id',
      expect.any(Object),
    );
  });

  it('SECURITY: an email match is IGNORED — never links to an existing account (account-takeover fix)', async () => {
    // A Truecaller profile whose (unverified, self-asserted) email happens to
    // match an existing user MUST NOT be handed that user's session. With no
    // phone match, the code creates a fresh phone-keyed account instead.
    const mock = buildMockSupabase({
      phoneLookup: { data: null, error: { code: 'PGRST116' } },
      emailLookup: {
        data: { id: 'victim-email-id', email: 'aarav@example.com' },
        error: null,
      },
      createUserResult: {
        data: { user: { id: 'fresh-user-id', email: 'aarav@example.com' } },
        error: null,
      },
      insertResult: { data: null, error: null },
    });
    const svc = buildService(mock);

    const result = await svc.signInWithTruecaller(sampleProfile);

    // Must NOT be the existing (victim) account; a new user is created.
    expect(result.user.id).toBe('fresh-user-id');
    expect(result.user.id).not.toBe('victim-email-id');
    expect(mock.auth.admin.createUser).toHaveBeenCalledTimes(1);
  });

  it('Branch 3 (create-new): returns the freshly created user id (Req 11.4)', async () => {
    const mock = buildMockSupabase({
      phoneLookup: { data: null, error: { code: 'PGRST116' } },
      emailLookup: { data: null, error: { code: 'PGRST116' } },
      createUserResult: {
        data: { user: { id: 'fresh-user-id', email: 'aarav@example.com' } },
        error: null,
      },
      insertResult: { data: null, error: null },
    });
    const svc = buildService(mock);

    const result = await svc.signInWithTruecaller(sampleProfile);

    expect(result.user.id).toBe('fresh-user-id');
    expect(mock.auth.admin.createUser).toHaveBeenCalledTimes(1);
    // Successful path must NOT roll back the auth user.
    expect(mock.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────────
  // Branch 3 rollback — task 9, Failure-mode considerations
  // ──────────────────────────────────────────────────────────────────

  it('Branch 3 rollback: deletes the orphan auth user when users.insert fails', async () => {
    const mock = buildMockSupabase({
      phoneLookup: { data: null, error: { code: 'PGRST116' } },
      emailLookup: { data: null, error: { code: 'PGRST116' } },
      createUserResult: {
        data: { user: { id: 'orphan-user-id', email: 'aarav@example.com' } },
        error: null,
      },
      insertResult: {
        data: null,
        error: { message: 'duplicate key value violates unique constraint' },
      },
    });
    const svc = buildService(mock);

    await expect(
      svc.signInWithTruecaller(sampleProfile),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(mock.auth.admin.createUser).toHaveBeenCalledTimes(1);
    // The whole point of this task: rollback fired with the new auth id.
    expect(mock.auth.admin.deleteUser).toHaveBeenCalledTimes(1);
    expect(mock.auth.admin.deleteUser).toHaveBeenCalledWith('orphan-user-id');
  });

  it('Branch 3 rollback: still surfaces the original error if the delete itself fails', async () => {
    const mock = buildMockSupabase({
      phoneLookup: { data: null, error: { code: 'PGRST116' } },
      emailLookup: { data: null, error: { code: 'PGRST116' } },
      createUserResult: {
        data: { user: { id: 'orphan-user-id', email: 'aarav@example.com' } },
        error: null,
      },
      insertResult: {
        data: null,
        error: { message: 'users insert failed' },
      },
    });
    // Force the rollback delete to fail. The service must swallow the
    // rollback failure and still throw the *original* insert error so
    // the caller (and any operator reading logs) sees the root cause.
    mock.auth.admin.deleteUser.mockRejectedValueOnce(
      new Error('delete blew up'),
    );
    const svc = buildService(mock);

    await expect(svc.signInWithTruecaller(sampleProfile)).rejects.toMatchObject(
      {
        message: 'users insert failed',
      },
    );
    expect(mock.auth.admin.deleteUser).toHaveBeenCalledWith('orphan-user-id');
  });

  it('Branch 3 rollback is NOT triggered when createUser itself fails', async () => {
    const mock = buildMockSupabase({
      phoneLookup: { data: null, error: { code: 'PGRST116' } },
      emailLookup: { data: null, error: { code: 'PGRST116' } },
      createUserResult: {
        data: { user: { id: '', email: '' } },
        error: { message: 'createUser exploded' },
      },
    });
    const svc = buildService(mock);

    await expect(
      svc.signInWithTruecaller(sampleProfile),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    // No auth user exists yet, so deleteUser must not be invoked.
    expect(mock.auth.admin.deleteUser).not.toHaveBeenCalled();
  });
});

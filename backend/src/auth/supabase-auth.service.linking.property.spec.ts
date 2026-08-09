/**
 * Property-based test for {@link SupabaseAuthService.signInWithTruecaller}.
 *
 * Property 8 — Account linking is idempotent and branch-correct
 * **Validates: Requirements 11.1, 11.2, 11.3, 11.4**
 *
 * For any phone+email Truecaller profile `P`, calling
 * `SupabaseAuthService.signInWithTruecaller(P)` twice in succession
 * (against a Supabase client mock that correctly tracks state across
 * calls) returns the same `user.id` on both calls. Furthermore, the
 * branch taken on the FIRST call is determined by the pre-existing
 * users table state:
 *   - Branch 1 — phone match (Req 11.2): a row already exists with
 *     `phone = P.phoneNumber`. The existing row is reused.
 *   - Branch 2 — email match (Req 11.3): no phone match, but `P.email`
 *     is present and matches an existing row's email. The existing
 *     row is reused and its phone is updated to `P.phoneNumber`.
 *   - Branch 3 — create-new (Req 11.4): neither phone nor email
 *     matches. A fresh Supabase auth user and a new `users` row are
 *     created.
 *
 * After the first call, the table contains exactly one row whose
 * `phone = P.phoneNumber`, so the SECOND call must always hit
 * Branch 1 and return the same `user.id` (idempotence — Req 11.1).
 */

import * as fc from 'fast-check';
import { ConfigService } from '@nestjs/config';

import { SupabaseAuthService } from './supabase-auth.service';

// `createClient` is mocked at the module level so each test can swap in
// its own scripted client. This mirrors the existing example-based spec
// at supabase-auth.service.spec.ts.
const createClientMock = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

// ──────────────────────────────────────────────────────────────────────
// Stateful Supabase mock
// ──────────────────────────────────────────────────────────────────────
//
// The mock persists across calls within a single property iteration so
// that the second `signInWithTruecaller(P)` invocation observes the row
// inserted by the first. This is essential for the idempotence assertion;
// a stateless mock would return "no row" on every lookup and trivially
// hit Branch 3 every time.

interface UserRow {
  id: string;
  email: string | null;
  phone: string | null;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  auth_provider?: string;
  phone_verified?: boolean;
  email_verified?: boolean;
}

interface AuthUser {
  id: string;
  email: string;
  phone?: string;
  user_metadata?: Record<string, unknown>;
}

class StatefulSupabaseMock {
  /** Application-level `users` table state. */
  readonly usersTable = new Map<string, UserRow>();
  /** `auth.users` rows visible to `auth.admin.*` calls. */
  readonly authUsers = new Map<string, AuthUser>();
  private nextAuthId = 0;

  // Counters — used by the property to detect which branch executed.
  createUserCalls = 0;
  deleteUserCalls = 0;

  /**
   * Pre-seed a row in both the application `users` table and the
   * Supabase auth-user store so `auth.admin.updateUserById(seed.id, ...)`
   * succeeds when Branches 1 or 2 reuse it.
   */
  seedExistingUser(row: UserRow): void {
    this.usersTable.set(row.id, { ...row });
    this.authUsers.set(row.id, {
      id: row.id,
      email: row.email ?? '',
      phone: row.phone ?? undefined,
    });
  }

  /**
   * `from(table)` returns a chainable query builder. The builder
   * captures filter columns/values and dispatches on whether the call
   * chain ends in `.single()` (select), `.eq(...)` after an `.update(...)`
   * (update), or `.insert(...)` (insert).
   */
  from(_table: string) {
    const filters: Array<[string, unknown]> = [];
    let updatePatch: Record<string, unknown> | null = null;
    const self = this;

    const builder: any = {
      select: (_cols: string) => builder,
      eq: (col: string, val: unknown) => {
        filters.push([col, val]);
        if (updatePatch !== null) {
          // The service awaits the chain `update(...).eq(...)` directly,
          // so we must return a Promise here, not the builder.
          return Promise.resolve(self.applyUpdate(filters, updatePatch));
        }
        return builder;
      },
      single: () => {
        const row = self.findRow(filters);
        if (!row) {
          // Mirror Supabase: PGRST116 == "JSON object requested, multiple
          // (or no) rows returned" used by `.single()` on empty results.
          return Promise.resolve({
            data: null,
            error: { code: 'PGRST116', message: 'no row' },
          });
        }
        return Promise.resolve({ data: row, error: null });
      },
      update: (patch: Record<string, unknown>) => {
        updatePatch = patch;
        return builder;
      },
      insert: (row: UserRow) => Promise.resolve(self.doInsert(row)),
      upsert: (row: UserRow) => Promise.resolve(self.doUpsert(row)),
    };

    return builder;
  }

  private findRow(filters: Array<[string, unknown]>): UserRow | null {
    for (const row of this.usersTable.values()) {
      if (filters.every(([col, val]) => (row as any)[col] === val)) {
        return row;
      }
    }
    return null;
  }

  private applyUpdate(
    filters: Array<[string, unknown]>,
    patch: Record<string, unknown>,
  ) {
    const row = this.findRow(filters);
    if (!row) return { data: null, error: { message: 'no row' } };
    Object.assign(row, patch);
    return { data: null, error: null };
  }

  private doInsert(row: UserRow) {
    if (this.usersTable.has(row.id)) {
      return {
        data: null,
        error: { message: 'duplicate key value violates unique constraint' },
      };
    }
    // Enforce the unique-phone invariant — see design Risk 14.
    for (const r of this.usersTable.values()) {
      if (r.phone && row.phone && r.phone === row.phone) {
        return {
          data: null,
          error: {
            message:
              'duplicate key value violates unique constraint "users_phone_key"',
          },
        };
      }
    }
    this.usersTable.set(row.id, { ...row });
    return { data: null, error: null };
  }

  // Mirrors `upsert(row, { onConflict: 'id' })`: update the existing row on an
  // id conflict (as the handle_new_user trigger's row would be), otherwise
  // insert (which still enforces the unique-phone invariant via doInsert).
  private doUpsert(row: UserRow) {
    const existing = this.usersTable.get(row.id);
    if (existing) {
      Object.assign(existing, row);
      return { data: null, error: null };
    }
    return this.doInsert(row);
  }

  readonly auth = {
    admin: {
      createUser: async (params: {
        email: string;
        phone?: string;
        user_metadata?: Record<string, unknown>;
      }) => {
        this.createUserCalls += 1;
        const id = `auth-user-${++this.nextAuthId}`;
        const user: AuthUser = {
          id,
          email: params.email,
          phone: params.phone,
          user_metadata: params.user_metadata,
        };
        this.authUsers.set(id, user);
        return { data: { user }, error: null };
      },
      updateUserById: async (
        id: string,
        updates: { user_metadata?: Record<string, unknown> },
      ) => {
        const existing = this.authUsers.get(id);
        if (existing) {
          if (updates.user_metadata) {
            existing.user_metadata = updates.user_metadata;
          }
          return { data: { user: { ...existing } }, error: null };
        }
        // Fall back to materialising a stub auth user from the users-table
        // row, which covers the case where a test seeded only the app
        // table but not the auth store. Should not happen via
        // `seedExistingUser`, but keeps the mock robust.
        const row = this.usersTable.get(id);
        if (row) {
          const stub: AuthUser = {
            id,
            email: row.email ?? '',
            phone: row.phone ?? undefined,
          };
          this.authUsers.set(id, stub);
          return { data: { user: { ...stub } }, error: null };
        }
        return { data: null, error: { message: 'user not found' } };
      },
      deleteUser: async (id: string) => {
        this.deleteUserCalls += 1;
        this.authUsers.delete(id);
        return { data: null, error: null };
      },
      generateLink: async (_args: { type: string; email: string }) => ({
        // mintSession reads `linkData.properties.hashed_token` and redeems
        // it via verifyOtp, so the token must be present.
        data: { properties: { hashed_token: 'stub-hashed-token' } },
        error: null,
      }),
    },
    // mintSession redeems the admin-issued link into a real session through
    // the public verifyOtp API. A stub session is enough for these tests —
    // the asserted user.id comes from the create/update path, not the session.
    verifyOtp: async (_args: { token_hash: string; type: string }) => ({
      data: { session: { access_token: 'stub-access-token' } },
      error: null,
    }),
  };
}

function buildService(mock: StatefulSupabaseMock): SupabaseAuthService {
  createClientMock.mockReturnValueOnce(mock);
  const config = new ConfigService({
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
  });
  return new SupabaseAuthService(config);
}

// ──────────────────────────────────────────────────────────────────────
// Helpers to derive guaranteed-distinct phones / emails for seeds
// ──────────────────────────────────────────────────────────────────────

/**
 * Flip the LAST digit of an `+91XXXXXXXXXX` phone string between '0'
 * and '1' to guarantee inequality with the input. The `[6-9]` constraint
 * only applies to the first digit after `+91`, so flipping the last
 * digit preserves Indian-mobile validity.
 */
function deriveDifferentPhone(phone: string): string {
  const last = phone[phone.length - 1];
  const newLast = last === '0' ? '1' : '0';
  return phone.slice(0, -1) + newLast;
}

function deriveDifferentEmail(email: string): string {
  // Local-part prefix that fast-check's `emailAddress` will never produce
  // (it does not embed a literal "+seed-distinct-" prefix at the start
  // of the local part), guaranteeing inequality.
  return 'seed-distinct-' + email;
}

// ──────────────────────────────────────────────────────────────────────
// Generators
// ──────────────────────────────────────────────────────────────────────

const arbPhone = fc.stringMatching(/^\+91[6-9][0-9]{9}$/);
const arbEmail = fc.emailAddress();
const arbName = fc.string({ minLength: 1, maxLength: 20 });

const arbProfile = fc.record({
  phoneNumber: arbPhone,
  email: arbEmail,
  firstName: arbName,
  lastName: fc.option(arbName, { nil: undefined }),
});

type SeedKind = 'none' | 'samePhone' | 'sameEmail' | 'differentBoth';
const arbSeedKind: fc.Arbitrary<SeedKind> = fc.constantFrom(
  'none',
  'samePhone',
  'sameEmail',
  'differentBoth',
);

// ──────────────────────────────────────────────────────────────────────
// The property
// ──────────────────────────────────────────────────────────────────────

describe('SupabaseAuthService.signInWithTruecaller property: idempotence + branch correctness (Property 8)', () => {
  beforeEach(() => {
    createClientMock.mockReset();
  });

  it('signInWithTruecaller is idempotent and selects the correct branch (Validates: Requirements 11.1, 11.2, 11.3, 11.4)', async () => {
    await fc.assert(
      fc.asyncProperty(arbProfile, arbSeedKind, async (profile, seedKind) => {
        const mock = new StatefulSupabaseMock();

        let expectedBranch: 1 | 2 | 3;
        let expectedFirstId: string | null = null;

        if (seedKind === 'samePhone') {
          // Branch 1: phone-match takes precedence regardless of email.
          mock.seedExistingUser({
            id: 'seed-phone',
            email: profile.email,
            phone: profile.phoneNumber,
          });
          expectedBranch = 1;
          expectedFirstId = 'seed-phone';
        } else if (seedKind === 'sameEmail') {
          // SECURITY: phone differs but (unverified) email matches. The
          // account-takeover fix means this must NOT link to the existing
          // email user — it creates a fresh phone-keyed account (branch 3).
          mock.seedExistingUser({
            id: 'seed-email',
            email: profile.email,
            phone: deriveDifferentPhone(profile.phoneNumber),
          });
          expectedBranch = 3;
        } else if (seedKind === 'differentBoth') {
          // Branch 3: pre-existing user is unrelated to `profile`.
          mock.seedExistingUser({
            id: 'seed-other',
            email: deriveDifferentEmail(profile.email),
            phone: deriveDifferentPhone(profile.phoneNumber),
          });
          expectedBranch = 3;
        } else {
          // 'none' — empty initial state; Branch 3.
          expectedBranch = 3;
        }

        const svc = buildService(mock);

        // ──────── First call ────────
        const callsBefore = mock.createUserCalls;
        const result1 = await svc.signInWithTruecaller(profile);
        const created1 = mock.createUserCalls - callsBefore;

        // Branch correctness on the first call.
        if (expectedBranch === 1) {
          expect(created1).toBe(0);
          expect(result1.user.id).toBe(expectedFirstId);
        } else {
          // Branch 3: a fresh auth user was created.
          expect(created1).toBe(1);
        }

        // No rollback fired on a successful path (Req 11.4 corollary).
        expect(mock.deleteUserCalls).toBe(0);

        // ──────── Second call — must always hit Branch 1 ────────
        const result2 = await svc.signInWithTruecaller(profile);
        const created2 = mock.createUserCalls - callsBefore - created1;

        // Idempotence: no new auth user created on the second call.
        expect(created2).toBe(0);

        // Idempotence (Req 11.1): same Supabase user id both times.
        expect(result1.user.id).toBe(result2.user.id);

        // Exactly one row in the application table whose phone matches
        // the profile, and that row is fully verified per Req 11.2/3/4.
        const phoneRows = [...mock.usersTable.values()].filter(
          (r) => r.phone === profile.phoneNumber,
        );
        expect(phoneRows).toHaveLength(1);
        expect(phoneRows[0].phone_verified).toBe(true);
        expect(phoneRows[0].auth_provider).toBe('truecaller');
      }),
      { numRuns: 100 },
    );
  });
});

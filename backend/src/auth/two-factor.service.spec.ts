import {
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { authenticator } from 'otplib';
import { TwoFactorService } from './two-factor.service';
import { User } from './user.entity';

/**
 * AUTH-4 — single-use backup codes.
 *
 * Exercises the recovery-code lifecycle end-to-end against the real otplib +
 * bcrypt primitives (only the repository and Redis are faked): setup issues N
 * codes, each redeems exactly once, a spent code is rejected, and a valid TOTP
 * still works after codes are issued.
 *
 * Real bcrypt is the point of this spec — hashing ten codes and then verifying
 * against them costs several seconds, and on a loaded machine or a small CI
 * box it runs past Jest's 5s default and fails as a timeout that looks like a
 * broken backup-code flow. Give it room explicitly rather than let a slow
 * machine masquerade as a regression; the alternative, dropping the bcrypt
 * cost factor for tests, would stop exercising the primitive this is about.
 */
jest.setTimeout(30_000);

describe('TwoFactorService — backup codes (AUTH-4)', () => {
  let service: TwoFactorService;
  let user: User;
  let redisStore: Record<string, string>;

  const repo = {
    findOneBy: jest.fn(async ({ id }: { id: string }) =>
      user && user.id === id ? user : null,
    ),
    save: jest.fn(async (u: User) => u),
    // verifyCodeOrBackup consumes a backup code inside a locked transaction;
    // mock the manager so findOne (with the row lock) returns the same user
    // object the assertions inspect.
    manager: {
      transaction: jest.fn(async (cb: (m: any) => Promise<boolean>) =>
        cb({
          findOne: jest.fn(async () => user),
          save: jest.fn(async (u: User) => u),
        }),
      ),
    },
  };

  const redis = {
    get: jest.fn(async (k: string) => redisStore[k] ?? null),
    set: jest.fn(async (k: string, v: string) => {
      redisStore[k] = v;
    }),
    del: jest.fn(async (k: string) => {
      delete redisStore[k];
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    redisStore = {};
    user = {
      id: 'user-1',
      email: 'farmer@example.com',
      is2faEnabled: false,
      totpSecret: null,
      backupCodes: [],
    } as unknown as User;
    service = new TwoFactorService(repo as any, redis as any);
  });

  const enableWithFreshSecret = async () => {
    const secret = authenticator.generateSecret();
    redisStore[`2fa:pending:${user.id}`] = secret;
    const token = authenticator.generate(secret);
    const res = await service.enable(user.id, token);
    return { secret, res };
  };

  it('enable() returns 10 backup codes and stores only hashes', async () => {
    const { res } = await enableWithFreshSecret();
    expect(res.enabled).toBe(true);
    expect(res.backupCodes).toHaveLength(10);
    // Nothing plaintext is persisted — stored values are bcrypt hashes.
    expect(user.backupCodes).toHaveLength(10);
    expect(user.backupCodes).not.toEqual(
      expect.arrayContaining(res.backupCodes),
    );
    user.backupCodes.forEach((h) => expect(h.startsWith('$2')).toBe(true));
  });

  it('a backup code authenticates once, then is consumed', async () => {
    const { res } = await enableWithFreshSecret();
    const code = res.backupCodes[0];

    expect(await service.verifyCodeOrBackup(user.id, code)).toBe(true);
    expect(user.backupCodes).toHaveLength(9); // consumed
    // Second use of the same code is rejected.
    expect(await service.verifyCodeOrBackup(user.id, code)).toBe(false);
  });

  it('a valid TOTP still works after codes are issued', async () => {
    const { secret } = await enableWithFreshSecret();
    const totp = authenticator.generate(secret);
    expect(await service.verifyCodeOrBackup(user.id, totp)).toBe(true);
    expect(user.backupCodes).toHaveLength(10); // TOTP path consumes no backup code
  });

  it('an unrelated code is rejected and consumes nothing', async () => {
    await enableWithFreshSecret();
    expect(await service.verifyCodeOrBackup(user.id, 'DEADBEEF')).toBe(false);
    expect(user.backupCodes).toHaveLength(10);
  });

  it('regenerate replaces the codes and requires a valid TOTP', async () => {
    const { secret, res } = await enableWithFreshSecret();
    const oldCode = res.backupCodes[0];

    await expect(
      service.regenerateBackupCodes(user.id, '000000'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const totp = authenticator.generate(secret);
    const { backupCodes } = await service.regenerateBackupCodes(user.id, totp);
    expect(backupCodes).toHaveLength(10);
    // The old code no longer works.
    expect(await service.verifyCodeOrBackup(user.id, oldCode)).toBe(false);
    // A new one does.
    expect(await service.verifyCodeOrBackup(user.id, backupCodes[0])).toBe(
      true,
    );
  });

  it('disable() clears the stored backup codes', async () => {
    const { secret } = await enableWithFreshSecret();
    const totp = authenticator.generate(secret);
    await service.disable(user.id, totp);
    expect(user.backupCodes).toEqual([]);
    expect(user.is2faEnabled).toBe(false);
  });
});

/**
 * Issue #32 — 2FA threw a generic "internal server error" when the 2FA columns
 * (is_2fa_enabled / totp_secret / backup_codes) had not been migrated into the
 * target database. The service now degrades: status() lets the screen load,
 * and write paths surface a clean 503 instead of a raw 500.
 */
describe('TwoFactorService — schema drift (issue #32)', () => {
  let service: TwoFactorService;

  const driftError = Object.assign(
    new Error('column users.backup_codes does not exist'),
    { code: '42703' }, // undefined_column
  );

  const build = (findOneBy: jest.Mock) => {
    const repo = { findOneBy, save: jest.fn(), manager: { transaction: jest.fn() } };
    const redis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
    return new TwoFactorService(repo as any, redis as any);
  };

  beforeEach(() => jest.clearAllMocks());

  it('status() degrades to { enabled: false } instead of 500ing', async () => {
    service = build(jest.fn(async () => { throw driftError; }));
    await expect(service.status('u1')).resolves.toEqual({ enabled: false });
  });

  it('setup() surfaces a 503 ServiceUnavailable, not a raw 500', async () => {
    service = build(jest.fn(async () => { throw driftError; }));
    await expect(service.setup('u1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('a non-drift DB error is NOT swallowed (still throws)', async () => {
    const boom = Object.assign(new Error('connection reset'), { code: '08006' });
    service = build(jest.fn(async () => { throw boom; }));
    await expect(service.status('u1')).rejects.toBe(boom);
  });
});

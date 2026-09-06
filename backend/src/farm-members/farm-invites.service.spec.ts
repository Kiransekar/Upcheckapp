/**
 * W2 — the join code was the weakest link.
 *
 * `farm.farmCode` was both the farm's public identity AND its join credential:
 * anyone holding it got a `worker` membership, with no owner approval, no
 * expiry, no revocation and no record of who let them in. A capability matrix
 * is worthless if the front door is a static shared string.
 *
 * These cover the invite lifecycle and, importantly, the cases where a code
 * must be REFUSED — a revoked or expired invite must never fall through to the
 * legacy farmCode path and silently succeed.
 */
import {
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FarmInvitesService } from './farm-invites.service';
import { FarmInvite, inviteRejection } from './farm-invite.entity';
import { FarmMember } from '../farm-access/farm-member.entity';
import { Farm } from '../farms/farm.entity';

const FARM = 'farm-1';
const OWNER = 'user-owner';
const JOINER = 'user-joiner';

const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

function makeInvite(over: Partial<FarmInvite> = {}): FarmInvite {
  return {
    id: 'invite-1',
    farmId: FARM,
    code: 'ABCD2345',
    role: 'worker',
    createdById: OWNER,
    expiresAt: new Date(Date.now() + 3600_000),
    maxUses: 1,
    usedCount: 0,
    revokedAt: null,
    // W5: the invite governs approval now, and a plain one lets its holder
    // straight in. Tests that want the waiting queue say so explicitly.
    requiresApproval: false,
    createdAt: new Date(),
    ...over,
  } as FarmInvite;
}

function makeService(over: {
  invite?: FarmInvite | null;
  farm?: Partial<Farm> | null;
  existingMember?: any;
  callerRole?: string | null;
  managers?: any[];
} = {}) {
  const farm = over.farm === null ? null : { id: FARM, name: 'Kakinada East', userId: OWNER, deletedAt: null, joinApprover: 'managers', ...(over.farm ?? {}) };

  const invitesRepo = {
    findOne: jest.fn().mockResolvedValue(null), // no code collisions
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation((d) => ({ ...d, id: 'invite-new', createdAt: new Date() })),
    save: jest.fn().mockImplementation(async (d) => d),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const membersRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn(),
    find: jest.fn().mockResolvedValue(over.managers ?? [{ userId: 'manager-1' }]),
  };
  const farmsRepo = { findOne: jest.fn().mockResolvedValue(farm) };
  const usersRepo = {
    findOne: jest.fn().mockResolvedValue({ id: JOINER, firstName: 'Joiner', lastName: 'User', username: 'joiner' }),
  };

  const farmAccess = {
    assertCanAccessFarm: jest.fn().mockResolvedValue(farm),
    getRoleOnFarm: jest.fn().mockResolvedValue(over.callerRole ?? 'owner'),
  };

  // Transaction manager stand-in — join() does all its work through this.
  const manager = {
    findOne: jest.fn().mockImplementation(async (entity: any) => {
      if (entity === FarmInvite) return over.invite === undefined ? makeInvite() : over.invite;
      if (entity === Farm) return farm;
      if (entity === FarmMember) return over.existingMember ?? null;
      return null;
    }),
    create: jest.fn().mockImplementation((_e: any, d: any) => d),
    save: jest.fn().mockImplementation(async (d) => d),
    increment: jest.fn().mockResolvedValue(undefined),
  };
  const dataSource = {
    transaction: jest.fn().mockImplementation(async (cb: any) => cb(manager)),
  };
  const push = { sendToUser: jest.fn().mockResolvedValue(true) };

  const service = new FarmInvitesService(
    invitesRepo as any,
    membersRepo as any,
    farmsRepo as any,
    usersRepo as any,
    farmAccess as any,
    dataSource as any,
    push as any,
  );
  return { service, invitesRepo, membersRepo, farmAccess, manager, dataSource, push, usersRepo };
}

describe('inviteRejection (pure)', () => {
  const now = new Date('2026-08-25T12:00:00Z');

  it('accepts a live single-use invite', () => {
    expect(inviteRejection(makeInvite({ expiresAt: new Date('2026-08-26T00:00:00Z') }), now)).toBeNull();
  });

  it('rejects a missing code as not_found', () => {
    expect(inviteRejection(null, now)).toBe('not_found');
  });

  it('rejects a revoked invite even if otherwise valid', () => {
    const i = makeInvite({ expiresAt: new Date('2026-08-26T00:00:00Z') });
    i.revokedAt = new Date('2026-08-24T00:00:00Z');
    expect(inviteRejection(i, now)).toBe('revoked');
  });

  it('rejects an expired invite', () => {
    const i = makeInvite();
    i.expiresAt = new Date('2026-08-25T11:59:59Z');
    expect(inviteRejection(i, now)).toBe('expired');
  });

  it('rejects an exhausted invite', () => {
    const i = makeInvite({ expiresAt: null });
    i.expiresAt = null;
    i.maxUses = 2;
    i.usedCount = 2;
    expect(inviteRejection(i, now)).toBe('exhausted');
  });

  it('treats maxUses 0 as unlimited (the backfilled legacy codes)', () => {
    const i = makeInvite();
    i.expiresAt = null;
    i.maxUses = 0;
    i.usedCount = 999;
    expect(inviteRejection(i, now)).toBeNull();
  });

  it('treats a null expiry as never expiring', () => {
    const i = makeInvite();
    i.expiresAt = null;
    expect(inviteRejection(i, now)).toBeNull();
  });
});

describe('FarmInvitesService.create', () => {
  it('mints a code in the farm-code charset and returns it once', async () => {
    const { service } = makeService();
    const out = await service.create(FARM, OWNER, {});
    expect(out.code).toMatch(CODE_RE);
    expect(out.role).toBe('worker');
    expect(out.maxUses).toBe(1);
    expect(out.usedCount).toBe(0);
  });

  it('requires MANAGE_WORKERS', async () => {
    const { service, farmAccess } = makeService();
    farmAccess.assertCanAccessFarm.mockRejectedValue(new ForbiddenException());
    await expect(service.create(FARM, JOINER, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets an owner mint a manager invite', async () => {
    const { service } = makeService({ callerRole: 'owner' });
    await expect(service.create(FARM, OWNER, { role: 'manager' })).resolves.toMatchObject({ role: 'manager' });
  });

  it('stops a manager minting a manager invite (no escalation past canAssignRole)', async () => {
    const { service } = makeService({ callerRole: 'manager' });
    await expect(service.create(FARM, 'user-mgr', { role: 'manager' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets a manager mint a worker invite', async () => {
    const { service } = makeService({ callerRole: 'manager' });
    await expect(service.create(FARM, 'user-mgr', { role: 'worker' })).resolves.toMatchObject({ role: 'worker' });
  });

  it('throws rather than reusing a code after 10 collisions', async () => {
    const { service, invitesRepo } = makeService();
    invitesRepo.findOne.mockResolvedValue(makeInvite()); // every candidate taken
    await expect(service.create(FARM, OWNER, {})).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});

describe('FarmInvitesService.join', () => {
  it('creates the membership with the invite role and issuer attribution', async () => {
    const { service, manager } = makeService();
    const out = await service.join(JOINER, { code: 'ABCD2345' });

    expect(out).toMatchObject({ farmId: FARM, role: 'worker' });
    expect(manager.create).toHaveBeenCalledWith(
      FarmMember,
      expect.objectContaining({ farmId: FARM, userId: JOINER, role: 'worker', addedById: OWNER }),
    );
  });

  it('increments usedCount in the SAME transaction as the membership insert', async () => {
    const { service, manager, dataSource } = makeService();
    await service.join(JOINER, { code: 'ABCD2345' });
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.increment).toHaveBeenCalledWith(FarmInvite, { id: 'invite-1' }, 'usedCount', 1);
  });

  it('locks the invite row so a race cannot double-spend the last use', async () => {
    const { service, manager } = makeService();
    await service.join(JOINER, { code: 'ABCD2345' });
    expect(manager.findOne).toHaveBeenCalledWith(
      FarmInvite,
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
  });

  it('normalizes the code to upper case before lookup', async () => {
    const { service, manager } = makeService();
    await service.join(JOINER, { code: 'abcd2345' as any });
    expect(manager.findOne).toHaveBeenCalledWith(
      FarmInvite,
      expect.objectContaining({ where: { code: 'ABCD2345' } }),
    );
  });

  it.each([
    ['revoked', { revokedAt: new Date() }],
    ['expired', { expiresAt: new Date(Date.now() - 1000) }],
    ['exhausted', { maxUses: 1, usedCount: 1 }],
  ])('refuses a %s invite with 410 and creates NO membership', async (reason, patch) => {
    const invite = Object.assign(makeInvite(), patch);
    const { service, manager } = makeService({ invite });

    await expect(service.join(JOINER, { code: 'ABCD2345' })).rejects.toBeInstanceOf(GoneException);
    expect(manager.save).not.toHaveBeenCalled();
    expect(manager.increment).not.toHaveBeenCalled();
  });

  it('carries a machine-readable reason so the client can translate each case', async () => {
    const invite = Object.assign(makeInvite(), { revokedAt: new Date() });
    const { service } = makeService({ invite });
    await expect(service.join(JOINER, { code: 'ABCD2345' })).rejects.toMatchObject({
      response: { reason: 'revoked' },
    });
  });

  it('refuses when the joiner already owns the farm', async () => {
    const { service } = makeService();
    await expect(service.join(OWNER, { code: 'ABCD2345' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses when the joiner is already a member', async () => {
    const { service } = makeService({ existingMember: { id: 'm1' } });
    await expect(service.join(JOINER, { code: 'ABCD2345' })).rejects.toBeInstanceOf(ConflictException);
  });

  describe('legacy farmCode fallback (deploy-before-migrate window)', () => {
    it('falls back to farmCode when the invites table is missing', async () => {
      const { service, manager } = makeService();
      manager.findOne.mockImplementation(async (entity: any, opts: any) => {
        if (entity === FarmInvite) {
          const err: any = new Error('relation "farm_invites" does not exist');
          err.code = '42P01';
          throw err;
        }
        if (entity === Farm) return { id: FARM, name: 'Kakinada East', userId: OWNER, deletedAt: null };
        return null;
      });

      const out = await service.join(JOINER, { code: 'ABCD2345' });
      expect(out).toMatchObject({ farmId: FARM, role: 'worker' });
      // Legacy joins carry no issuer.
      expect(manager.create).toHaveBeenCalledWith(
        FarmMember,
        expect.objectContaining({ addedById: null }),
      );
    });

    it('falls back for an unknown code (farm created before its backfill row)', async () => {
      const { service, manager } = makeService({ invite: null });
      const out = await service.join(JOINER, { code: 'ABCD2345' });
      expect(out).toMatchObject({ farmId: FARM });
    });

    it('does NOT fall back for a revoked invite — a dead code stays dead', async () => {
      const invite = Object.assign(makeInvite(), { revokedAt: new Date() });
      const { service, manager } = makeService({ invite });
      await expect(service.join(JOINER, { code: 'ABCD2345' })).rejects.toBeInstanceOf(GoneException);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('404s when neither an invite nor a farm matches the code', async () => {
      const { service, manager } = makeService({ invite: null });
      manager.findOne.mockImplementation(async () => null);
      await expect(service.join(JOINER, { code: 'ABCD2345' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

describe('push on pending join', () => {
  it('notifies the owner and the managers when joinApprover is managers', async () => {
    const { service, push } = makeService({
      farm: { joinApprover: 'managers' },
      managers: [{ userId: 'manager-1' }],
      invite: makeInvite({ requiresApproval: true }),
    });
    await service.join(JOINER, { code: 'ABCD2345' });
    expect(push.sendToUser).toHaveBeenCalledWith(OWNER, expect.anything());
    expect(push.sendToUser).toHaveBeenCalledWith('manager-1', expect.anything());
  });

  it('notifies only the owner when joinApprover is owner', async () => {
    const { service, push } = makeService({
      farm: { joinApprover: 'owner' },
      invite: makeInvite({ requiresApproval: true }),
    });
    await service.join(JOINER, { code: 'ABCD2345' });
    expect(push.sendToUser).toHaveBeenCalledTimes(1);
    expect(push.sendToUser).toHaveBeenCalledWith(OWNER, expect.anything());
  });

  it('sends nothing when the farm auto-approves — there is nothing to approve', async () => {
    const { service, push } = makeService({ farm: { joinApproval: 'auto' } });
    await service.join(JOINER, { code: 'ABCD2345' });
    expect(push.sendToUser).not.toHaveBeenCalled();
  });

  it('also fires on the legacy farm-code fallback path', async () => {
    // The fallback is the one that silently sends nothing if forgotten.
    const { service, manager, push } = makeService({ invite: null });
    await service.join(JOINER, { code: 'ABCD2345' });
    expect(manager.save).toHaveBeenCalled();
    expect(push.sendToUser).toHaveBeenCalled();
  });

  it('fires only after the transaction has committed, never inside it', async () => {
    // Needs the PENDING path — that is the only one that pushes.
    const { service, manager, push } = makeService({
      invite: makeInvite({ requiresApproval: true }),
    });
    const order: string[] = [];
    // Swap in an instrumented dataSource that still delegates to the same
    // manager makeService() wired up, so the transaction body runs unchanged.
    (service as any).dataSource = {
      transaction: jest.fn().mockImplementation(async (cb: any) => {
        const result = await cb(manager);
        order.push('transaction-committed');
        return result;
      }),
    };
    push.sendToUser.mockImplementation(async () => {
      order.push('push-sent');
      return true;
    });
    await service.join(JOINER, { code: 'ABCD2345' });
    // Default makeService() farm has an owner + one manager, so two pushes
    // fire — both must come strictly after the commit.
    expect(order[0]).toBe('transaction-committed');
    expect(order.slice(1)).toEqual(['push-sent', 'push-sent']);
  });

  it('does not fail the join when the push fails', async () => {
    const { service, push } = makeService();
    push.sendToUser.mockResolvedValue(false);
    await expect(service.join(JOINER, { code: 'ABCD2345' })).resolves.toBeDefined();
  });

  it('does not fail the join when resolving recipients throws', async () => {
    const { service, membersRepo } = makeService();
    membersRepo.find.mockRejectedValue(new Error('db down'));
    await expect(service.join(JOINER, { code: 'ABCD2345' })).resolves.toBeDefined();
  });
});

describe('FarmInvitesService.list / revoke / rotate', () => {
  it('lists only usable invites', async () => {
    const live = makeInvite();
    const dead = Object.assign(makeInvite({ id: 'invite-2' } as any), {
      id: 'invite-2',
      expiresAt: new Date(Date.now() - 1000),
    });
    const { service, invitesRepo } = makeService();
    invitesRepo.find.mockResolvedValue([live, dead]);

    const out = await service.list(FARM, OWNER);
    expect(out.map((i) => i.id)).toEqual(['invite-1']);
  });

  it('returns [] instead of throwing when the table is missing', async () => {
    const { service, invitesRepo } = makeService();
    const err: any = new Error('relation "farm_invites" does not exist');
    err.code = '42P01';
    invitesRepo.find.mockRejectedValue(err);

    await expect(service.list(FARM, OWNER)).resolves.toEqual([]);
  });

  it('rethrows a non-42P01 database error rather than hiding it', async () => {
    const { service, invitesRepo } = makeService();
    invitesRepo.find.mockRejectedValue(Object.assign(new Error('boom'), { code: '08006' }));
    await expect(service.list(FARM, OWNER)).rejects.toThrow('boom');
  });

  it('revoke sets revokedAt and is idempotent', async () => {
    const invite = makeInvite();
    const { service, invitesRepo } = makeService();
    invitesRepo.findOne.mockResolvedValue(invite);

    const first = await service.revoke(FARM, 'invite-1', OWNER);
    expect(first.revokedAt).toBeInstanceOf(Date);

    const saveCalls = invitesRepo.save.mock.calls.length;
    const second = await service.revoke(FARM, 'invite-1', OWNER);
    expect(second.revokedAt).toEqual(first.revokedAt);
    expect(invitesRepo.save.mock.calls.length).toBe(saveCalls); // no second write
  });

  it('revoke 404s for an invite on another farm', async () => {
    const { service, invitesRepo } = makeService();
    invitesRepo.findOne.mockResolvedValue(null);
    await expect(service.revoke(FARM, 'invite-x', OWNER)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rotate revokes every active invite, then mints a fresh one', async () => {
    const { service, invitesRepo } = makeService();
    const out = await service.rotate(FARM, OWNER, {});

    expect(invitesRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ farmId: FARM }),
      expect.objectContaining({ revokedAt: expect.any(Date) }),
    );
    expect(out.code).toMatch(CODE_RE);
  });
});

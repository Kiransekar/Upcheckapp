/**
 * W2 rework — the approval queue and the per-farm join policy.
 *
 * Covers who may let someone in (the farm's `joinApprover` narrows
 * MANAGE_WORKERS down to the owner alone), that approving is the only thing
 * that turns a pending row into access, and that only an owner can change the
 * policy — a manager must not be able to switch approval off and then walk
 * people in.
 */
import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { FarmInvitesService } from './farm-invites.service';
import { FarmInvite } from './farm-invite.entity';
import { FarmMember } from '../farm-access/farm-member.entity';
import { Farm } from '../farms/farm.entity';

const FARM = 'farm-1';
const OWNER = 'user-owner';
const MANAGER = 'user-manager';
const JOINER = 'user-joiner';

function makeService(over: {
  joinApproval?: 'manual' | 'auto';
  joinApprover?: 'owner' | 'managers';
  callerRole?: 'owner' | 'manager';
  requiresApproval?: boolean;
  pending?: any;
} = {}) {
  const farm = {
    id: FARM,
    name: 'Kakinada East',
    userId: OWNER,
    deletedAt: null,
    joinApproval: over.joinApproval ?? 'manual',
    joinApprover: over.joinApprover ?? 'managers',
  };

  const pendingRow =
    over.pending === undefined
      ? { id: 'm1', farmId: FARM, userId: JOINER, role: 'worker', status: 'pending', addedById: OWNER }
      : over.pending;

  const membersRepo = {
    findOne: jest.fn(async () => pendingRow),
    find: jest.fn(async () => (pendingRow ? [pendingRow] : [])),
    save: jest.fn(async (m: any) => m),
    remove: jest.fn(async (m: any) => m),
  };
  const invitesRepo = {
    findOne: jest.fn(async () => null),
    find: jest.fn(async () => []),
    create: jest.fn((d: any) => d),
    save: jest.fn(async (d: any) => d),
    update: jest.fn(),
  };
  const farmsRepo = {
    findOne: jest.fn(async () => farm),
    update: jest.fn(async () => undefined),
  };
  const farmAccess = {
    assertCanAccessFarm: jest.fn(async () => farm),
    getRoleOnFarm: jest.fn(async () => over.callerRole ?? 'owner'),
  };

  const manager = {
    findOne: jest.fn(async (entity: any) => {
      if (entity === FarmInvite) {
        return { id: 'invite-1', farmId: FARM, code: 'ABCD2345', role: 'worker', createdById: OWNER, expiresAt: null, maxUses: 0, usedCount: 0, revokedAt: null, requiresApproval: over.requiresApproval ?? false };
      }
      if (entity === Farm) return farm;
      return null; // no existing membership
    }),
    create: jest.fn((_e: any, d: any) => d),
    save: jest.fn(async (d: any) => d),
    increment: jest.fn(),
  };
  const dataSource = { transaction: jest.fn(async (cb: any) => cb(manager)) };
  const usersRepo = { findOne: jest.fn(async () => ({ id: JOINER, firstName: 'Joiner', lastName: null, username: 'joiner' })) };
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
  return { service, membersRepo, farmsRepo, farmAccess, manager, push, usersRepo };
}

/**
 * W5 — THE INVITE decides, not the farm.
 *
 * `farm.joinApproval` defaults to 'manual', so redeeming any code left the
 * joiner pending: holding nothing, shown the brand-new-user state on Home, and
 * told their valid code was wrong when they retyped it. An invite code is
 * already server-minted, expiring, revocable and use-limited — it IS the
 * credential — so a second manual step buys no security and costs the worker
 * their first day.
 *
 * The farm-level policy is unchanged and still governs the OPEN FARM-CODE
 * path, where there is no invite to carry an opinion.
 */
describe('join honours the invite, not the farm policy', () => {
  it('admits the holder of a plain invite immediately', async () => {
    // The farm still says 'manual'. The invite does not require approval, and
    // the invite is what governs this path now.
    const { service, manager } = makeService({ joinApproval: 'manual' });

    const out = await service.join(JOINER, { code: 'ABCD2345' });

    expect(out.status).toBe('active');
    expect(manager.create).toHaveBeenCalledWith(
      FarmMember,
      expect.objectContaining({ status: 'active' }),
    );
  });

  it('queues the joiner when the OWNER ticked "I will approve first"', async () => {
    // And the farm says 'auto' — proving the invite wins in both directions
    // rather than the two merely agreeing.
    const { service, manager } = makeService({
      joinApproval: 'auto',
      requiresApproval: true,
    });

    const out = await service.join(JOINER, { code: 'ABCD2345' });

    expect(out.status).toBe('pending');
    expect(manager.create).toHaveBeenCalledWith(
      FarmMember,
      expect.objectContaining({ status: 'pending' }),
    );
  });

  /**
   * W1 — THE LARGEST ACTIVATION LEAK, and it lived in a missing field.
   *
   * "You have already asked to join" was prose and nothing else. The client's
   * rejection contract had four values, none of which covered it, so
   * `inviteRejectionOf()` returned null and JoinFarmScreen fell through to its
   * TYPO branch: red boxes, "check the code and try again". The worker asked
   * for a fresh code, which produced the identical error, and the loop only
   * ended when an owner happened to open the app.
   *
   * A machine-readable reason is what lets the screen say "you are already
   * waiting" instead of "you got it wrong".
   */
  it('says WHY a queued worker was refused, in a form the client can act on', async () => {
    const { service, manager } = makeService();
    manager.findOne.mockImplementation((async (entity: any) => {
      if (entity === FarmInvite) return { id: 'invite-1', farmId: FARM, code: 'ABCD2345', role: 'worker', createdById: OWNER, expiresAt: null, maxUses: 0, usedCount: 0, revokedAt: null, requiresApproval: true };
      if (entity === Farm) return { id: FARM, name: 'Kakinada East', userId: OWNER, deletedAt: null, joinApproval: 'manual', joinApprover: 'managers' };
      return { id: 'm1', status: 'pending' };
    }) as any);

    const err: any = await service
      .join(JOINER, { code: 'ABCD2345' })
      .catch((e) => e);

    expect(err).toBeInstanceOf(ConflictException);
    // The reason, not just the sentence — a screen cannot branch on prose.
    expect(err.getResponse()).toMatchObject({
      reason: 'already_pending',
      farmName: 'Kakinada East',
    });
  });

  it('distinguishes an existing member from someone still waiting', async () => {
    const { service, manager } = makeService();
    manager.findOne.mockImplementation((async (entity: any) => {
      if (entity === FarmInvite) return { id: 'invite-1', farmId: FARM, code: 'ABCD2345', role: 'worker', createdById: OWNER, expiresAt: null, maxUses: 0, usedCount: 0, revokedAt: null, requiresApproval: false };
      if (entity === Farm) return { id: FARM, name: 'Kakinada East', userId: OWNER, deletedAt: null, joinApproval: 'auto', joinApprover: 'managers' };
      return { id: 'm1', status: 'active' };
    }) as any);

    const err: any = await service
      .join(JOINER, { code: 'ABCD2345' })
      .catch((e) => e);

    // Both are conflicts, and both are fine outcomes — but "you are already in"
    // sends the farmer to the farm, while "you are waiting" does not.
    expect(err.getResponse()).toMatchObject({ reason: 'already_member' });
  });

  it('tells someone already queued that they are waiting, not that they are a member', async () => {
    const { service, manager } = makeService();
    manager.findOne.mockImplementation((async (entity: any) => {
      if (entity === FarmInvite) return { id: 'invite-1', farmId: FARM, code: 'ABCD2345', role: 'worker', createdById: OWNER, expiresAt: null, maxUses: 0, usedCount: 0, revokedAt: null };
      if (entity === Farm) return { id: FARM, name: 'K', userId: OWNER, deletedAt: null, joinApproval: 'manual', joinApprover: 'managers' };
      return { id: 'm1', status: 'pending' };
    }) as any);

    await expect(service.join(JOINER, { code: 'ABCD2345' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.join(JOINER, { code: 'ABCD2345' })).rejects.toThrow(
      /has not let you in yet/,
    );
  });
});

describe('who may let someone in', () => {
  it('a manager can approve when joinApprover is "managers"', async () => {
    const { service } = makeService({ joinApprover: 'managers', callerRole: 'manager' });
    await expect(service.approve(FARM, JOINER, MANAGER)).resolves.toMatchObject({
      status: 'active',
    });
  });

  it('a manager cannot approve when the owner restricted it to "owner"', async () => {
    const { service } = makeService({ joinApprover: 'owner', callerRole: 'manager' });
    await expect(service.approve(FARM, JOINER, MANAGER)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('the owner can always approve', async () => {
    const { service } = makeService({ joinApprover: 'owner', callerRole: 'owner' });
    await expect(service.approve(FARM, JOINER, OWNER)).resolves.toMatchObject({
      status: 'active',
    });
  });

  it('the same restriction applies to declining', async () => {
    const { service } = makeService({ joinApprover: 'owner', callerRole: 'manager' });
    await expect(service.decline(FARM, JOINER, MANAGER)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('the same restriction applies to reading the queue', async () => {
    const { service } = makeService({ joinApprover: 'owner', callerRole: 'manager' });
    await expect(service.listPending(FARM, MANAGER)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('approve / decline', () => {
  it('records who actually let them in, not who issued the code', async () => {
    const { service, membersRepo } = makeService({ callerRole: 'owner' });
    await service.approve(FARM, JOINER, OWNER);
    expect(membersRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active', addedById: OWNER }),
    );
  });

  it('can promote on the way in, bounded by canAssignRole', async () => {
    const { service, membersRepo } = makeService({ callerRole: 'owner' });
    await service.approve(FARM, JOINER, OWNER, 'manager');
    expect(membersRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'manager', status: 'active' }),
    );
  });

  it('a manager cannot promote a joiner to manager on the way in', async () => {
    const { service } = makeService({ joinApprover: 'managers', callerRole: 'manager' });
    await expect(
      service.approve(FARM, JOINER, MANAGER, 'manager'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('declining deletes the row rather than leaving a dead membership', async () => {
    const { service, membersRepo } = makeService({ callerRole: 'owner' });
    await service.decline(FARM, JOINER, OWNER);
    expect(membersRepo.remove).toHaveBeenCalled();
    expect(membersRepo.save).not.toHaveBeenCalled();
  });

  it('404s when there is no pending request for that person', async () => {
    const { service, membersRepo } = makeService({ callerRole: 'owner' });
    membersRepo.findOne.mockResolvedValue(null);
    await expect(service.approve(FARM, JOINER, OWNER)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('join policy is owner-only', () => {
  it('asserts OWNER_ONLY before changing anything', async () => {
    const { service, farmAccess, farmsRepo } = makeService();
    await service.setJoinPolicy(FARM, OWNER, { joinApproval: 'auto' });

    expect(farmAccess.assertCanAccessFarm).toHaveBeenCalledWith(
      OWNER,
      FARM,
      'OWNER_ONLY',
    );
    expect(farmsRepo.update).toHaveBeenCalledWith(
      { id: FARM },
      { joinApproval: 'auto' },
    );
  });

  it('a manager is refused — otherwise they could switch approval off and walk people in', async () => {
    const { service, farmAccess } = makeService();
    farmAccess.assertCanAccessFarm.mockRejectedValue(new ForbiddenException());
    await expect(
      service.setJoinPolicy(FARM, MANAGER, { joinApproval: 'auto' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('can set the approver scope', async () => {
    const { service, farmsRepo } = makeService();
    await service.setJoinPolicy(FARM, OWNER, { joinApprover: 'owner' });
    expect(farmsRepo.update).toHaveBeenCalledWith(
      { id: FARM },
      { joinApprover: 'owner' },
    );
  });

  it('writes nothing when the body is empty', async () => {
    const { service, farmsRepo } = makeService();
    await service.setJoinPolicy(FARM, OWNER, {});
    expect(farmsRepo.update).not.toHaveBeenCalled();
  });
});

/**
 * W5 — owner recovery.
 *
 * The risk with any recovery path is that it becomes a takeover path. These
 * tests are mostly about the guards that keep the two apart: only the nominee
 * can claim, the owner can always cancel, and nothing completes before the
 * waiting period elapses.
 */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FarmRecoveryService, RECOVERY_WAIT_DAYS } from './farm-recovery.service';
import { Farm } from '../farms/farm.entity';
import { FarmMember } from '../farm-access/farm-member.entity';

const FARM = 'farm-1';
const OWNER = 'user-owner';
const NOMINEE = 'user-nominee';
const STRANGER = 'user-stranger';

const DAY = 86_400_000;

function makeService(over: Partial<Farm> = {}, memberExists = true) {
  const farm: any = {
    id: FARM,
    userId: OWNER,
    deletedAt: null,
    recoveryContactId: null,
    recoveryClaimStartedAt: null,
    ...over,
  };

  const farmsRepo = {
    findOne: jest.fn(async () => farm),
    update: jest.fn(async (_w: any, patch: any) => {
      Object.assign(farm, patch);
      return undefined;
    }),
  };

  const txManager = {
    findOne: jest.fn(async (entity: any, opts: any) => {
      if (entity !== FarmMember) return null;
      if (!memberExists) return null;
      return {
        id: 'm-' + opts.where.userId,
        farmId: FARM,
        userId: opts.where.userId,
        role: opts.where.userId === OWNER ? 'owner' : 'worker',
        status: 'active',
      };
    }),
    create: jest.fn((_e: any, d: any) => d),
    save: jest.fn(async (d: any) => d),
    update: jest.fn(async (_e: any, _w: any, patch: any) => {
      Object.assign(farm, patch);
    }),
  };

  const membersRepo = {
    findOne: jest.fn(async () =>
      memberExists ? { id: 'm1', farmId: FARM, userId: NOMINEE, role: 'worker', status: 'active' } : null,
    ),
    manager: { transaction: jest.fn(async (cb: any) => cb(txManager)) },
  };

  const farmAccess = { assertCanAccessFarm: jest.fn(async () => farm) };

  const service = new FarmRecoveryService(
    farmsRepo as any,
    membersRepo as any,
    farmAccess as any,
  );
  return { service, farmsRepo, membersRepo, farmAccess, txManager, farm };
}

describe('nominating a recovery contact', () => {
  it('is owner-only', async () => {
    const { service, farmAccess } = makeService();
    await service.setRecoveryContact(FARM, OWNER, NOMINEE);
    expect(farmAccess.assertCanAccessFarm).toHaveBeenCalledWith(
      OWNER,
      FARM,
      'OWNER_ONLY',
    );
  });

  it('refuses the owner nominating themselves', async () => {
    const { service } = makeService();
    await expect(
      service.setRecoveryContact(FARM, OWNER, OWNER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses someone who is not an active member', async () => {
    const { service } = makeService({}, false);
    await expect(
      service.setRecoveryContact(FARM, OWNER, STRANGER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('clears the nomination with null, and any claim with it', async () => {
    const { service, farmsRepo } = makeService({
      recoveryContactId: NOMINEE,
      recoveryClaimStartedAt: new Date(),
    });
    await service.setRecoveryContact(FARM, OWNER, null);
    expect(farmsRepo.update).toHaveBeenCalledWith(
      { id: FARM },
      { recoveryContactId: null, recoveryClaimStartedAt: null },
    );
  });

  it('replacing the nominee also drops the old nominee\'s claim in flight', async () => {
    const { service, farmsRepo } = makeService({
      recoveryContactId: 'user-old',
      recoveryClaimStartedAt: new Date(),
    });
    await service.setRecoveryContact(FARM, OWNER, NOMINEE);
    expect(farmsRepo.update).toHaveBeenCalledWith(
      { id: FARM },
      { recoveryContactId: NOMINEE, recoveryClaimStartedAt: null },
    );
  });
});

describe('starting a claim', () => {
  it('only the nominee may start one', async () => {
    const { service } = makeService({ recoveryContactId: NOMINEE });
    await expect(service.startClaim(FARM, STRANGER)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('sets the clock and reports when it becomes eligible', async () => {
    const { service } = makeService({ recoveryContactId: NOMINEE });
    const out = await service.startClaim(FARM, NOMINEE);

    expect(out.claimStartedAt).toBeInstanceOf(Date);
    expect(out.waitDays).toBe(RECOVERY_WAIT_DAYS);
    expect(out.eligibleAt!.getTime() - out.claimStartedAt!.getTime()).toBe(
      RECOVERY_WAIT_DAYS * DAY,
    );
  });

  it('is idempotent — re-starting does not restart the clock', async () => {
    const started = new Date(Date.now() - 2 * DAY);
    const { service, farmsRepo } = makeService({
      recoveryContactId: NOMINEE,
      recoveryClaimStartedAt: started,
    });

    const out = await service.startClaim(FARM, NOMINEE);
    expect(out.claimStartedAt).toEqual(started);
    expect(farmsRepo.update).not.toHaveBeenCalled();
  });

  it('404s on a soft-deleted farm', async () => {
    const { service } = makeService({ deletedAt: new Date() as any });
    await expect(service.startClaim(FARM, NOMINEE)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('cancelling a claim', () => {
  it('the owner can always cancel — this is the whole point', async () => {
    const { service, farmsRepo } = makeService({
      recoveryContactId: NOMINEE,
      recoveryClaimStartedAt: new Date(),
    });
    await service.cancelClaim(FARM, OWNER);
    expect(farmsRepo.update).toHaveBeenCalledWith(
      { id: FARM },
      { recoveryClaimStartedAt: null },
    );
  });

  it('the nominee can withdraw their own claim', async () => {
    const { service, farmsRepo } = makeService({
      recoveryContactId: NOMINEE,
      recoveryClaimStartedAt: new Date(),
    });
    await service.cancelClaim(FARM, NOMINEE);
    expect(farmsRepo.update).toHaveBeenCalled();
  });

  it('nobody else can', async () => {
    const { service } = makeService({
      recoveryContactId: NOMINEE,
      recoveryClaimStartedAt: new Date(),
    });
    await expect(service.cancelClaim(FARM, STRANGER)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('completing a claim', () => {
  const ripe = () => new Date(Date.now() - (RECOVERY_WAIT_DAYS + 1) * DAY);

  it('refuses before the waiting period has elapsed', async () => {
    const { service } = makeService({
      recoveryContactId: NOMINEE,
      recoveryClaimStartedAt: new Date(Date.now() - DAY),
    });
    await expect(service.completeClaim(FARM, NOMINEE)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses when no claim was ever started', async () => {
    const { service } = makeService({ recoveryContactId: NOMINEE });
    await expect(service.completeClaim(FARM, NOMINEE)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses anyone who is not the nominee', async () => {
    const { service } = makeService({
      recoveryContactId: NOMINEE,
      recoveryClaimStartedAt: ripe(),
    });
    await expect(service.completeClaim(FARM, STRANGER)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('hands over ownership and demotes the previous owner to manager', async () => {
    const { service, txManager, farm } = makeService({
      recoveryContactId: NOMINEE,
      recoveryClaimStartedAt: ripe(),
    });

    const out = await service.completeClaim(FARM, NOMINEE);

    expect(out).toEqual({
      farmId: FARM,
      newOwnerUserId: NOMINEE,
      previousOwnerUserId: OWNER,
    });
    expect(txManager.save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: NOMINEE, role: 'owner' }),
    );
    // The outgoing owner keeps access to the farm; they just stop being in charge.
    expect(txManager.save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: OWNER, role: 'manager' }),
    );
    expect(farm.userId).toBe(NOMINEE);
  });

  it('clears the nomination so the new owner starts clean', async () => {
    const { service, farm } = makeService({
      recoveryContactId: NOMINEE,
      recoveryClaimStartedAt: ripe(),
    });
    await service.completeClaim(FARM, NOMINEE);
    expect(farm.recoveryContactId).toBeNull();
    expect(farm.recoveryClaimStartedAt).toBeNull();
  });

  it('refuses if the nominee has since left the farm', async () => {
    const { service } = makeService(
      { recoveryContactId: NOMINEE, recoveryClaimStartedAt: ripe() },
      false,
    );
    await expect(service.completeClaim(FARM, NOMINEE)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

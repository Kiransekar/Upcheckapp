import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Farm } from '../farms/farm.entity';
import { FarmMember } from '../farm-access/farm-member.entity';
import { FarmAccessService } from '../farm-access/farm-access.service';

/**
 * How long a recovery claim must sit before it can be completed.
 *
 * The whole risk of a recovery path is that it becomes a takeover path. A
 * waiting period is what separates the two: the real owner gets a window to
 * notice and cancel, and a nominee who is acting in bad faith cannot do it
 * quietly in a minute. Seven days matches the invite default and is short
 * enough to be useful when the owner genuinely is gone.
 */
export const RECOVERY_WAIT_DAYS = 7;

/**
 * W5 Option B — single owner, plus a way back in.
 *
 * `farm.userId` is single-valued and `transferOwnership` requires the CURRENT
 * owner to act, so a lost owner account (lost phone, changed number, person
 * left) leaves the farm with no recovery path inside the app. This adds a
 * nominated recovery contact who can claim ownership after a waiting period.
 *
 * Deliberately NOT Option A (multiple owner rows): that would require auditing
 * every `farm.userId === userId` fast-path in OwnershipGuard and friends, which
 * is load-bearing security code, and the members design shows exactly one OWNER
 * badge.
 */
@Injectable()
export class FarmRecoveryService {
  constructor(
    @InjectRepository(Farm)
    private readonly farmsRepo: Repository<Farm>,
    @InjectRepository(FarmMember)
    private readonly membersRepo: Repository<FarmMember>,
    private readonly farmAccess: FarmAccessService,
  ) {}

  /**
   * Nominate (or clear, with null) the recovery contact. OWNER_ONLY — this is
   * the owner deciding who could one day replace them.
   */
  async setRecoveryContact(
    farmId: string,
    callerId: string,
    userId: string | null,
  ) {
    await this.farmAccess.assertCanAccessFarm(callerId, farmId, 'OWNER_ONLY');

    if (userId !== null) {
      if (userId === callerId) {
        throw new BadRequestException(
          'Choose someone other than yourself — the point is that they can act when you cannot',
        );
      }
      const member = await this.membersRepo.findOne({
        where: { farmId, userId, status: 'active' },
      });
      if (!member) {
        throw new BadRequestException(
          'The recovery contact must be an active member of this farm',
        );
      }
    }

    // Nominating someone new also clears any claim in flight — the old
    // nominee's claim must not survive being replaced.
    await this.farmsRepo.update(
      { id: farmId },
      { recoveryContactId: userId, recoveryClaimStartedAt: null },
    );
    return { farmId, recoveryContactId: userId };
  }

  /** Start the clock. Only the nominated contact may do this. */
  async startClaim(farmId: string, callerId: string) {
    const farm = await this.requireFarm(farmId);
    if (farm.recoveryContactId !== callerId) {
      throw new ForbiddenException(
        'Only this farm\'s nominated recovery contact can start a claim',
      );
    }
    if (farm.userId === callerId) {
      throw new BadRequestException('You already own this farm');
    }
    if (farm.recoveryClaimStartedAt) {
      return this.claimStatus(farm);
    }

    await this.farmsRepo.update(
      { id: farmId },
      { recoveryClaimStartedAt: new Date() },
    );
    return this.claimStatus(await this.requireFarm(farmId));
  }

  /**
   * Cancel a claim in flight. Either the OWNER (the whole point — "I am still
   * here") or the nominee who started it and changed their mind.
   */
  async cancelClaim(farmId: string, callerId: string) {
    const farm = await this.requireFarm(farmId);
    const isOwner = farm.userId === callerId;
    const isNominee = farm.recoveryContactId === callerId;
    if (!isOwner && !isNominee) {
      throw new ForbiddenException(
        'Only the farm owner or the nominated recovery contact can cancel a claim',
      );
    }
    await this.farmsRepo.update(
      { id: farmId },
      { recoveryClaimStartedAt: null },
    );
    return { farmId, claimStartedAt: null, eligibleAt: null };
  }

  /**
   * Complete the claim: the nominee becomes owner and the previous owner is
   * demoted to manager, mirroring `transferOwnership` exactly — the outgoing
   * owner keeps their access to the farm, they simply stop being in charge.
   */
  async completeClaim(farmId: string, callerId: string) {
    const farm = await this.requireFarm(farmId);
    if (farm.recoveryContactId !== callerId) {
      throw new ForbiddenException(
        'Only this farm\'s nominated recovery contact can complete a claim',
      );
    }
    if (!farm.recoveryClaimStartedAt) {
      throw new BadRequestException('No recovery claim has been started');
    }

    const { eligibleAt } = this.claimStatus(farm);
    if (eligibleAt && eligibleAt.getTime() > Date.now()) {
      throw new BadRequestException(
        `This claim cannot be completed until ${eligibleAt.toISOString()}`,
      );
    }

    const previousOwnerId = farm.userId;

    await this.membersRepo.manager.transaction(async (mgr) => {
      // The nominee's membership becomes owner.
      const nominee = await mgr.findOne(FarmMember, {
        where: { farmId, userId: callerId },
      });
      if (!nominee) {
        throw new BadRequestException(
          'The recovery contact is no longer a member of this farm',
        );
      }
      nominee.role = 'owner';
      nominee.status = 'active';
      await mgr.save(nominee);

      // Demote the outgoing owner, creating the row if the legacy owner never
      // had an explicit membership.
      let previous = await mgr.findOne(FarmMember, {
        where: { farmId, userId: previousOwnerId },
      });
      if (previous) {
        previous.role = 'manager';
      } else {
        previous = mgr.create(FarmMember, {
          farmId,
          userId: previousOwnerId,
          role: 'manager',
          status: 'active',
          addedById: callerId,
        });
      }
      await mgr.save(previous);

      // The farm's own owner column follows, and the claim is cleared so the
      // new owner starts with a clean slate (and can nominate their own).
      await mgr.update(
        Farm,
        { id: farmId },
        {
          userId: callerId,
          recoveryContactId: null,
          recoveryClaimStartedAt: null,
        },
      );
    });

    return { farmId, newOwnerUserId: callerId, previousOwnerUserId: previousOwnerId };
  }

  /** Current recovery state, for the settings screen. Any member may read it. */
  async status(farmId: string, callerId: string) {
    await this.farmAccess.assertCanAccessFarm(callerId, farmId, 'READ');
    return this.claimStatus(await this.requireFarm(farmId));
  }

  private claimStatus(farm: Farm) {
    const startedAt = farm.recoveryClaimStartedAt ?? null;
    const eligibleAt = startedAt
      ? new Date(startedAt.getTime() + RECOVERY_WAIT_DAYS * 86_400_000)
      : null;
    return {
      farmId: farm.id,
      recoveryContactId: farm.recoveryContactId ?? null,
      claimStartedAt: startedAt,
      eligibleAt,
      waitDays: RECOVERY_WAIT_DAYS,
    };
  }

  private async requireFarm(farmId: string): Promise<Farm> {
    const farm = await this.farmsRepo.findOne({ where: { id: farmId } });
    if (!farm || farm.deletedAt) {
      throw new NotFoundException('Farm not found');
    }
    return farm;
  }
}

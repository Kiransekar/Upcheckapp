import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  GoneException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import {
  FarmInvite,
  InviteRejection,
  inviteRejection,
} from './farm-invite.entity';
import { FarmMember } from '../farm-access/farm-member.entity';
import type { FarmRole } from '../farm-access/farm-member.entity';
import { Farm } from '../farms/farm.entity';
import { FarmAccessService } from '../farm-access/farm-access.service';
import { canAssignRole } from '../farm-access/farm-capability';
import { CreateInviteDto } from './dto/create-invite.dto';
import { JoinFarmDto } from './dto/join-farm.dto';

/** Same charset as farms.service.ts generateFarmCode() — no I/O/0/1. */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const DEFAULT_EXPIRY_HOURS = 24 * 7;

/**
 * Postgres "undefined_table" (42P01). `migrationsRun` is false in
 * app.module.ts, so a merged migration is NOT applied until a human runs
 * `npm run migration:run`. Between deploy and migrate, `farm_invites` does not
 * exist — every read here must tolerate that and fall back, exactly as
 * FarmAccessService already does for `farm_members`.
 */
function isMissingTable(err: any): boolean {
  return (err?.code ?? err?.driverError?.code) === '42P01';
}

/** Maps a rejection reason onto the HTTP shape + a translatable client key. */
const REJECTION_RESPONSE: Record<
  InviteRejection,
  { status: 'not_found' | 'gone'; message: string }
> = {
  not_found: { status: 'not_found', message: 'No farm found for that code' },
  revoked: { status: 'gone', message: 'This invite has been revoked' },
  expired: { status: 'gone', message: 'This invite has expired' },
  exhausted: { status: 'gone', message: 'This invite has already been used' },
};

@Injectable()
export class FarmInvitesService {
  private readonly logger = new Logger(FarmInvitesService.name);

  constructor(
    @InjectRepository(FarmInvite)
    private readonly invitesRepo: Repository<FarmInvite>,
    @InjectRepository(FarmMember)
    private readonly membersRepo: Repository<FarmMember>,
    @InjectRepository(Farm)
    private readonly farmsRepo: Repository<Farm>,
    private readonly farmAccess: FarmAccessService,
    private readonly dataSource: DataSource,
  ) {}

  private generateCode(): string {
    const bytes = randomBytes(CODE_LENGTH);
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
    }
    return code;
  }

  /** Generate a code not already taken. Throws rather than returning a dup. */
  private async allocateCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = this.generateCode();
      const taken = await this.invitesRepo.findOne({ where: { code } });
      if (!taken) return code;
    }
    throw new InternalServerErrorException(
      'Could not allocate a unique invite code. Please try again.',
    );
  }

  /** Create an invite. Requires MANAGE_WORKERS + canAssignRole for the role. */
  async create(farmId: string, callerId: string, dto: CreateInviteDto) {
    await this.farmAccess.assertCanAccessFarm(
      callerId,
      farmId,
      'MANAGE_WORKERS',
    );

    const callerRole = await this.farmAccess.getRoleOnFarm(callerId, farmId);
    const role = dto.role ?? 'worker';
    if (!canAssignRole(callerRole, role)) {
      // Same rule as addMember: an invite must not become a way to grant a
      // role the caller could not assign directly.
      throw new ForbiddenException(
        `Your role (${callerRole ?? 'none'}) cannot assign the "${role}" role`,
      );
    }

    const expiresAt = new Date(
      Date.now() + (dto.expiresInHours ?? DEFAULT_EXPIRY_HOURS) * 3600_000,
    );

    const invite = this.invitesRepo.create({
      farmId,
      code: await this.allocateCode(),
      role,
      createdById: callerId,
      expiresAt,
      maxUses: dto.maxUses ?? 1,
      usedCount: 0,
      revokedAt: null,
    });
    const saved = await this.invitesRepo.save(invite);

    // The code is returned here and listed by `list()` below; it is not a
    // secret from the people who may manage workers on this farm.
    return this.toResponse(saved);
  }

  /** Active (not revoked, not expired, not exhausted) invites for a farm. */
  async list(farmId: string, callerId: string) {
    await this.farmAccess.assertCanAccessFarm(
      callerId,
      farmId,
      'MANAGE_WORKERS',
    );

    let invites: FarmInvite[] = [];
    try {
      invites = await this.invitesRepo.find({
        where: { farmId, revokedAt: IsNull() },
        order: { createdAt: 'DESC' },
      });
    } catch (err) {
      if (!isMissingTable(err)) throw err;
      this.logger.warn(
        'farm_invites table missing — run migrations; returning no invites',
      );
      return [];
    }

    const now = new Date();
    return invites
      .filter((i) => inviteRejection(i, now) === null)
      .map((i) => this.toResponse(i));
  }

  /** Revoke an invite. Idempotent: revoking an already-revoked one is a no-op. */
  async revoke(farmId: string, inviteId: string, callerId: string) {
    await this.farmAccess.assertCanAccessFarm(
      callerId,
      farmId,
      'MANAGE_WORKERS',
    );

    const invite = await this.invitesRepo.findOne({
      where: { id: inviteId, farmId },
    });
    if (!invite) {
      throw new NotFoundException('Invite not found');
    }
    if (!invite.revokedAt) {
      invite.revokedAt = new Date();
      await this.invitesRepo.save(invite);
    }
    return { id: invite.id, revokedAt: invite.revokedAt };
  }

  /**
   * Retire every active invite for a farm and mint a fresh single-purpose one.
   * This is how an owner deliberately kills a legacy `farm_code` that has been
   * circulating on a whiteboard.
   */
  async rotate(farmId: string, callerId: string, dto: CreateInviteDto) {
    await this.farmAccess.assertCanAccessFarm(
      callerId,
      farmId,
      'MANAGE_WORKERS',
    );
    await this.invitesRepo.update(
      { farmId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    return this.create(farmId, callerId, dto);
  }

  /**
   * Redeem a code and create the membership.
   *
   * The whole redemption runs in ONE transaction with the invite row locked, so
   * two people racing the last use of a `maxUses: 1` code cannot both get in.
   */
  async join(callerId: string, dto: JoinFarmDto) {
    const code = dto.code.toUpperCase();

    return this.dataSource.transaction(async (manager) => {
      let invite: FarmInvite | null = null;
      try {
        invite = await manager.findOne(FarmInvite, {
          where: { code },
          lock: { mode: 'pessimistic_write' },
        });
      } catch (err) {
        if (!isMissingTable(err)) throw err;
        // Deploy-before-migrate window: fall back to the legacy farm_code path
        // so joining keeps working until a human runs the migration.
        this.logger.warn(
          'farm_invites table missing — run migrations; falling back to legacy farmCode join',
        );
        return this.legacyJoinByFarmCode(manager, callerId, code);
      }

      const rejection = inviteRejection(invite, new Date());
      if (rejection) {
        // A code that is not an invite may still be a live legacy farm_code
        // whose backfill row was never created (a farm created between deploy
        // and migrate). Only fall back for not_found — a revoked or expired
        // invite must stay rejected, not silently succeed via the old path.
        if (rejection === 'not_found') {
          return this.legacyJoinByFarmCode(manager, callerId, code);
        }
        this.throwRejection(rejection);
      }

      const farm = await manager.findOne(Farm, {
        where: { id: invite!.farmId },
      });
      if (!farm || farm.deletedAt) {
        throw new NotFoundException('No farm found for that code');
      }
      this.assertJoinable(farm, callerId);

      const existing = await manager.findOne(FarmMember, {
        where: { farmId: farm.id, userId: callerId },
      });
      if (existing) {
        throw new ConflictException(
          existing.status === 'pending'
            ? 'You have already asked to join this farm. The owner has not let you in yet.'
            : 'You are already a member of this farm',
        );
      }

      // The farm decides what redeeming its code actually does. Under
      // 'manual' (the default) the joiner lands in the waiting queue and
      // gets NOTHING until someone approves; under 'auto' they are a member
      // straight away, which is the pre-approval behaviour.
      const status = farm.joinApproval === 'auto' ? 'active' : 'pending';

      const member = manager.create(FarmMember, {
        farmId: farm.id,
        userId: callerId,
        role: invite!.role,
        status,
        // Attribute the membership to whoever issued the invite, so the roster
        // shows who let this person in instead of a blank.
        addedById: invite!.createdById,
      });
      await manager.save(member);

      // Same transaction as the membership insert — the count cannot drift.
      await manager.increment(FarmInvite, { id: invite!.id }, 'usedCount', 1);

      return {
        farmId: farm.id,
        role: member.role,
        status,
        farm: { id: farm.id, name: farm.name },
      };
    });
  }

  /**
   * Pre-`farm_invites` behaviour, kept ONLY for the deploy-before-migrate
   * window and for farms whose backfill row does not exist yet. Grants a
   * `worker` membership with a null `addedById`, exactly as before.
   */
  private async legacyJoinByFarmCode(
    manager: DataSource['manager'],
    callerId: string,
    code: string,
  ) {
    const farm = await manager.findOne(Farm, { where: { farmCode: code } });
    if (!farm || farm.deletedAt) {
      throw new NotFoundException('No farm found for that code');
    }
    this.assertJoinable(farm, callerId);

    const existing = await manager.findOne(FarmMember, {
      where: { farmId: farm.id, userId: callerId },
    });
    if (existing) {
      throw new ConflictException('You are already a member of this farm');
    }

    const status = farm.joinApproval === 'auto' ? 'active' : 'pending';
    const member = manager.create(FarmMember, {
      farmId: farm.id,
      userId: callerId,
      role: 'worker',
      status,
      addedById: null,
    });
    await manager.save(member);
    return {
      farmId: farm.id,
      role: member.role,
      status,
      farm: { id: farm.id, name: farm.name },
    };
  }

  private assertJoinable(farm: Farm, callerId: string) {
    if (farm.userId === callerId) {
      throw new ConflictException('You already own this farm');
    }
  }

  private throwRejection(rejection: InviteRejection): never {
    const { status, message } = REJECTION_RESPONSE[rejection];
    // 410 Gone for a code that existed and is no longer usable, so the client
    // can tell "wrong code" apart from "this code is dead" and translate each.
    throw status === 'gone'
      ? new GoneException({ message, reason: rejection })
      : new NotFoundException({ message, reason: rejection });
  }

  private toResponse(invite: FarmInvite) {
    return {
      id: invite.id,
      code: invite.code,
      role: invite.role,
      expiresAt: invite.expiresAt,
      maxUses: invite.maxUses,
      usedCount: invite.usedCount,
      createdAt: invite.createdAt,
    };
  }

  // ==================== Waiting to be let in ====================

  /**
   * May this user act on the pending queue?
   *
   * MANAGE_WORKERS (owner + manager) is the floor — approving someone is a
   * member-management action. On top of that the farm's `joinApprover` can
   * narrow it to the owner alone, for farms where letting a stranger in is the
   * owner's call even though managers handle everyone else.
   */
  private async assertCanApprove(farmId: string, callerId: string) {
    const farm = await this.farmAccess.assertCanAccessFarm(
      callerId,
      farmId,
      'MANAGE_WORKERS',
    );
    if (farm.joinApprover === 'owner') {
      const role = await this.farmAccess.getRoleOnFarm(callerId, farmId);
      if (role !== 'owner') {
        throw new ForbiddenException(
          'Only the farm owner can let new members in on this farm',
        );
      }
    }
    return farm;
  }

  /** The "waiting to be let in" queue for a farm. */
  async listPending(farmId: string, callerId: string) {
    await this.assertCanApprove(farmId, callerId);
    try {
      return await this.membersRepo.find({
        where: { farmId, status: 'pending' },
        order: { createdAt: 'ASC' },
      });
    } catch (err) {
      if (!isMissingTable(err)) throw err;
      this.logger.warn(
        'farm_members.status missing — run migrations; no pending queue',
      );
      return [];
    }
  }

  /**
   * Let someone in: flip `pending` to `active` and record who approved.
   *
   * `role` optionally overrides what the code granted, so an owner can promote
   * on the way in rather than approving then editing. Bounded by
   * `canAssignRole` exactly as a direct add would be.
   */
  async approve(
    farmId: string,
    userId: string,
    callerId: string,
    role?: FarmRole,
  ) {
    await this.assertCanApprove(farmId, callerId);

    const member = await this.membersRepo.findOne({
      where: { farmId, userId, status: 'pending' },
    });
    if (!member) {
      throw new NotFoundException('No pending request for that person');
    }

    if (role && role !== member.role) {
      const callerRole = await this.farmAccess.getRoleOnFarm(callerId, farmId);
      if (!canAssignRole(callerRole, role as any)) {
        throw new ForbiddenException(
          `Your role (${callerRole ?? 'none'}) cannot assign the "${role}" role`,
        );
      }
      member.role = role;
    }

    member.status = 'active';
    // Overwrite the invite issuer with whoever actually let them in — that is
    // the accountable decision, and the roster shows it.
    member.addedById = callerId;
    await this.membersRepo.save(member);
    return { farmId, userId, role: member.role, status: member.status };
  }

  /**
   * Turn someone away. Deletes the pending row rather than marking it
   * declined: the row granted nothing, keeping it would clutter the queue, and
   * the person can ask again with a fresh code if the owner changes their mind.
   */
  async decline(farmId: string, userId: string, callerId: string) {
    await this.assertCanApprove(farmId, callerId);

    const member = await this.membersRepo.findOne({
      where: { farmId, userId, status: 'pending' },
    });
    if (!member) {
      throw new NotFoundException('No pending request for that person');
    }
    await this.membersRepo.remove(member);
    return { farmId, userId, declined: true };
  }

  /**
   * Change the farm's join policy. OWNER_ONLY: who may let people in, and
   * whether approval happens at all, are decisions about the farm itself, not
   * routine member management — a manager must not be able to switch approval
   * off and then walk people in.
   */
  async setJoinPolicy(
    farmId: string,
    callerId: string,
    policy: { joinApproval?: 'manual' | 'auto'; joinApprover?: 'owner' | 'managers' },
  ) {
    await this.farmAccess.assertCanAccessFarm(callerId, farmId, 'OWNER_ONLY');

    const patch: Partial<Farm> = {};
    if (policy.joinApproval) patch.joinApproval = policy.joinApproval;
    if (policy.joinApprover) patch.joinApprover = policy.joinApprover;
    if (Object.keys(patch).length) {
      await this.farmsRepo.update({ id: farmId }, patch);
    }

    const farm = await this.farmsRepo.findOne({ where: { id: farmId } });
    return {
      joinApproval: farm?.joinApproval ?? 'manual',
      joinApprover: farm?.joinApprover ?? 'managers',
    };
  }
}

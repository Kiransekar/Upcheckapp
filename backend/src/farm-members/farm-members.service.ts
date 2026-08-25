import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FarmMember } from '../farm-access/farm-member.entity';
import { FarmAccessService } from '../farm-access/farm-access.service';
import { canAssignRole, canManageMember } from '../farm-access/farm-capability';
import { User } from '../auth/user.entity';
import { Farm } from '../farms/farm.entity';
import { Pond } from '../ponds/pond.entity';
import { AddMemberDto, AssignableRole } from './dto/add-member.dto';

/** Public-safe view of a user (never exposes auth/email/phone beyond display). */
export interface PublicUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  avatarUrl: string | null;
}

const toPublicUser = (u: User): PublicUser => ({
  id: u.id,
  firstName: u.firstName,
  lastName: u.lastName,
  username: u.username,
  avatarUrl: u.avatarUrl,
});

// Every lookup here only ever needs the fields toPublicUser() reads. A bare
// findOne() selects every mapped column on User by default — including ones
// added by a migration that hasn't been run yet in every environment (this
// exact class of bug took down login once already: a column the entity
// declares but the database doesn't have yet turns into a raw 500 for every
// caller, not just the one screen that "needed" the new field). Scoping the
// select to what's actually used means this code never has to care whether
// the rest of the User columns are migrated yet.
const PUBLIC_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  avatarUrl: true,
} as const;

@Injectable()
export class FarmMembersService {
  constructor(
    @InjectRepository(FarmMember)
    private readonly membersRepo: Repository<FarmMember>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Farm)
    private readonly farmsRepo: Repository<Farm>,
    @InjectRepository(Pond)
    private readonly pondsRepo: Repository<Pond>,
    private readonly farmAccess: FarmAccessService,
  ) {}

  /** Resolve one user by unique id (QR payload), else phone, else email. */
  async lookupUser(query: {
    userId?: string;
    phone?: string;
    email?: string;
  }): Promise<PublicUser> {
    let user: User | null = null;
    if (query.userId) {
      user = await this.usersRepo.findOne({
        where: { id: query.userId },
        select: PUBLIC_USER_SELECT,
      });
    }
    if (!user && query.phone) {
      user = await this.usersRepo.findOne({
        where: { phone: query.phone },
        select: PUBLIC_USER_SELECT,
      });
    }
    if (!user && query.email) {
      user = await this.usersRepo.findOne({
        where: { email: query.email.toLowerCase() },
        select: PUBLIC_USER_SELECT,
      });
    }
    if (!user) {
      throw new NotFoundException('No user found for the provided identifier');
    }
    return toPublicUser(user);
  }

  /**
   * Add a member to a farm. Owner may add manager/worker/viewer; manager may
   * add workers only (enforced via canAssignRole). Defaults to 'worker'.
   */
  async addMember(farmId: string, callerId: string, dto: AddMemberDto) {
    // Must at least be able to manage workers (owner or manager) and the farm must exist/be live.
    await this.farmAccess.assertCanAccessFarm(
      callerId,
      farmId,
      'MANAGE_WORKERS',
    );

    const callerRole = await this.farmAccess.getRoleOnFarm(callerId, farmId);
    const targetRole = dto.role ?? 'worker';
    if (!canAssignRole(callerRole, targetRole)) {
      throw new ForbiddenException(
        `Your role (${callerRole ?? 'none'}) cannot assign the "${targetRole}" role`,
      );
    }

    const target = await this.usersRepo.findOne({
      where: { id: dto.userId },
      select: PUBLIC_USER_SELECT,
    });
    if (!target) {
      throw new NotFoundException('User to add was not found');
    }

    const farm = await this.farmsRepo.findOne({ where: { id: farmId } });
    if (target.id === farm?.userId) {
      throw new ConflictException('This user is the farm owner');
    }

    const existing = await this.membersRepo.findOne({
      where: { farmId, userId: dto.userId },
    });
    if (existing) {
      throw new ConflictException('User is already a member of this farm');
    }

    const member = this.membersRepo.create({
      farmId,
      userId: dto.userId,
      role: targetRole,
      addedById: callerId,
    });
    await this.membersRepo.save(member);
    return { ...member, user: toPublicUser(target) };
  }

  // NOTE: `joinFarm` lived here and looked a farm up by `farmCode`, inserting a
  // `worker` membership with a null `addedById`. It has moved to
  // FarmInvitesService.join, which redeems a `farm_invites` row instead — so a
  // join can expire, be revoked, be usage-capped, and be attributed to whoever
  // issued the invite. The legacy farmCode lookup survives there as a fallback
  // for the deploy-before-migrate window only.

  /**
   * Restrict a member to specific ponds, or clear the restriction with an
   * empty list. MANAGE_WORKERS, same as changing their role.
   *
   * Scoping is only meaningful for worker/viewer — owners and managers are
   * responsible for the whole farm — so setting it on one is refused rather
   * than stored and silently ignored.
   */
  async setPondScope(
    farmId: string,
    callerId: string,
    targetUserId: string,
    pondIds: string[],
  ) {
    await this.farmAccess.assertCanAccessFarm(callerId, farmId, 'MANAGE_WORKERS');

    const member = await this.membersRepo.findOne({
      where: { farmId, userId: targetUserId },
    });
    if (!member) {
      throw new NotFoundException('That person is not a member of this farm');
    }
    if (member.role === 'owner' || member.role === 'manager') {
      throw new BadRequestException(
        'Owners and managers always have access to every pond on the farm',
      );
    }

    const callerRole = await this.farmAccess.getRoleOnFarm(callerId, farmId);
    if (!canManageMember(callerRole, member.role)) {
      throw new ForbiddenException(
        `Your role (${callerRole ?? 'none'}) cannot manage a "${member.role}"`,
      );
    }

    // Every pond must belong to THIS farm, or a scope row would point at
    // another tenant's pond and quietly widen access across farms.
    if (pondIds.length > 0) {
      const owned = await this.pondsRepo.find({
        where: { id: In(pondIds), farmId },
        select: { id: true },
      });
      if (owned.length !== pondIds.length) {
        throw new BadRequestException(
          'One or more of those ponds do not belong to this farm',
        );
      }
    }

    await this.farmAccess.setPondScope(member.id, pondIds);
    return { farmId, userId: targetUserId, pondIds };
  }

  /** List members of a farm (any member may view). */
  async listMembers(farmId: string, callerId: string) {
    await this.farmAccess.assertCanAccessFarm(callerId, farmId, 'READ');
    const members = await this.membersRepo.find({
      where: { farmId },
      order: { role: 'ASC', createdAt: 'ASC' },
    });
    // Was `relations: ['user']` — an eager relation load selects every
    // column of the joined entity with no way to scope it, same as a bare
    // findOne(), so it hit the exact same missing-column failure this file
    // was already fixed for elsewhere: the whole list request 500'd (caught
    // client-side and shown as "no workers", success message notwithstanding,
    // rather than the real error). Batch-fetching with the same scoped
    // select sidesteps it entirely.
    const users = members.length
      ? await this.usersRepo.find({
          where: { id: In(members.map((m) => m.userId)) },
          select: PUBLIC_USER_SELECT,
        })
      : [];
    const userById = new Map(users.map((u) => [u.id, u]));

    // Pond scopes for the whole roster in one query — the members screen shows
    // "Ponds 1, 4, 7" per worker, and doing this per member would be N+1.
    const scopes = await this.farmAccess.getPondScopesForMembers(
      members.map((m) => m.id),
    );

    return members.map((m) => ({
      id: m.id,
      farmId: m.farmId,
      userId: m.userId,
      role: m.role,
      status: m.status,
      // Empty = every pond on the farm. Owners and managers are never scoped.
      pondIds: scopes.get(m.id) ?? [],
      createdAt: m.createdAt,
      user: userById.has(m.userId) ? toPublicUser(userById.get(m.userId)!) : null,
    }));
  }

  /**
   * Remove a member. Owner may remove manager/worker/viewer; manager may
   * remove workers only (canManageMember). The primary owner cannot be removed.
   */
  async removeMember(farmId: string, callerId: string, targetUserId: string) {
    await this.farmAccess.assertCanAccessFarm(
      callerId,
      farmId,
      'MANAGE_WORKERS',
    );

    const farm = await this.farmsRepo.findOne({ where: { id: farmId } });
    if (farm && farm.userId === targetUserId) {
      throw new BadRequestException('The farm owner cannot be removed');
    }

    const member = await this.membersRepo.findOne({
      where: { farmId, userId: targetUserId },
    });
    if (!member) {
      throw new NotFoundException('Membership not found');
    }

    const callerRole = await this.farmAccess.getRoleOnFarm(callerId, farmId);
    if (!canManageMember(callerRole, member.role)) {
      throw new ForbiddenException(
        `Your role (${callerRole ?? 'none'}) cannot remove a "${member.role}" member`,
      );
    }

    await this.membersRepo.delete({ id: member.id });
    return { message: 'Member removed' };
  }

  /** Change a member's role. Owner only (blueprint §28). */
  async changeMemberRole(
    farmId: string,
    callerId: string,
    targetUserId: string,
    newRole: AssignableRole,
  ) {
    await this.farmAccess.assertCanAccessFarm(callerId, farmId, 'OWNER_ONLY');

    const farm = await this.farmsRepo.findOne({ where: { id: farmId } });
    if (farm && farm.userId === targetUserId) {
      throw new BadRequestException(
        "The owner's role is changed via ownership transfer",
      );
    }

    const member = await this.membersRepo.findOne({
      where: { farmId, userId: targetUserId },
    });
    if (!member) {
      throw new NotFoundException('Membership not found');
    }
    if (member.role === 'owner') {
      throw new ForbiddenException('Use ownership transfer to change an owner');
    }

    const callerRole = await this.farmAccess.getRoleOnFarm(callerId, farmId);
    if (!canAssignRole(callerRole, newRole)) {
      throw new ForbiddenException(
        `Your role cannot assign the "${newRole}" role`,
      );
    }

    member.role = newRole;
    await this.membersRepo.save(member);
    return { farmId, userId: targetUserId, role: newRole };
  }

  /**
   * Transfer farm ownership to an existing member. Owner only. The new owner
   * must already be a member; the outgoing owner is demoted to manager. The
   * farm.userId and both membership rows update atomically.
   * NOTE: OTP re-verification (blueprint §28.6) is layered on in the
   * security-hardening pass (Stage 5).
   */
  async transferOwnership(
    farmId: string,
    callerId: string,
    newOwnerUserId: string,
  ) {
    await this.farmAccess.assertCanAccessFarm(callerId, farmId, 'OWNER_ONLY');
    if (newOwnerUserId === callerId) {
      throw new BadRequestException('You already own this farm');
    }

    const farm = await this.farmsRepo.findOne({ where: { id: farmId } });
    if (!farm) {
      throw new NotFoundException('Farm not found');
    }

    const newOwnerMember = await this.membersRepo.findOne({
      where: { farmId, userId: newOwnerUserId },
    });
    if (!newOwnerMember) {
      throw new BadRequestException(
        'The new owner must already be a member of this farm',
      );
    }

    await this.membersRepo.manager.transaction(async (mgr) => {
      newOwnerMember.role = 'owner';
      await mgr.save(newOwnerMember);

      // Demote the outgoing owner's membership to manager (create the row
      // if the legacy owner never had an explicit membership).
      let callerMember = await mgr.findOne(FarmMember, {
        where: { farmId, userId: callerId },
      });
      if (callerMember) {
        callerMember.role = 'manager';
      } else {
        callerMember = mgr.create(FarmMember, {
          farmId,
          userId: callerId,
          role: 'manager',
          addedById: callerId,
        });
      }
      await mgr.save(callerMember);

      farm.userId = newOwnerUserId;
      await mgr.save(farm);
    });

    return { message: 'Ownership transferred', farmId, newOwnerUserId };
  }

  /** Farms the caller belongs to (owner or worker), with their role. */
  async listMine(callerId: string) {
    const members = await this.membersRepo.find({
      where: { userId: callerId },
      relations: ['farm'],
    });
    const result = members
      .filter((m) => m.farm && !m.farm.deletedAt)
      .map((m) => ({
        farmId: m.farmId,
        role: m.role,
        farm: m.farm
          ? { id: m.farm.id, name: m.farm.name, farmCode: m.farm.farmCode }
          : null,
      }));

    // Farm creation never inserts an owner membership row, so the owner would
    // otherwise get NO row here and resolve to a null role on the frontend —
    // hiding every owner/financial/management action on their own farm. Union
    // in owned farms as role 'owner' (backend getRoleOnFarm already does this
    // via farm.userId; this makes the frontend agree).
    const ownedFarms = await this.farmsRepo.find({
      where: { userId: callerId },
    });
    const seen = new Set(result.map((r) => r.farmId));
    for (const farm of ownedFarms) {
      if (farm.deletedAt || seen.has(farm.id)) continue;
      result.push({
        farmId: farm.id,
        role: 'owner',
        farm: { id: farm.id, name: farm.name, farmCode: farm.farmCode },
      });
    }
    return result;
  }
}

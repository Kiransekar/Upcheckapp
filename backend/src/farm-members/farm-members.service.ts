import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FarmMember, FarmRole } from '../farm-access/farm-member.entity';
import { FarmAccessService } from '../farm-access/farm-access.service';
import {
  canAssignRole,
  canManageMember,
  CapabilityOverrides,
  invalidOverrideKey,
} from '../farm-access/farm-capability';
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
  /**
   * Grant or revoke cost visibility for one member, overriding the role
   * default. `null` restores the default (owner + manager see financials).
   *
   * OWNER_ONLY, deliberately stricter than MANAGE_WORKERS: who sees the farm's
   * books is the owner's call, and a manager who could grant it to themselves
   * or to a worker would make the setting meaningless.
   */
  async setFinancialAccess(
    farmId: string,
    callerId: string,
    targetUserId: string,
    canViewFinancials: boolean | null,
  ) {
    // The lone financial switch is now one row of the capability grid. Kept as
    // a route for one release, because an app build already in farmers' hands
    // still calls it.
    await this.updateMemberOverrides(farmId, callerId, targetUserId, (cur) => {
      const next = { ...cur };
      if (canViewFinancials === null) delete next.VIEW_FINANCIALS;
      else next.VIEW_FINANCIALS = canViewFinancials;
      return next;
    });
    return { farmId, userId: targetUserId, canViewFinancials };
  }

  /**
   * Replace a member's capability overrides wholesale. Owner only, same reason
   * setFinancialAccess was: who may record a harvest or see the books is the
   * owner's call, and a manager who could grant it to themselves would make
   * the setting meaningless.
   *
   * `null` (or `{}`) clears every override, restoring the farm's role policy
   * and then the role default.
   */
  async setCapabilities(
    farmId: string,
    callerId: string,
    targetUserId: string,
    overrides: CapabilityOverrides | null,
  ) {
    const saved = await this.updateMemberOverrides(
      farmId,
      callerId,
      targetUserId,
      () => overrides ?? {},
    );
    return { farmId, userId: targetUserId, capabilityOverrides: saved };
  }

  /** Shared write path so both routes authorize and normalise identically. */
  private async updateMemberOverrides(
    farmId: string,
    callerId: string,
    targetUserId: string,
    apply: (current: CapabilityOverrides) => CapabilityOverrides,
  ): Promise<CapabilityOverrides | null> {
    await this.farmAccess.assertCanAccessFarm(callerId, farmId, 'OWNER_ONLY');

    const member = await this.membersRepo.findOne({
      where: { farmId, userId: targetUserId },
    });
    if (!member) {
      throw new NotFoundException('That person is not a member of this farm');
    }
    if (member.role === 'owner') {
      throw new BadRequestException(
        'The farm owner always has every permission on their own farm',
      );
    }

    const next = apply(member.capabilityOverrides ?? {});
    // Validated AFTER authorization, and on the result rather than the input,
    // so both routes are held to the same rule: nothing outside the grantable
    // set reaches the column, whichever one wrote it.
    const bad = invalidOverrideKey(next);
    if (bad) {
      throw new BadRequestException(
        `"${bad}" is not a permission that can be granted per member`,
      );
    }
    // An empty object and null mean the same thing (no override); store null so
    // the column reads as "never decided" rather than "decided nothing".
    member.capabilityOverrides = Object.keys(next).length > 0 ? next : null;
    // One-release compatibility: the previous deploy reads this column.
    member.canViewFinancials = next.VIEW_FINANCIALS ?? null;
    await this.membersRepo.save(member);
    return member.capabilityOverrides;
  }

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

  /**
   * Farms the caller belongs to, with everything the app needs to reach the
   * same permission verdict the backend will.
   *
   * `status: 'active'` is load-bearing twice over: a pending row grants nothing
   * server-side, so returning it handed the client a full worker role for a
   * farm it was not in yet and every tap came back 403. It is also projected,
   * so a client that gets a row knows what it is.
   */
  async listMine(callerId: string) {
    const members = await this.membersRepo.find({
      where: { userId: callerId, status: 'active' },
      relations: ['farm'],
    });
    const result = members
      .filter((m) => m.farm && !m.farm.deletedAt)
      .map((m) => ({
        farmId: m.farmId,
        role: m.role as FarmRole,
        status: 'active' as const,
        capabilityOverrides: m.capabilityOverrides ?? null,
        rolePolicy: m.farm.rolePolicy ?? null,
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
        status: 'active' as const,
        // An owner is never reduced, so an override on them would be a lie.
        capabilityOverrides: null,
        rolePolicy: farm.rolePolicy ?? null,
        farm: { id: farm.id, name: farm.name, farmCode: farm.farmCode },
      });
    }
    return result;
  }

  /**
   * Join requests the caller has made that nobody has answered yet.
   *
   * DELIBERATELY SEPARATE from `listMine`, and deliberately carrying no role,
   * no capability overrides and no role policy. A pending row grants nothing
   * server-side; the moment one appears in the memberships list the client
   * resolves a full worker role for a farm it is not in yet, and every tap
   * comes back 403. That is exactly why `listMine` filters on
   * `status: 'active'`, and this must not undo it.
   *
   * It exists because the alternative was worse: `getAccessibleFarmIds` also
   * filters on active — correctly, it is a real authorization boundary — so a
   * worker waiting for approval had ZERO accessible farms and Home showed them
   * the brand-new-user state, "No farms yet: create a farm or join with a
   * code". They had just joined one. Re-entering the code then told them the
   * code was wrong.
   *
   * So this returns the minimum needed to say "waiting for X to let you in",
   * and nothing that could be mistaken for access.
   */
  async listMyPendingRequests(callerId: string) {
    const pending = await this.membersRepo.find({
      where: { userId: callerId, status: 'pending' },
      relations: ['farm'],
    });
    return pending
      .filter((m) => m.farm && !m.farm.deletedAt)
      .map((m) => ({
        farmId: m.farmId,
        farmName: m.farm.name,
        // What they will be once approved — for the copy only. It is not a
        // role they hold, and nothing may treat it as one.
        requestedRole: m.role as FarmRole,
        requestedAt: m.createdAt ?? null,
      }));
  }
}

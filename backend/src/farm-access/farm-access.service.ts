import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { FarmMember, FarmRole } from './farm-member.entity';
import { FarmMemberPond, SCOPABLE_ROLES } from './farm-member-pond.entity';
import { Farm } from '../farms/farm.entity';
import { Pond } from '../ponds/pond.entity';
import {
  FarmCapability,
  MembershipGrant,
  roleSatisfies,
} from './farm-capability';

/**
 * Postgres "undefined_table" (42P01) — raised when the `farm_members` table
 * doesn't exist yet (the CreateFarmMembers migration hasn't been run). Lets the
 * app degrade to owner-only access during a deploy-before-migrate window instead
 * of hard-failing every farm-scoped request.
 */
function isMissingTable(err: any): boolean {
  return (err?.code ?? err?.driverError?.code) === '42P01';
}

/**
 * FarmAccessService — the single source of truth for "can this user perform an
 * action of capability C on this farm/pond?". Both the OwnershipGuard (route
 * layer) and the member-aware service methods delegate here, so the owner/worker
 * policy lives in one place.
 *
 * Depends only on repositories (FarmMember / Farm / Pond) — NOT on FarmsService
 * or PondsService — to avoid circular module dependencies.
 */
@Injectable()
export class FarmAccessService {
  private readonly logger = new Logger(FarmAccessService.name);

  constructor(
    @InjectRepository(FarmMember)
    private readonly membersRepo: Repository<FarmMember>,
    @InjectRepository(Farm)
    private readonly farmsRepo: Repository<Farm>,
    @InjectRepository(Pond)
    private readonly pondsRepo: Repository<Pond>,
    @InjectRepository(FarmMemberPond)
    private readonly memberPondsRepo: Repository<FarmMemberPond>,
  ) {}

  /**
   * Resolve a user's role on a farm. Returns null if they are not a member.
   * Defensive fallback: if the farm's primary owner column matches the user
   * but no membership row exists (e.g. pre-backfill data), treat as owner.
   */
  async getRoleOnFarm(
    userId: string,
    farmId: string,
  ): Promise<FarmRole | null> {
    return (await this.getMembershipOnFarm(userId, farmId)).role;
  }

  /**
   * Role PLUS both layers of grant, resolved together.
   *
   * Every capability decision needs all three — `roleSatisfies` reads the
   * member's overrides, then the farm's role policy, then the matrix — and
   * fetching them separately would mean more queries and more chances for them
   * to disagree.
   *
   * `knownFarm` is for the caller that has already loaded the farm
   * (assertCanAccessFarm does, on every request); passing it in keeps this at
   * exactly one query on the hot path.
   */
  async getMembershipOnFarm(
    userId: string,
    farmId: string,
    knownFarm?: Farm | null,
  ): Promise<MembershipGrant> {
    // status: 'active' is load-bearing. A 'pending' row is someone who
    // redeemed the farm code and is WAITING to be let in — it must grant
    // nothing at all until an owner approves it. Filtering here covers every
    // capability check in the app, since they all resolve a role through this.
    const memberQuery = this.membersRepo
      .findOne({ where: { farmId, userId, status: 'active' } })
      .catch((err) => {
        if (!isMissingTable(err)) throw err;
        this.logger.warn(
          'farm_members table missing — run migrations; using owner-only access',
        );
        return null;
      });
    // In parallel, not after: the role policy is needed whatever the membership
    // says, and this method fires on every farm-scoped request.
    const farmQuery =
      knownFarm !== undefined
        ? Promise.resolve(knownFarm)
        : this.farmsRepo.findOne({
            where: { id: farmId },
            select: { id: true, userId: true, rolePolicy: true },
          });
    const [member, farm] = await Promise.all([memberQuery, farmQuery]);
    const policy = farm?.rolePolicy ?? null;

    if (member) {
      return {
        role: member.role,
        overrides: member.capabilityOverrides ?? null,
        policy,
      };
    }
    if (farm && farm.userId === userId) {
      return { role: 'owner', overrides: null, policy };
    }
    return { role: null, overrides: null, policy: null };
  }

  /** Farm ids the user can access (owner or worker), excluding soft-deleted farms. */
  async getAccessibleFarmIds(userId: string): Promise<string[]> {
    // The membership lookup and the legacy-owner lookup don't depend on each
    // other — running them sequentially (as separate awaits) was one of the
    // biggest contributors to the pond dashboard's multi-second load, since
    // this method fires on every list endpoint call (harvests, sampling, …)
    // and each one used to cost 3 sequential round-trips before this fix.
    const [memberFarmIds, ownedIds] = await Promise.all([
      this.membersRepo
        .find({ where: { userId, status: 'active' }, select: { farmId: true } })
        .then((members) => members.map((m) => m.farmId))
        .catch((err) => {
          if (!isMissingTable(err)) throw err;
          this.logger.warn(
            'farm_members table missing — run migrations; listing owned farms only',
          );
          return [] as string[];
        }),
      // Defensive union with the legacy owner column, in case any farm lacks
      // a backfilled membership row.
      this.farmsRepo
        .find({ where: { userId, deletedAt: IsNull() }, select: { id: true } })
        .then((owned) => owned.map((f) => f.id)),
    ]);

    const all = new Set([...memberFarmIds, ...ownedIds]);
    if (all.size === 0) return [];

    // Filter out soft-deleted farms (membership rows may point at them).
    //
    // Scoped to the ids we actually care about. This used to select EVERY live
    // farm in the database to filter a handful — a full table scan on a method
    // that, as the comment above says, fires on every list endpoint call
    // (harvests, sampling, ponds, reports…). Cost grew with total farms across
    // all tenants rather than with the caller's own, so it got slower for
    // everyone every time anyone signed up.
    const ids = [...all];
    const live = await this.farmsRepo.find({
      where: { id: In(ids), deletedAt: IsNull() },
      select: { id: true },
    });
    const liveIds = new Set(live.map((f) => f.id));
    return ids.filter((id) => liveIds.has(id));
  }

  /**
   * Farm ids where the user's role satisfies `capability` — e.g. the farms
   * whose financials a manager/owner may read. Used to scope list endpoints
   * (transactions, reports) without leaking other roles' farms.
   */
  async getFarmIdsWithCapability(
    userId: string,
    capability: FarmCapability,
  ): Promise<string[]> {
    const accessibleIds = await this.getAccessibleFarmIds(userId);
    if (accessibleIds.length === 0) return [];

    // Batch-load roles instead of one getRoleOnFarm() query per farm (AUDIT
    // id 142): a single membership query + a single owner-fallback query for
    // whatever's left, instead of up to 2 queries per accessible farm.
    let members: FarmMember[] = [];
    try {
      members = await this.membersRepo.find({
        where: { userId, farmId: In(accessibleIds), status: 'active' },
      });
    } catch (err) {
      if (!isMissingTable(err)) throw err;
      this.logger.warn(
        'farm_members table missing — run migrations; using owner-only access',
      );
    }
    const roleByFarm = new Map(members.map((m) => [m.farmId, m.role]));
    // Carry both grant layers alongside the role, so this batch path reaches
    // the same verdict as assertCanAccessFarm — a worker whose owner granted
    // VIEW_FINANCIALS by policy must see that farm in the money list.
    const overridesByFarm = new Map(
      members.map((m) => [m.farmId, m.capabilityOverrides ?? null]),
    );

    // One farms query serves two purposes: the role policies, and the
    // owner fallback for farms with no membership row (legacy owners).
    const farms = await this.farmsRepo.find({
      where: { id: In(accessibleIds) },
      select: { id: true, userId: true, rolePolicy: true },
    });
    const policyByFarm = new Map(farms.map((f) => [f.id, f.rolePolicy ?? null]));
    for (const f of farms) {
      if (!roleByFarm.has(f.id) && f.userId === userId) {
        roleByFarm.set(f.id, 'owner');
      }
    }

    return accessibleIds.filter((id) =>
      roleSatisfies(
        roleByFarm.get(id) ?? null,
        capability,
        overridesByFarm.get(id) ?? null,
        policyByFarm.get(id) ?? null,
      ),
    );
  }

  /**
   * Throw unless `userId` may perform `capability` on `farmId`. Mirrors the
   * existing `farmsService.verifyOwnership` behaviour: a soft-deleted or
   * missing farm yields NotFoundException. Returns the (live) farm on success.
   */
  async assertCanAccessFarm(
    userId: string,
    farmId: string,
    capability: FarmCapability,
  ): Promise<Farm> {
    const farm = await this.farmsRepo.findOne({ where: { id: farmId } });
    if (!farm || farm.deletedAt) {
      throw new NotFoundException(`Farm with ID ${farmId} not found`);
    }
    const { role, overrides, policy } = await this.getMembershipOnFarm(
      userId,
      farmId,
      farm,
    );
    if (!roleSatisfies(role, capability, overrides, policy)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action on this farm',
      );
    }
    return farm;
  }

  /**
   * Pond-scoped variant — the farm check, then the pond-scoping check.
   *
   * The farm check has to pass first: pond scoping NARROWS access within a farm
   * you already belong to, it never widens it.
   */
  async assertCanAccessPond(
    userId: string,
    pondId: string,
    capability: FarmCapability,
  ): Promise<Pond> {
    const pond = await this.pondsRepo.findOne({ where: { id: pondId } });
    if (!pond) {
      throw new NotFoundException(`Pond with ID ${pondId} not found`);
    }
    await this.assertCanAccessFarm(userId, pond.farmId, capability);

    if (!(await this.isPondInScope(userId, pond.farmId, pondId))) {
      throw new ForbiddenException(
        'You do not have access to this pond on this farm',
      );
    }
    return pond;
  }

  // ==================== Pond scoping (W4) ====================

  /**
   * Is this pond within the user's scope on this farm?
   *
   * True unless the user holds a scopable role (worker/viewer) AND has at least
   * one `farm_member_ponds` row — in which case the pond must be among them.
   * No rows means the whole farm, which is why this needs no backfill: every
   * membership that existed before this feature keeps exactly its old reach.
   */
  private async isPondInScope(
    userId: string,
    farmId: string,
    pondId: string,
    knownRole?: FarmRole | null,
  ): Promise<boolean> {
    const scoped = await this.getScopedPondIds(userId, farmId, knownRole);
    return scoped === null || scoped.has(pondId);
  }

  /**
   * The pond ids a user is restricted to on a farm, or null for "all ponds".
   *
   * Returns null (unrestricted) for owner and manager regardless of any rows —
   * they are responsible for the whole farm, and half-applying scoping to them
   * would be worse than not offering it.
   *
   * `knownRole` lets a caller that just resolved the membership hand it in
   * (`undefined` means "not resolved yet", which is not the same as the `null`
   * that means "no role on this farm"). Every caller had already looked it up,
   * so re-resolving here was a second identical query on every scoping check.
   */
  private async getScopedPondIds(
    userId: string,
    farmId: string,
    knownRole?: FarmRole | null,
  ): Promise<Set<string> | null> {
    const role =
      knownRole !== undefined
        ? knownRole
        : (await this.getMembershipOnFarm(userId, farmId)).role;
    if (!role || !SCOPABLE_ROLES.includes(role as any)) return null;

    try {
      const rows = await this.memberPondsRepo
        .createQueryBuilder('mp')
        .innerJoin(
          'farm_members',
          'fm',
          'fm.id = mp.farm_member_id AND fm.farm_id = :farmId AND fm.user_id = :userId',
          { farmId, userId },
        )
        .select('mp.pond_id', 'pondId')
        .getRawMany<{ pondId: string }>();

      // No rows = no restriction. This is the default for every member.
      if (rows.length === 0) return null;
      return new Set(rows.map((r) => r.pondId));
    } catch (err) {
      if (!isMissingTable(err)) throw err;
      // Deploy-before-migrate: without the table nobody is scoped, which is
      // exactly the pre-feature behaviour.
      this.logger.warn(
        'farm_member_ponds table missing — run migrations; no pond scoping applied',
      );
      return null;
    }
  }

  /**
   * Pond ids on `farmId` the user may act on at `capability`, for scoping list
   * endpoints and farm-level aggregates. Returns every live pond on the farm
   * when the user is unrestricted.
   */
  async getAccessiblePondIds(
    userId: string,
    farmId: string,
    capability: FarmCapability = 'READ',
  ): Promise<string[]> {
    // Farm-level permission first; a non-member gets nothing.
    const { role, overrides, policy } = await this.getMembershipOnFarm(
      userId,
      farmId,
    );
    if (!roleSatisfies(role, capability, overrides, policy)) return [];

    const all = await this.pondsRepo.find({
      where: { farmId },
      select: { id: true },
    });
    const allIds = all.map((p) => p.id);

    // `role` is already resolved above — pass it through so the scoping check
    // doesn't re-run the same membership query.
    const scoped = await this.getScopedPondIds(userId, farmId, role);
    if (scoped === null) return allIds;
    return allIds.filter((id) => scoped.has(id));
  }

  /**
   * Replace a member's pond scope. An empty array clears it, restoring
   * whole-farm access — the deliberate way to un-scope someone.
   */
  async setPondScope(
    farmMemberId: string,
    pondIds: string[],
  ): Promise<string[]> {
    await this.memberPondsRepo.delete({ farmMemberId });
    if (pondIds.length > 0) {
      await this.memberPondsRepo.insert(
        pondIds.map((pondId) => ({ farmMemberId, pondId })),
      );
    }
    return pondIds;
  }

  /** Pond ids each of these memberships is restricted to. Empty = all ponds. */
  async getPondScopesForMembers(
    farmMemberIds: string[],
  ): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>();
    if (farmMemberIds.length === 0) return out;
    try {
      const rows = await this.memberPondsRepo.find({
        where: { farmMemberId: In(farmMemberIds) },
      });
      for (const r of rows) {
        const list = out.get(r.farmMemberId) ?? [];
        list.push(r.pondId);
        out.set(r.farmMemberId, list);
      }
    } catch (err) {
      if (!isMissingTable(err)) throw err;
      this.logger.warn(
        'farm_member_ponds table missing — run migrations; reporting no scopes',
      );
    }
    return out;
  }
}

/**
 * W2 rework — "waiting to be let in".
 *
 * Redeeming a farm code now creates a `pending` membership by default. The
 * entire security value of that depends on ONE property: a pending row must
 * grant absolutely nothing until an owner approves it. If any access path
 * forgets to filter on status, the queue becomes decorative and the code is
 * back to admitting anyone who holds it.
 *
 * These drive the real FarmAccessService against stubbed repositories, one
 * test per access path, so a missed filter fails loudly rather than silently
 * letting a stranger in.
 */
import { ForbiddenException } from '@nestjs/common';
import { FarmAccessService } from './farm-access.service';
import { FarmCapability } from './farm-capability';

const FARM = 'farm-1';
const OWNER = 'user-owner';
const JOINER = 'user-joiner';

const ALL_CAPABILITIES: FarmCapability[] = [
  'READ',
  'WRITE_OPERATIONAL',
  'WRITE_MANAGEMENT',
  'VIEW_FINANCIALS',
  'MANAGE_WORKERS',
  'OWNER_ONLY',
];

/**
 * Build the service with a membership row in the given status. The repository
 * stub honours a `status` filter the way Postgres would, so a query that
 * forgets to pass one still finds the pending row — which is exactly the bug
 * these tests exist to catch.
 */
function makeService(status: 'active' | 'pending', canViewFinancials: boolean | null = null) {
  const row = {
    id: 'm1',
    farmId: FARM,
    userId: JOINER,
    role: 'worker' as const,
    status,
    canViewFinancials,
  };
  const matches = (where: any) =>
    (where.status === undefined || where.status === row.status) &&
    (where.userId === undefined || where.userId === row.userId) &&
    (where.farmId === undefined || where.farmId === row.farmId);

  const membersRepo = {
    findOne: jest.fn(async ({ where }: any) => (matches(where) ? row : null)),
    find: jest.fn(async ({ where }: any) => (matches(where) ? [row] : [])),
  };
  const farmsRepo = {
    // The farm belongs to someone else, so nothing rescues a non-member.
    findOne: jest.fn(async () => ({ id: FARM, userId: OWNER, deletedAt: null })),
    // `getAccessibleFarmIds` unions membership farms with farms the caller
    // OWNS via the legacy `farms.user_id` column. Honour `where.userId` here or
    // the stub hands JOINER a farm they do not own and the test passes for the
    // wrong reason. The unfiltered call (the live-farms sweep) still returns all.
    find: jest.fn(async (opts: any = {}) => {
      const where = opts.where ?? {};
      if (where.userId !== undefined && where.userId !== OWNER) return [];
      return [{ id: FARM }];
    }),
  };
  const pondsRepo = { findOne: jest.fn(async () => ({ id: 'pond-1', farmId: FARM })) };

  return new FarmAccessService(
    membersRepo as any,
    farmsRepo as any,
    pondsRepo as any,
  );
}

describe('pending membership grants nothing', () => {
  it.each(ALL_CAPABILITIES)('is denied %s on the farm', async (capability) => {
    const svc = makeService('pending');
    await expect(
      svc.assertCanAccessFarm(JOINER, FARM, capability),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each(ALL_CAPABILITIES)('is denied %s on a pond of that farm', async (capability) => {
    const svc = makeService('pending');
    await expect(
      svc.assertCanAccessPond(JOINER, 'pond-1', capability),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('resolves to no role at all', async () => {
    const svc = makeService('pending');
    await expect(svc.getRoleOnFarm(JOINER, FARM)).resolves.toBeNull();
  });

  it('does not appear in the accessible-farm list', async () => {
    const svc = makeService('pending');
    await expect(svc.getAccessibleFarmIds(JOINER)).resolves.toEqual([]);
  });

  it('does not appear in a capability-scoped farm list', async () => {
    const svc = makeService('pending');
    await expect(
      svc.getFarmIdsWithCapability(JOINER, 'READ'),
    ).resolves.toEqual([]);
  });
});

describe('the same membership, once approved, works normally', () => {
  it('resolves the role', async () => {
    const svc = makeService('active');
    await expect(svc.getRoleOnFarm(JOINER, FARM)).resolves.toBe('worker');
  });

  it.each(['READ', 'WRITE_OPERATIONAL'] as FarmCapability[])(
    'is allowed %s',
    async (capability) => {
      const svc = makeService('active');
      await expect(
        svc.assertCanAccessFarm(JOINER, FARM, capability),
      ).resolves.toBeDefined();
    },
  );

  it.each(['WRITE_MANAGEMENT', 'VIEW_FINANCIALS', 'OWNER_ONLY'] as FarmCapability[])(
    'is still denied %s, because worker never had it',
    async (capability) => {
      const svc = makeService('active');
      await expect(
        svc.assertCanAccessFarm(JOINER, FARM, capability),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it('appears in the accessible-farm list', async () => {
    const svc = makeService('active');
    await expect(svc.getAccessibleFarmIds(JOINER)).resolves.toEqual([FARM]);
  });
});

describe('W6 — per-farm financial grant', () => {
  it('grants VIEW_FINANCIALS to a worker when the owner switches it on', async () => {
    const svc = makeService('active', true);
    await expect(
      svc.assertCanAccessFarm(JOINER, FARM, 'VIEW_FINANCIALS'),
    ).resolves.toBeDefined();
  });

  it('still denies everything else the role does not carry', async () => {
    const svc = makeService('active', true);
    await expect(
      svc.assertCanAccessFarm(JOINER, FARM, 'WRITE_MANAGEMENT'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('revokes VIEW_FINANCIALS from a role that would otherwise have it', async () => {
    // A manager whose owner has turned cost visibility off.
    const svc = makeService('active', false);
    (svc as any).membersRepo = undefined; // guard against accidental reuse
    const managerSvc = (() => {
      const row = {
        farmId: FARM,
        userId: JOINER,
        role: 'manager' as const,
        status: 'active' as const,
        canViewFinancials: false,
      };
      const membersRepo = {
        findOne: jest.fn(async ({ where }: any) =>
          where.status === undefined || where.status === row.status ? row : null,
        ),
        find: jest.fn(async () => [row]),
      };
      return new FarmAccessService(
        membersRepo as any,
        { findOne: jest.fn(async () => ({ id: FARM, userId: OWNER, deletedAt: null })), find: jest.fn(async () => [{ id: FARM }]) } as any,
        { findOne: jest.fn() } as any,
      );
    })();

    await expect(
      managerSvc.assertCanAccessFarm(JOINER, FARM, 'VIEW_FINANCIALS'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    // ...but the rest of the manager role is untouched.
    await expect(
      managerSvc.assertCanAccessFarm(JOINER, FARM, 'WRITE_MANAGEMENT'),
    ).resolves.toBeDefined();
  });

  it('never locks an owner out of their own books', async () => {
    const row = {
      farmId: FARM,
      userId: OWNER,
      role: 'owner' as const,
      status: 'active' as const,
      canViewFinancials: false,
    };
    const svc = new FarmAccessService(
      {
        findOne: jest.fn(async () => row),
        find: jest.fn(async () => [row]),
      } as any,
      {
        findOne: jest.fn(async () => ({ id: FARM, userId: OWNER, deletedAt: null })),
        find: jest.fn(async () => [{ id: FARM }]),
      } as any,
      { findOne: jest.fn() } as any,
    );

    await expect(
      svc.assertCanAccessFarm(OWNER, FARM, 'VIEW_FINANCIALS'),
    ).resolves.toBeDefined();
  });
});

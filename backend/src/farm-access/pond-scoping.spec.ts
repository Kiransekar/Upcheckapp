/**
 * W4 — pond-level scoping.
 *
 * Membership was farm-level only: on a 20-pond farm every worker could see and
 * write to every pond, and the schema could not express "Ravi looks after ponds
 * 1, 4 and 7".
 *
 * The semantics that make this safe to ship with no backfill:
 *   NO rows  = all ponds (what every existing membership has)
 *   rows     = exactly those ponds
 * and it applies to worker/viewer only — owner and manager are responsible for
 * the whole farm.
 */
import { ForbiddenException } from '@nestjs/common';
import { FarmAccessService } from './farm-access.service';
import { FarmRole } from './farm-member.entity';

const FARM = 'farm-1';
const OWNER = 'user-owner';
const ACTOR = 'user-actor';
const POND_IN = 'pond-in-scope';
const POND_OUT = 'pond-out-of-scope';

function makeService(role: FarmRole, scopedPondIds: string[]) {
  const membersRepo = {
    findOne: jest.fn(async ({ where }: any) =>
      where.status === undefined || where.status === 'active'
        ? { id: 'm1', farmId: FARM, userId: ACTOR, role, status: 'active', canViewFinancials: null }
        : null,
    ),
    find: jest.fn(async () => [{ farmId: FARM, role, canViewFinancials: null }]),
  };
  const farmsRepo = {
    findOne: jest.fn(async () => ({ id: FARM, userId: OWNER, deletedAt: null })),
    find: jest.fn(async (opts: any = {}) =>
      opts.where?.userId !== undefined && opts.where.userId !== OWNER ? [] : [{ id: FARM }],
    ),
  };
  const pondsRepo = {
    findOne: jest.fn(async ({ where }: any) => ({ id: where.id, farmId: FARM })),
    find: jest.fn(async () => [{ id: POND_IN }, { id: POND_OUT }]),
  };
  const memberPondsRepo = {
    find: jest.fn(async () =>
      scopedPondIds.map((pondId) => ({ farmMemberId: 'm1', pondId })),
    ),
    delete: jest.fn(),
    insert: jest.fn(),
    createQueryBuilder: () => ({
      innerJoin() {
        return this;
      },
      select() {
        return this;
      },
      getRawMany: async () => scopedPondIds.map((pondId) => ({ pondId })),
    }),
  };

  return new FarmAccessService(
    membersRepo as any,
    farmsRepo as any,
    pondsRepo as any,
    memberPondsRepo as any,
  );
}

describe('no scope rows = the whole farm (the default, needing no backfill)', () => {
  it.each(['owner', 'manager', 'worker', 'viewer'] as FarmRole[])(
    '%s reaches every pond',
    async (role) => {
      const svc = makeService(role, []);
      await expect(svc.assertCanAccessPond(ACTOR, POND_IN, 'READ')).resolves.toBeDefined();
      await expect(svc.assertCanAccessPond(ACTOR, POND_OUT, 'READ')).resolves.toBeDefined();
    },
  );
});

describe('a scoped worker is restricted to their ponds', () => {
  it('reaches a pond in scope', async () => {
    const svc = makeService('worker', [POND_IN]);
    await expect(svc.assertCanAccessPond(ACTOR, POND_IN, 'READ')).resolves.toBeDefined();
  });

  it('is refused a pond on the same farm that is out of scope', async () => {
    const svc = makeService('worker', [POND_IN]);
    await expect(
      svc.assertCanAccessPond(ACTOR, POND_OUT, 'READ'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('is refused a WRITE on an out-of-scope pond too, not just reads', async () => {
    const svc = makeService('worker', [POND_IN]);
    await expect(
      svc.assertCanAccessPond(ACTOR, POND_OUT, 'WRITE_OPERATIONAL'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lists only their ponds, so farm totals count what they are responsible for', async () => {
    const svc = makeService('worker', [POND_IN]);
    await expect(svc.getAccessiblePondIds(ACTOR, FARM)).resolves.toEqual([POND_IN]);
  });
});

describe('a scoped viewer is restricted the same way', () => {
  it('is refused an out-of-scope pond', async () => {
    const svc = makeService('viewer', [POND_IN]);
    await expect(
      svc.assertCanAccessPond(ACTOR, POND_OUT, 'READ'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('owners and managers are never scoped', () => {
  it.each(['owner', 'manager'] as FarmRole[])(
    '%s reaches an out-of-scope pond even with rows present',
    async (role) => {
      // Rows exist for this membership, and are deliberately ignored: a half-
      // applied restriction on someone responsible for the whole farm would be
      // worse than not offering scoping at all.
      const svc = makeService(role, [POND_IN]);
      await expect(
        svc.assertCanAccessPond(ACTOR, POND_OUT, 'READ'),
      ).resolves.toBeDefined();
    },
  );

  it('manager sees every pond in the accessible list', async () => {
    const svc = makeService('manager', [POND_IN]);
    await expect(svc.getAccessiblePondIds(ACTOR, FARM)).resolves.toEqual([
      POND_IN,
      POND_OUT,
    ]);
  });
});

describe('scoping narrows, it never widens', () => {
  it('a viewer scoped to a pond still cannot write to it', async () => {
    const svc = makeService('viewer', [POND_IN]);
    await expect(
      svc.assertCanAccessPond(ACTOR, POND_IN, 'WRITE_OPERATIONAL'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('a worker scoped to a pond still cannot start a cycle on it', async () => {
    const svc = makeService('worker', [POND_IN]);
    await expect(
      svc.assertCanAccessPond(ACTOR, POND_IN, 'WRITE_MANAGEMENT'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getAccessiblePondIds returns nothing at a capability the role lacks', async () => {
    const svc = makeService('worker', []);
    await expect(
      svc.getAccessiblePondIds(ACTOR, FARM, 'VIEW_FINANCIALS'),
    ).resolves.toEqual([]);
  });
});

describe('deploy-before-migrate', () => {
  it('applies no scoping when farm_member_ponds is missing', async () => {
    const svc = makeService('worker', []);
    const err: any = new Error('relation "farm_member_ponds" does not exist');
    err.code = '42P01';
    (svc as any).memberPondsRepo.createQueryBuilder = () => ({
      innerJoin() {
        return this;
      },
      select() {
        return this;
      },
      getRawMany: async () => {
        throw err;
      },
    });

    // Pre-feature behaviour: everyone reaches every pond on their farm.
    await expect(svc.assertCanAccessPond(ACTOR, POND_OUT, 'READ')).resolves.toBeDefined();
  });
});

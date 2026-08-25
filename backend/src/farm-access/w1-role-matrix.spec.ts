/**
 * W1 acceptance matrix, exercised through the REAL authorization chain:
 *
 *   PondsService.findOneAccessible / verifyAccess
 *     -> FarmsService.verifyAccess
 *       -> FarmAccessService.assertCanAccessFarm
 *         -> getRoleOnFarm + roleSatisfies
 *
 * Only the three repositories at the bottom are stubbed, so this covers the
 * owner fast-path in `findOneAccessible`, the membership lookup, the owner
 * fallback in `getRoleOnFarm`, and the capability matrix together.
 *
 * Before W1, every operation below went through the OWNER-ONLY
 * `pondsService.findOne`, so a manager was 403'd on all of them. The plan's
 * acceptance criteria are encoded here as a table: each W1 operation, the
 * capability it now asserts, and which roles must pass.
 */
import { ForbiddenException } from '@nestjs/common';
import { FarmAccessService } from './farm-access.service';
import { FarmCapability } from './farm-capability';
import { FarmRole } from './farm-member.entity';
import { FarmsService } from '../farms/farms.service';
import { PondsService } from '../ponds/ponds.service';

/**
 * farm_member_ponds stub with no rows. Pond scoping (W4) landed after this
 * spec was written; no rows means "all ponds", so the role matrix below is
 * unaffected and keeps testing exactly what it was written to test.
 */
const noPondScope = () => ({
  find: jest.fn().mockResolvedValue([]),
  delete: jest.fn(),
  insert: jest.fn(),
  createQueryBuilder: () => ({
    innerJoin() { return this; },
    select() { return this; },
    getRawMany: async () => [],
  }),
});

const FARM = 'farm-1';
const POND = 'pond-1';
const OWNER = 'user-owner';
const ACTOR = 'user-actor';

/**
 * Build the real service chain with stub repositories, for a user holding
 * `role` on the farm. `role: null` means "not a member at all".
 */
function chainFor(role: FarmRole | null) {
  const membersRepo = {
    findOne: jest.fn().mockResolvedValue(role ? { farmId: FARM, userId: ACTOR, role } : null),
    find: jest.fn().mockResolvedValue([]),
  };
  const farmsRepo = {
    // The farm is owned by someone else, so the owner fallback in
    // getRoleOnFarm cannot rescue a non-member — the membership row decides.
    findOne: jest.fn().mockResolvedValue({ id: FARM, userId: OWNER }),
    find: jest.fn().mockResolvedValue([{ id: FARM }]),
  };
  const pondsRepo = {
    findOne: jest.fn().mockResolvedValue({ id: POND, farmId: FARM }),
  };

  const farmAccess = new FarmAccessService(
    membersRepo as any,
    farmsRepo as any,
    pondsRepo as any,
    noPondScope() as any,
  );
  const farmsService = new FarmsService(farmsRepo as any, farmAccess);

  // PondsService only needs its own repo + FarmsService for this path.
  const pondsService = Object.create(PondsService.prototype) as PondsService;
  Object.assign(pondsService, {
    pondsRepository: {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: POND, farmId: FARM, farm: { userId: OWNER } }),
    },
    farmsService,
  });

  return pondsService;
}

/** Each W1 operation, the capability it now asserts, and the roles that pass. */
const OPERATIONS: Array<{
  operation: string;
  capability: FarmCapability;
  allowed: FarmRole[];
}> = [
  { operation: 'view pond context / dashboard', capability: 'READ', allowed: ['owner', 'manager', 'worker', 'viewer'] },
  { operation: 'read feed plans', capability: 'READ', allowed: ['owner', 'manager', 'worker', 'viewer'] },
  { operation: 'read disease warnings', capability: 'READ', allowed: ['owner', 'manager', 'worker', 'viewer'] },
  { operation: 'record a measurement', capability: 'WRITE_OPERATIONAL', allowed: ['owner', 'manager', 'worker'] },
  { operation: 'record actual feed kg', capability: 'WRITE_OPERATIONAL', allowed: ['owner', 'manager', 'worker'] },
  { operation: 'persist a disease snapshot', capability: 'WRITE_OPERATIONAL', allowed: ['owner', 'manager', 'worker'] },
  { operation: 'start a cycle', capability: 'WRITE_MANAGEMENT', allowed: ['owner', 'manager'] },
  { operation: 'close / harvest a cycle', capability: 'WRITE_MANAGEMENT', allowed: ['owner', 'manager'] },
  { operation: 'generate and persist a feed plan', capability: 'WRITE_MANAGEMENT', allowed: ['owner', 'manager'] },
  { operation: 'view cycle analysis / economics', capability: 'VIEW_FINANCIALS', allowed: ['owner', 'manager'] },
  { operation: 'delete a cycle', capability: 'OWNER_ONLY', allowed: ['owner'] },
];

const ALL_ROLES: FarmRole[] = ['owner', 'manager', 'worker', 'viewer'];

describe('W1 — role matrix through the real access chain', () => {
  for (const { operation, capability, allowed } of OPERATIONS) {
    describe(`${operation} (${capability})`, () => {
      for (const role of ALL_ROLES) {
        const shouldPass = allowed.includes(role);

        it(`${role} is ${shouldPass ? 'allowed' : 'denied'}`, async () => {
          const ponds = chainFor(role);
          const call = ponds.findOneAccessible(POND, ACTOR, capability);

          if (shouldPass) {
            await expect(call).resolves.toMatchObject({ id: POND });
          } else {
            await expect(call).rejects.toBeInstanceOf(ForbiddenException);
          }
        });
      }

      it('a non-member is denied', async () => {
        const ponds = chainFor(null);
        await expect(
          ponds.findOneAccessible(POND, ACTOR, capability),
        ).rejects.toBeInstanceOf(ForbiddenException);
      });
    });
  }

  it('the farm owner short-circuits every capability without a membership row', async () => {
    const membersRepo = { findOne: jest.fn().mockResolvedValue(null), find: jest.fn().mockResolvedValue([]) };
    const farmsRepo = {
      findOne: jest.fn().mockResolvedValue({ id: FARM, userId: OWNER }),
      find: jest.fn().mockResolvedValue([{ id: FARM }]),
    };
    const pondsRepo = { findOne: jest.fn().mockResolvedValue({ id: POND, farmId: FARM }) };
    const farmAccess = new FarmAccessService(membersRepo as any, farmsRepo as any, pondsRepo as any, noPondScope() as any);

    for (const { capability } of OPERATIONS) {
      await expect(
        farmAccess.assertCanAccessFarm(OWNER, FARM, capability),
      ).resolves.toBeDefined();
    }
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FarmAccessService } from './farm-access.service';
import { FarmMember } from './farm-member.entity';
import { FarmMemberPond } from './farm-member-pond.entity';
import { Farm } from '../farms/farm.entity';
import { Pond } from '../ponds/pond.entity';

describe('FarmAccessService', () => {
  let service: FarmAccessService;
  let membersRepo: any;
  let farmsRepo: any;
  let pondsRepo: any;
  let memberPondsRepo: any;

  const OWNER = 'owner-1';
  const WORKER = 'worker-1';
  const STRANGER = 'stranger-1';
  const FARM = 'farm-1';

  beforeEach(async () => {
    membersRepo = { findOne: jest.fn(), find: jest.fn() };
    farmsRepo = { findOne: jest.fn(), find: jest.fn() };
    pondsRepo = { findOne: jest.fn(), find: jest.fn().mockResolvedValue([]) };
    // No pond-scope rows: every member reaches the whole farm, which is the
    // default and what these role/status tests are about.
    memberPondsRepo = {
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
      insert: jest.fn(),
      createQueryBuilder: () => ({
        innerJoin() { return this; },
        select() { return this; },
        getRawMany: async () => [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FarmAccessService,
        { provide: getRepositoryToken(FarmMember), useValue: membersRepo },
        { provide: getRepositoryToken(Farm), useValue: farmsRepo },
        { provide: getRepositoryToken(Pond), useValue: pondsRepo },
        { provide: getRepositoryToken(FarmMemberPond), useValue: memberPondsRepo },
      ],
    }).compile();

    service = module.get(FarmAccessService);
  });

  describe('getRoleOnFarm', () => {
    it('returns the membership role when a row exists', async () => {
      membersRepo.findOne.mockResolvedValue({ role: 'worker' });
      expect(await service.getRoleOnFarm(WORKER, FARM)).toBe('worker');
    });

    it('falls back to owner when the legacy farm.userId matches', async () => {
      membersRepo.findOne.mockResolvedValue(null);
      farmsRepo.findOne.mockResolvedValue({ id: FARM, userId: OWNER });
      expect(await service.getRoleOnFarm(OWNER, FARM)).toBe('owner');
    });

    it('returns null for a non-member', async () => {
      membersRepo.findOne.mockResolvedValue(null);
      farmsRepo.findOne.mockResolvedValue({ id: FARM, userId: OWNER });
      expect(await service.getRoleOnFarm(STRANGER, FARM)).toBeNull();
    });

    it('degrades to owner-only when farm_members is missing (42P01)', async () => {
      // Simulate the migration not being run yet.
      membersRepo.findOne.mockRejectedValue({ code: '42P01' });
      farmsRepo.findOne.mockResolvedValue({ id: FARM, userId: OWNER });
      expect(await service.getRoleOnFarm(OWNER, FARM)).toBe('owner'); // owner still works
      expect(await service.getRoleOnFarm(STRANGER, FARM)).toBeNull(); // non-owner denied
    });

    it('re-throws non-missing-table errors', async () => {
      membersRepo.findOne.mockRejectedValue({ code: '08006' }); // connection failure
      await expect(service.getRoleOnFarm(OWNER, FARM)).rejects.toBeDefined();
    });
  });

  describe('getAccessibleFarmIds', () => {
    it('lists owned farms when farm_members is missing (42P01)', async () => {
      membersRepo.find.mockRejectedValue({ code: '42P01' });
      farmsRepo.find
        .mockResolvedValueOnce([{ id: FARM }]) // owned
        .mockResolvedValueOnce([{ id: FARM }]); // live
      expect(await service.getAccessibleFarmIds(OWNER)).toEqual([FARM]);
    });

    it('scopes the soft-delete check to the caller own farms, not every farm in the database', async () => {
      // PERF: this used to select EVERY live farm to filter a handful. The
      // method fires on every list endpoint call (harvests, sampling, ponds,
      // reports), so its cost grew with total farms across all tenants rather
      // than with the caller's own — it got slower for everyone each time
      // anyone signed up.
      membersRepo.find.mockResolvedValue([{ farmId: FARM }]);
      farmsRepo.find
        .mockResolvedValueOnce([]) // owned
        .mockResolvedValueOnce([{ id: FARM }]); // live, scoped

      await service.getAccessibleFarmIds(WORKER);

      const liveQuery = farmsRepo.find.mock.calls[1][0];
      expect(liveQuery.where).toHaveProperty('id');
      expect(liveQuery.where).toHaveProperty('deletedAt');
    });
  });

  describe('getFarmIdsWithCapability (AUDIT id 142 — batched, not N+1)', () => {
    const FARM_2 = 'farm-2';

    it('resolves roles from a single membership query, plus one farms query', async () => {
      membersRepo.find
        .mockResolvedValueOnce([{ farmId: FARM }, { farmId: FARM_2 }]) // getAccessibleFarmIds
        .mockResolvedValueOnce([{ farmId: FARM, role: 'worker' }]); // batched role lookup
      farmsRepo.find
        .mockResolvedValueOnce([]) // owned (getAccessibleFarmIds)
        .mockResolvedValueOnce([{ id: FARM }, { id: FARM_2 }]) // live (getAccessibleFarmIds)
        // One query for the role policies AND the owner fallback: FARM_2 has no
        // membership row but the legacy owner column names the caller.
        .mockResolvedValueOnce([
          { id: FARM, userId: OWNER, rolePolicy: null },
          { id: FARM_2, userId: WORKER, rolePolicy: null },
        ]);

      const allowed = await service.getFarmIdsWithCapability(
        WORKER,
        'WRITE_OPERATIONAL',
      );

      expect(allowed.sort()).toEqual([FARM, FARM_2].sort());
      // Exactly one batched find() for roles, not one getRoleOnFarm() per farm.
      expect(membersRepo.find).toHaveBeenCalledTimes(2);
      expect(membersRepo.findOne).not.toHaveBeenCalled();
    });

    it('returns [] without querying roles when the user has no accessible farms', async () => {
      membersRepo.find.mockResolvedValueOnce([]);
      farmsRepo.find.mockResolvedValueOnce([]); // owned only — getAccessibleFarmIds short-circuits

      expect(
        await service.getFarmIdsWithCapability(STRANGER, 'READ'),
      ).toEqual([]);
      expect(membersRepo.find).toHaveBeenCalledTimes(1);
    });
  });

  describe('assertCanAccessFarm', () => {
    beforeEach(() => {
      farmsRepo.findOne.mockResolvedValue({
        id: FARM,
        userId: OWNER,
        deletedAt: null,
      });
    });

    it('allows a worker to WRITE_OPERATIONAL', async () => {
      membersRepo.findOne.mockResolvedValue({ role: 'worker' });
      await expect(
        service.assertCanAccessFarm(WORKER, FARM, 'WRITE_OPERATIONAL'),
      ).resolves.toBeDefined();
    });

    it('denies a worker OWNER_ONLY', async () => {
      membersRepo.findOne.mockResolvedValue({ role: 'worker' });
      await expect(
        service.assertCanAccessFarm(WORKER, FARM, 'OWNER_ONLY'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows the owner OWNER_ONLY', async () => {
      membersRepo.findOne.mockResolvedValue({ role: 'owner' });
      await expect(
        service.assertCanAccessFarm(OWNER, FARM, 'OWNER_ONLY'),
      ).resolves.toBeDefined();
    });

    it('denies a stranger any capability', async () => {
      membersRepo.findOne.mockResolvedValue(null);
      await expect(
        service.assertCanAccessFarm(STRANGER, FARM, 'READ'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('treats a soft-deleted farm as not found', async () => {
      farmsRepo.findOne.mockResolvedValue({
        id: FARM,
        userId: OWNER,
        deletedAt: new Date(),
      });
      membersRepo.findOne.mockResolvedValue({ role: 'owner' });
      await expect(
        service.assertCanAccessFarm(OWNER, FARM, 'READ'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

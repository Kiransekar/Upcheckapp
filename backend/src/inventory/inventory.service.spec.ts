import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryItem } from './inventory-item.entity';
import { InventoryMovement } from './inventory-movement.entity';
import { FarmMember } from '../farm-access/farm-member.entity';
import { AlertsService } from '../alerts/alerts.service';
import { FarmAccessService } from '../farm-access/farm-access.service';
import { isLowStock } from './inventory.constants';

const FARM = { id: 'farm-1', userId: 'owner-1', rolePolicy: null } as any;

describe('InventoryService', () => {
  let service: InventoryService;
  let items: any;
  let members: any;
  let alerts: any;
  let farmAccess: any;
  let updateBuilder: any;
  let updateResult: any;
  let movementRepo: any;

  beforeEach(async () => {
    updateResult = { affected: 1 };
    updateBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      execute: jest.fn().mockImplementation(() => Promise.resolve(updateResult)),
      getMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0),
    };
    movementRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockResolvedValue([]),
    };
    items = {
      create: jest.fn((dto) => dto),
      save: jest.fn(async (e) => ({ id: 'item-1', ...e })),
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest
        .fn()
        .mockResolvedValue({ id: 'item-1', farmId: 'farm-1', quantity: 10 }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => updateBuilder),
    };
    members = { find: jest.fn().mockResolvedValue([]) };
    alerts = { createAutoAlert: jest.fn().mockResolvedValue(undefined) };
    farmAccess = {
      assertCanAccessFarm: jest.fn().mockResolvedValue(FARM),
      getFarmIdsWithCapability: jest.fn().mockResolvedValue(['farm-1']),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getRepositoryToken(InventoryItem), useValue: items },
        {
          provide: getRepositoryToken(InventoryMovement),
          useValue: movementRepo,
        },
        { provide: getRepositoryToken(FarmMember), useValue: members },
        { provide: AlertsService, useValue: alerts },
        { provide: FarmAccessService, useValue: farmAccess },
      ],
    }).compile();

    service = module.get(InventoryService);
  });

  const capabilityOf = (call: number) =>
    farmAccess.assertCanAccessFarm.mock.calls[call][2];

  describe('capability per verb', () => {
    it('create asserts MANAGE_INVENTORY', async () => {
      await service.create(
        { farmId: 'farm-1', name: 'Feed', category: 'feed' } as any,
        'u1',
      );
      expect(capabilityOf(0)).toBe('MANAGE_INVENTORY');
    });

    it('findAll(farmId) asserts VIEW_INVENTORY', async () => {
      await service.findAll('u1', 'farm-1');
      expect(capabilityOf(0)).toBe('VIEW_INVENTORY');
    });

    it('findOne asserts VIEW_INVENTORY', async () => {
      await service.findOne('item-1', 'u1');
      expect(capabilityOf(0)).toBe('VIEW_INVENTORY');
    });

    it.each([
      ['update', () => service.update('item-1', { name: 'x' } as any, 'u1')],
      ['remove', () => service.remove('item-1', 'u1')],
    ])('%s asserts MANAGE_INVENTORY', async (_name, run) => {
      await run();
      expect(capabilityOf(0)).toBe('MANAGE_INVENTORY');
    });

    it('adjust defaults to MANAGE_INVENTORY but honours WRITE_OPERATIONAL', async () => {
      await service.adjustStock('item-1', -1, 'u1');
      expect(capabilityOf(0)).toBe('MANAGE_INVENTORY');

      await service.adjustStock('item-1', -1, 'u1', {
        capability: 'WRITE_OPERATIONAL',
      });
      expect(capabilityOf(1)).toBe('WRITE_OPERATIONAL');
    });

    it('propagates the 403 instead of writing', async () => {
      farmAccess.assertCanAccessFarm.mockRejectedValueOnce(
        new ForbiddenException(),
      );
      await expect(service.remove('item-1', 'worker')).rejects.toThrow(
        ForbiddenException,
      );
      expect(items.delete).not.toHaveBeenCalled();
    });
  });

  describe('findAll without a farmId', () => {
    it('spans every farm the caller may view, not just owned ones (D7)', async () => {
      farmAccess.getFarmIdsWithCapability.mockResolvedValue(['f1', 'f2']);
      await service.findAll('member-1');
      expect(farmAccess.getFarmIdsWithCapability).toHaveBeenCalledWith(
        'member-1',
        'VIEW_INVENTORY',
      );
      const { where } = items.find.mock.calls[0][0];
      expect(where.farmId._value).toEqual(['f1', 'f2']);
    });

    it('returns [] when the caller may view no farm', async () => {
      farmAccess.getFarmIdsWithCapability.mockResolvedValue([]);
      expect(await service.findAll('nobody')).toEqual([]);
      expect(items.find).not.toHaveBeenCalled();
    });
  });

  describe('negative quantities', () => {
    it('rejects a delta that would drive stock below zero', async () => {
      items.findOneBy.mockResolvedValue({
        id: 'item-1',
        farmId: 'farm-1',
        quantity: 5,
      });
      await expect(service.adjustStock('item-1', -6, 'u1')).rejects.toThrow(
        BadRequestException,
      );
      expect(updateBuilder.execute).not.toHaveBeenCalled();
    });

    it('rejects when a concurrent write already consumed the stock', async () => {
      updateBuilder.execute.mockResolvedValue({ affected: 0 });
      await expect(service.adjustStock('item-1', -1, 'u1')).rejects.toThrow(
        /Insufficient stock/,
      );
    });
  });

  it('rejects an item from another farm (feed-log cross-farm guard)', async () => {
    items.findOneBy.mockResolvedValue({
      id: 'item-1',
      farmId: 'other-farm',
      quantity: 100,
    });
    await expect(
      service.adjustStock('item-1', -1, 'u1', {
        capability: 'WRITE_OPERATIONAL',
        expectedFarmId: 'farm-1',
      }),
    ).rejects.toThrow('different farm');
    expect(updateBuilder.execute).not.toHaveBeenCalled();
  });

  it('persists the adjustment reason (D2)', async () => {
    await service.adjustStock('item-1', -1, 'u1', { reason: 'spillage' });
    expect(updateBuilder.set).toHaveBeenCalledWith(
      expect.objectContaining({ lastAdjustmentReason: 'spillage' }),
    );
  });

  describe('low stock', () => {
    it('treats a null reorder level as zero, like the client does (D1)', () => {
      expect(isLowStock({ quantity: 0, reorderLevel: null })).toBe(true);
      expect(isLowStock({ quantity: 1, reorderLevel: null })).toBe(false);
      expect(isLowStock({ quantity: '5', reorderLevel: '5' })).toBe(true);
    });

    it('alerts everyone who can reorder, not just the owner (D10)', async () => {
      items.findOneBy.mockResolvedValue({
        id: 'item-1',
        farmId: 'farm-1',
        name: 'Feed',
        quantity: 2,
        reorderLevel: 5,
        unit: 'kg',
      });
      members.find.mockResolvedValue([
        { userId: 'manager-1', role: 'manager', capabilityOverrides: null },
        { userId: 'worker-1', role: 'worker', capabilityOverrides: null },
        { userId: 'viewer-1', role: 'viewer', capabilityOverrides: null },
        {
          userId: 'granted-1',
          role: 'worker',
          capabilityOverrides: { MANAGE_INVENTORY: true },
        },
      ]);

      await service.adjustStock('item-1', -1, 'u1');

      // "Running low" is a call to reorder, so it goes to the people who can:
      // owner, manager, and any member the owner granted MANAGE_INVENTORY.
      // A viewer or a plain worker gets a notification they cannot act on.
      const notified = alerts.createAutoAlert.mock.calls.map(
        (c: any[]) => c[0],
      );
      expect(notified.sort()).toEqual(['granted-1', 'manager-1', 'owner-1']);
    });
  });

  describe('adjustStock movement ledger', () => {
    it('writes a movement row carrying the delta, reason and actor', async () => {
      await service.adjustStock('item-1', -5, 'user-1', {
        capability: 'MANAGE_INVENTORY',
        reason: 'Feed log',
      });
      expect(movementRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          inventoryId: 'item-1',
          delta: -5,
          reason: 'Feed log',
          createdById: 'user-1',
        }),
      );
    });

    it('writes no movement when the negative-stock guard rejects the update', async () => {
      // The UPDATE is what enforces `quantity + delta >= 0`. A movement written
      // when affected === 0 would record a change that did not happen.
      updateResult.affected = 0;
      await expect(
        service.adjustStock('item-1', -999, 'user-1', {
          capability: 'MANAGE_INVENTORY',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(movementRepo.save).not.toHaveBeenCalled();
    });

    it('links a feed-driven movement back to its feed record', async () => {
      await service.adjustStock('item-1', -2, 'user-1', {
        capability: 'WRITE_OPERATIONAL',
        reason: 'Feed log',
        feedRecordId: 'feed-9',
      });
      expect(movementRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ feedRecordId: 'feed-9' }),
      );
    });
  });
});

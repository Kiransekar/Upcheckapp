import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryItem } from './inventory-item.entity';
import { InventoryMovement } from './inventory-movement.entity';
import { InventoryFarm } from './inventory-farm.entity';
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
  let pairingRepo: any;
  let dataSource: any;

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
    // Empty by default: farmsFor() then falls back to item.farmId, matching
    // every pre-existing test's single-farm expectations.
    pairingRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockResolvedValue([]),
    };
    dataSource = {
      transaction: jest.fn((cb: any) =>
        cb({ delete: jest.fn(), insert: jest.fn(), update: jest.fn() }),
      ),
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
        { provide: getRepositoryToken(InventoryFarm), useValue: pairingRepo },
        { provide: DataSource, useValue: dataSource },
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
      pairingRepo.find.mockResolvedValue([
        { inventoryId: 'item-a', farmId: 'f1' },
        { inventoryId: 'item-b', farmId: 'f2' },
      ]);
      await service.findAll('member-1');
      expect(farmAccess.getFarmIdsWithCapability).toHaveBeenCalledWith(
        'member-1',
        'VIEW_INVENTORY',
      );
      expect(pairingRepo.find).toHaveBeenCalledWith({
        where: { farmId: expect.objectContaining({ _value: ['f1', 'f2'] }) },
      });
      const { where } = items.find.mock.calls[0][0];
      expect(where.id._value.sort()).toEqual(['item-a', 'item-b']);
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
      expect(movementRepo.save).not.toHaveBeenCalled();
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
      // -1 against the mocked quantity of 10 clears the earlier JS-level
      // pre-check, so this actually reaches the atomic UPDATE — the real
      // race-safe path that enforces `quantity + delta >= 0`. A movement
      // written when affected === 0 would record a change that did not happen.
      updateResult.affected = 0;
      await expect(
        service.adjustStock('item-1', -1, 'user-1', {
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

  describe('inventory pairing', () => {
    it('lists an item for every farm it is paired to', async () => {
      pairingRepo.find.mockResolvedValue([
        { inventoryId: 'i1', farmId: 'f1' },
        { inventoryId: 'i1', farmId: 'f2' },
      ]);
      items.find.mockResolvedValue([{ id: 'i1', farmId: 'f1' }]);
      const result = await service.findAll('user-1', 'f2');
      expect(result.map((i: any) => i.id)).toContain('i1');
    });

    it('reads an item when the caller has VIEW_INVENTORY on any paired farm', async () => {
      // One farm is enough to look; see the write rule below for the contrast.
      pairingRepo.find.mockResolvedValue([
        { inventoryId: 'i1', farmId: 'f1' },
        { inventoryId: 'i1', farmId: 'f2' },
      ]);
      items.findOneBy.mockResolvedValue({ id: 'i1', farmId: 'f1', quantity: 10 });
      farmAccess.assertCanAccessFarm
        .mockRejectedValueOnce(new ForbiddenException())
        .mockResolvedValueOnce(FARM);
      await expect(service.findOne('i1', 'user-1')).resolves.toBeDefined();
    });

    it('refuses a write unless the caller can manage EVERY paired farm', async () => {
      // Otherwise rights on one farm let a user edit stock another farm depends on.
      pairingRepo.find.mockResolvedValue([
        { inventoryId: 'i1', farmId: 'f1' },
        { inventoryId: 'i1', farmId: 'f2' },
      ]);
      items.findOneBy.mockResolvedValue({ id: 'i1', farmId: 'f1' });
      farmAccess.assertCanAccessFarm
        .mockResolvedValueOnce(FARM)
        .mockRejectedValueOnce(new ForbiddenException());
      await expect(
        service.update('i1', { name: 'x' } as any, 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows an unpaired item and does not surface it under any farm', async () => {
      pairingRepo.find.mockResolvedValue([]);
      const result = await service.findAll('user-1', 'f1');
      expect(result).toEqual([]);
    });

    // Coordinator fix 1 (security): a zero-farm item must fail CLOSED on
    // direct-id access, not open. Before the fix, assertPaired returned
    // early with no capability check at all — this is the regression test
    // that proves the hole and then proves it is closed.
    it('fails closed on a direct-id read of an item with no farm anywhere', async () => {
      pairingRepo.find.mockResolvedValue([]); // no join rows
      items.findOneBy.mockResolvedValue({ id: 'i1', farmId: null, quantity: 10 }); // no legacy farm_id either
      await expect(service.findOne('i1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
      // Not "checked and denied" — genuinely never gated, which is the bug:
      // there is no farm to check access against, so nothing was called.
      expect(farmAccess.assertCanAccessFarm).not.toHaveBeenCalled();
    });

    it('fails closed on a direct-id write of an item with no farm anywhere', async () => {
      pairingRepo.find.mockResolvedValue([]);
      items.findOneBy.mockResolvedValue({ id: 'i1', farmId: null, quantity: 10 });
      await expect(
        service.update('i1', { name: 'x' } as any, 'user-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(items.update).not.toHaveBeenCalled();
    });

    it('refuses to create an item paired to zero farms', async () => {
      await expect(
        service.create({ name: 'x', category: 'feed' } as any, 'u1'),
      ).rejects.toThrow(BadRequestException);
      expect(items.save).not.toHaveBeenCalled();
    });

    it('refuses to leave an item paired to zero farms via setPairing', async () => {
      await expect(service.setPairing('i1', [], 'u1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

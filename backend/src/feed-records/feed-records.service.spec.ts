import { ConfigService } from '@nestjs/config';

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeedRecordsService } from './feed-records.service';
import { FeedRecord } from './feed-record.entity';
import { PondsService } from '../ponds/ponds.service';
import { InventoryService } from '../inventory/inventory.service';
import { FarmAccessService } from '../farm-access/farm-access.service';

// Mock repository factory
const createMockRepository = () => ({
  create: jest.fn().mockImplementation((dto) => dto),
  save: jest
    .fn()
    .mockImplementation((entity) =>
      Promise.resolve({ ...entity, id: 'test-id' }),
    ),
  find: jest.fn().mockResolvedValue([]),
  findAndCount: jest.fn().mockResolvedValue([[], 0]),
  findOneBy: jest.fn().mockResolvedValue(null),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
  createQueryBuilder: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ totalFeed: 100 }),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  })),
});

describe('FeedRecordsService', () => {
  let service: FeedRecordsService;
  let mockRepository: any;
  let module: TestingModule; // Correctly scoped module variable

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://dummy.com') },
        },
        FeedRecordsService,
        {
          provide: getRepositoryToken(FeedRecord),
          useValue: createMockRepository(),
        },
        {
          provide: PondsService,
          useValue: {
            findOne: jest.fn(),
            findOneAccessible: jest.fn(),
          },
        },
        {
          provide: InventoryService,
          useValue: {
            adjustStock: jest.fn(),
          },
        },
        {
          provide: FarmAccessService,
          useValue: {
            getAccessibleFarmIds: jest.fn().mockResolvedValue(['farm-1']),
            assertCanAccessPond: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<FeedRecordsService>(FeedRecordsService);
    mockRepository = module.get<Repository<FeedRecord>>(
      getRepositoryToken(FeedRecord),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new feed record', async () => {
      const createDto = {
        pondId: 'pond-1',
        feedType: 'Pellet Feed',
        feedBrand: 'Aquatic Nutrition',
        quantityKg: 50,
        feedingTime: '08:00',
        feedingMethod: 'Manual',
        waterTemperature: 28,
        notes: 'Morning feeding',
        inventoryItemId: 'inv-item-1', // Added this
      };

      // Mock PondsService to return a pond with activeCycleId
      const pondServiceMock = module.get<PondsService>(PondsService);
      jest.spyOn(pondServiceMock, 'findOneAccessible').mockResolvedValue({
        id: 'pond-1',
        activeCycleId: 'crop-1',
        userId: 'user-1',
        farmId: 'farm-1',
      } as any);

      // Mock InventoryService
      const inventoryServiceMock =
        module.get<InventoryService>(InventoryService);
      jest
        .spyOn(inventoryServiceMock, 'adjustStock')
        .mockResolvedValue({} as any);

      const result = await service.create(createDto, 'user-1');

      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createDto,
        cropId: 'crop-1',
        createdById: 'user-1',
        updatedById: 'user-1',
      });
      expect(mockRepository.save).toHaveBeenCalled();
      expect(inventoryServiceMock.adjustStock).toHaveBeenCalledWith(
        'inv-item-1',
        -50,
        'user-1',
        expect.objectContaining({
          capability: 'WRITE_OPERATIONAL',
          expectedFarmId: 'farm-1',
        }),
      ); // Verify deduction (scoped to caller AND to the pond's farm)
      expect(result).toEqual(expect.objectContaining(createDto));
    });

    it('refuses to deduct from an item on another farm', async () => {
      const pondServiceMock = module.get<PondsService>(PondsService);
      jest.spyOn(pondServiceMock, 'findOneAccessible').mockResolvedValue({
        id: 'pond-1',
        activeCycleId: 'crop-1',
        farmId: 'farm-1',
      } as any);

      const inventory = module.get<InventoryService>(InventoryService);
      // The cross-farm rejection lives in adjustStock (it is the only place
      // that has loaded the item); this asserts the feed log propagates it
      // rather than swallowing it and writing the record anyway.
      jest
        .spyOn(inventory, 'adjustStock')
        .mockRejectedValue(
          new Error('Inventory item belongs to a different farm'),
        );

      await expect(
        service.create(
          {
            pondId: 'pond-1',
            feedType: 'Pellet',
            quantityKg: 10,
            inventoryItemId: 'other-farm-item',
          } as any,
          'user-1',
        ),
      ).rejects.toThrow('different farm');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should not deduct stock if inventoryItemId is missing', async () => {
      const createDto = {
        pondId: 'pond-1',
        feedType: 'Manual Feed',
        quantityKg: 50,
      };

      const pondServiceMock = module.get<PondsService>(PondsService);
      jest
        .spyOn(pondServiceMock, 'findOneAccessible')
        .mockResolvedValue({ id: 'pond-1', activeCycleId: 'crop-1' } as any);

      const inventoryServiceMock =
        module.get<InventoryService>(InventoryService);

      await service.create(createDto as any, 'user-1');

      expect(inventoryServiceMock.adjustStock).not.toHaveBeenCalled();
    });

    it('persists a client-supplied recordedAt instead of sync time', async () => {
      const recordedAt = '2026-09-01T06:30:00.000Z';
      const pondServiceMock = module.get<PondsService>(PondsService);
      jest
        .spyOn(pondServiceMock, 'findOneAccessible')
        .mockResolvedValue({ id: 'pond-1', activeCycleId: 'crop-1' } as any);

      await service.create(
        { pondId: 'pond-1', feedType: 'Pellet', quantityKg: 10, recordedAt },
        'user-1',
      );

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ recordedAt: new Date(recordedAt) }),
      );
    });

    it('leaves recordedAt to the column default when the client omits it', async () => {
      const pondServiceMock = module.get<PondsService>(PondsService);
      jest
        .spyOn(pondServiceMock, 'findOneAccessible')
        .mockResolvedValue({ id: 'pond-1', activeCycleId: 'crop-1' } as any);

      await service.create(
        { pondId: 'pond-1', feedType: 'Pellet', quantityKg: 10 },
        'user-1',
      );

      expect(mockRepository.create.mock.calls[0][0].recordedAt).toBeUndefined();
    });

    it('does not re-stamp recordedAt on an idempotent replay', async () => {
      const existing = { id: 'client-uuid', pondId: 'pond-1' };
      mockRepository.findOne = jest.fn().mockResolvedValue(existing);

      const result = await service.create(
        {
          id: 'client-uuid',
          pondId: 'pond-1',
          feedType: 'Pellet',
          quantityKg: 10,
          recordedAt: '2026-09-01T06:30:00.000Z',
        },
        'user-1',
      );

      expect(result).toBe(existing);
      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all feed records accessible to the caller', async () => {
      const mockRecords = [{ id: '1', quantityKg: 50 }];
      const qb = mockRepository.createQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([mockRecords, 1]);
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll('user-1');

      expect(qb.getManyAndCount).toHaveBeenCalled();
      expect(result.data).toEqual(mockRecords);
    });

    it('should filter by pondId', async () => {
      const pondId = 'pond-1';
      const qb = mockRepository.createQueryBuilder();
      mockRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findAll('user-1', pondId);

      expect(qb.andWhere).toHaveBeenCalledWith('feed.pondId = :pondId', {
        pondId,
      });
    });

    it('should return no records when the caller has no accessible farms', async () => {
      const farmAccessMock = module.get<FarmAccessService>(FarmAccessService);
      jest
        .spyOn(farmAccessMock, 'getAccessibleFarmIds')
        .mockResolvedValueOnce([]);

      const result = await service.findAll('user-1');

      expect(result.data).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a feed record by id', async () => {
      const recordId = 'record-1';
      const mockRecord = { id: recordId, quantityKg: 50 };
      mockRepository.findOneBy.mockResolvedValue(mockRecord);

      const result = await service.findOne(recordId);

      expect(mockRepository.findOneBy).toHaveBeenCalledWith({ id: recordId });
      expect(result).toEqual(mockRecord);
    });
  });

  describe('update', () => {
    it('should update a feed record', async () => {
      const recordId = 'record-1';
      const updateDto = { quantityKg: 75 };
      const updatedRecord = { id: recordId, quantityKg: 75 };

      mockRepository.findOneBy.mockResolvedValue(updatedRecord);

      const result = await service.update(recordId, updateDto);

      expect(mockRepository.update).toHaveBeenCalledWith(recordId, updateDto);
      expect(mockRepository.findOneBy).toHaveBeenCalledWith({ id: recordId });
      expect(result).toEqual(updatedRecord);
    });

    it('rejects a fasting PATCH that still carries feed', async () => {
      mockRepository.findOneBy.mockResolvedValue({
        id: 'r1',
        quantityKg: 40,
      });
      await expect(
        service.update('r1', { isFasting: true, quantityKg: 5 } as any),
      ).rejects.toThrow('Fasting day');
    });

    it('reconciles inventory by the quantity delta on an edit', async () => {
      const inventory = module.get<InventoryService>(InventoryService);
      mockRepository.findOneBy.mockResolvedValue({
        id: 'r1',
        quantityKg: 50,
        inventoryItemId: 'inv-1',
      });
      // 50 → 30 frees 20 kg back into stock; isFasting is stripped (not a column).
      await service.update(
        'r1',
        { quantityKg: 30, isFasting: false } as any,
        'user-1',
      );
      expect(inventory.adjustStock).toHaveBeenCalledWith(
        'inv-1',
        20,
        'user-1',
        expect.objectContaining({ capability: 'WRITE_OPERATIONAL' }),
      );
      const [, patch] = mockRepository.update.mock.calls.at(-1);
      expect(patch).not.toHaveProperty('isFasting');
    });
  });

  describe('remove', () => {
    it('should remove a feed record', async () => {
      const recordId = 'record-1';
      const mockRecord = { id: recordId, quantityKg: 50 };
      mockRepository.findOneBy.mockResolvedValue(mockRecord);

      const result = await service.remove(recordId);

      expect(mockRepository.findOneBy).toHaveBeenCalledWith({ id: recordId });
      expect(mockRepository.delete).toHaveBeenCalledWith(recordId);
      expect(result).toEqual({ message: 'Feed record deleted successfully' });
    });
  });

  describe('getTotalFeedByPond', () => {
    it('should return total feed for a pond', async () => {
      const pondId = 'pond-1';
      const mockResult = { totalFeed: '150' };

      mockRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(mockResult),
      });

      const result = await service.getTotalFeedByPond(pondId);

      expect(result).toBe('150');
    });
  });
});

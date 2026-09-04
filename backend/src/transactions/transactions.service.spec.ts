import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { Transaction } from './transaction.entity';
import { FarmAccessService } from '../farm-access/farm-access.service';

const USER_ID = 'user-1';

// Mock repository factory
const createMockRepository = () => ({
  create: jest.fn().mockImplementation((dto) => dto),
  save: jest
    .fn()
    .mockImplementation((entity) =>
      Promise.resolve({ ...entity, id: 'test-id' }),
    ),
  find: jest.fn().mockResolvedValue([]),
  findOneBy: jest.fn().mockResolvedValue(null),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
  createQueryBuilder: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ total: 100 }),
    getMany: jest.fn().mockResolvedValue([]),
  })),
});

describe('TransactionsService', () => {
  let service: TransactionsService;
  let mockRepository: any;
  // Financials are gated by VIEW_FINANCIALS (owner/manager) via FarmAccessService.
  let mockFarmAccess: {
    assertCanAccessFarm: jest.Mock;
    getFarmIdsWithCapability: jest.Mock;
  };

  beforeEach(async () => {
    mockFarmAccess = {
      // Resolves => caller may view this farm's financials. Tests override to deny.
      assertCanAccessFarm: jest
        .fn()
        .mockResolvedValue({ id: 'farm-1', userId: USER_ID }),
      getFarmIdsWithCapability: jest.fn().mockResolvedValue(['farm-1']),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: createMockRepository(),
        },
        { provide: FarmAccessService, useValue: mockFarmAccess },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    mockRepository = module.get<Repository<Transaction>>(
      getRepositoryToken(Transaction),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates a transaction after a VIEW_FINANCIALS check', async () => {
      const createDto = {
        farmId: 'farm-1',
        transactionDate: new Date().toISOString(),
        type: 'income',
        category: 'harvest_sale',
        amount: 1000,
        description: 'Test transaction',
      };

      const result = await service.create(createDto as any, USER_ID);

      expect(mockFarmAccess.assertCanAccessFarm).toHaveBeenCalledWith(
        USER_ID,
        'farm-1',
        'VIEW_FINANCIALS',
      );
      // Money rows carry the actor who entered them.
      expect(mockRepository.create).toHaveBeenCalledWith({
        ...createDto,
        createdById: USER_ID,
        updatedById: USER_ID,
      });
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining(createDto));
      expect(result).toEqual(
        expect.objectContaining({ createdById: USER_ID }),
      );
    });

    it('is idempotent: a replayed client id returns the existing row without re-inserting', async () => {
      const existing = { id: 'client-uuid', farmId: 'farm-1', amount: 1000 };
      mockRepository.findOneBy.mockResolvedValueOnce(existing);

      const result = await service.create(
        { id: 'client-uuid', farmId: 'farm-1' } as any,
        USER_ID,
      );

      // Access to the found row's farm is checked before returning it.
      expect(mockFarmAccess.assertCanAccessFarm).toHaveBeenCalledWith(
        USER_ID,
        'farm-1',
        'VIEW_FINANCIALS',
      );
      expect(result).toBe(existing);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('scopes to farms where the caller may view financials', async () => {
      const mockTransactions = [{ id: '1', amount: 100 }];
      mockRepository.find.mockResolvedValue(mockTransactions);

      const result = await service.findAll(USER_ID);

      expect(mockFarmAccess.getFarmIdsWithCapability).toHaveBeenCalledWith(
        USER_ID,
        'VIEW_FINANCIALS',
      );
      expect(mockRepository.find).toHaveBeenCalled();
      expect(result).toEqual(mockTransactions);
    });

    it('filters by farmId after a VIEW_FINANCIALS check', async () => {
      const farmId = 'farm-1';
      await service.findAll(USER_ID, farmId);

      expect(mockFarmAccess.assertCanAccessFarm).toHaveBeenCalledWith(
        USER_ID,
        farmId,
        'VIEW_FINANCIALS',
      );
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { farmId },
        order: { transactionDate: 'DESC' },
      });
    });
  });

  describe('findOne', () => {
    it('returns a transaction after a VIEW_FINANCIALS check', async () => {
      const transactionId = 'trans-1';
      const mockTransaction = {
        id: transactionId,
        amount: 100,
        farmId: 'farm-1',
      };
      mockRepository.findOneBy.mockResolvedValue(mockTransaction);

      const result = await service.findOne(transactionId, USER_ID);

      expect(mockRepository.findOneBy).toHaveBeenCalledWith({
        id: transactionId,
      });
      expect(mockFarmAccess.assertCanAccessFarm).toHaveBeenCalledWith(
        USER_ID,
        'farm-1',
        'VIEW_FINANCIALS',
      );
      expect(result).toEqual(mockTransaction);
    });

    it('blocks IDOR: a caller without farm financial access is rejected', async () => {
      // Attacker references another farm's transaction id directly.
      mockRepository.findOneBy.mockResolvedValue({
        id: 'victim-tx',
        amount: 999,
        farmId: 'other-farm',
      });
      mockFarmAccess.assertCanAccessFarm.mockRejectedValue(
        new Error('Forbidden'),
      );

      await expect(
        service.findOne('victim-tx', 'attacker-user'),
      ).rejects.toBeDefined();
      expect(mockFarmAccess.assertCanAccessFarm).toHaveBeenCalledWith(
        'attacker-user',
        'other-farm',
        'VIEW_FINANCIALS',
      );
    });
  });

  describe('update', () => {
    it('updates a transaction the caller may manage', async () => {
      const transactionId = 'trans-1';
      const updateDto = { amount: 200 };
      const updatedTransaction = {
        id: transactionId,
        amount: 200,
        farmId: 'farm-1',
      };

      mockRepository.findOneBy.mockResolvedValue(updatedTransaction);

      const result = await service.update(
        transactionId,
        updateDto as any,
        USER_ID,
      );

      // The editor is stamped on every money edit.
      expect(mockRepository.update).toHaveBeenCalledWith(transactionId, {
        ...updateDto,
        updatedById: USER_ID,
      });
      expect(result).toEqual(updatedTransaction);
    });

    it('never lets a client-supplied id reassign the primary key', async () => {
      mockRepository.findOneBy.mockResolvedValue({
        id: 'trans-1',
        farmId: 'farm-1',
      });

      await service.update(
        'trans-1',
        { id: 'other-id', amount: 5 } as any,
        USER_ID,
      );

      expect(mockRepository.update).toHaveBeenCalledWith('trans-1', {
        amount: 5,
        updatedById: USER_ID,
      });
    });
  });

  describe('remove', () => {
    it('removes a transaction the caller may manage', async () => {
      const transactionId = 'trans-1';
      mockRepository.findOneBy.mockResolvedValue({
        id: transactionId,
        farmId: 'farm-1',
      });

      const result = await service.remove(transactionId, USER_ID);

      expect(mockRepository.delete).toHaveBeenCalledWith(transactionId);
      expect(result).toEqual({ affected: 1 });
    });
  });

  it('refuses to edit or delete a transaction on read-only financial access', async () => {
    // VIEW_FINANCIALS is the capability for SEEING the money. Rewriting or
    // erasing it is a write, and was running on the same key.
    mockRepository.findOneBy.mockResolvedValue({
      id: 't1',
      farmId: 'farm-1',
    });
    mockFarmAccess.assertCanAccessFarm.mockRejectedValue(
      new ForbiddenException(),
    );
    await expect(
      service.update('t1', { amount: 1 } as any, 'user-1'),
    ).rejects.toThrow(ForbiddenException);
    await expect(service.remove('t1', 'user-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(mockFarmAccess.assertCanAccessFarm).toHaveBeenCalledWith(
      'user-1',
      expect.any(String),
      'WRITE_MANAGEMENT',
    );
  });

  describe('getSummaryByFarm', () => {
    it('returns a summary after a VIEW_FINANCIALS check', async () => {
      const farmId = 'farm-1';
      const mockIncome = { total: '1500' };
      const mockExpense = { total: '800' };

      mockRepository.createQueryBuilder
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue(mockIncome),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue(mockExpense),
        });

      const result = await service.getSummaryByFarm(farmId, USER_ID);

      expect(mockFarmAccess.assertCanAccessFarm).toHaveBeenCalledWith(
        USER_ID,
        farmId,
        'VIEW_FINANCIALS',
      );
      expect(result).toEqual({
        totalIncome: 1500,
        totalExpense: 800,
        netProfit: 700,
      });
    });
  });
});

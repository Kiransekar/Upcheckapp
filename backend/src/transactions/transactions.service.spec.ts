import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { Transaction } from './transaction.entity';
import { Pond } from '../ponds/pond.entity';
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
  let mockPondsRepository: any;
  /** The ponds that exist, for both the row lookup and the scoping check. */
  let pondRows: any[];
  // Financials are gated by VIEW_FINANCIALS (owner/manager) via FarmAccessService.
  let module: TestingModule;
  let mockFarmAccess: {
    assertCanAccessFarm: jest.Mock;
    getFarmIdsWithCapability: jest.Mock;
    getAccessiblePondIds: jest.Mock;
  };

  beforeEach(async () => {
    pondRows = [];
    mockFarmAccess = {
      // Resolves => caller may view this farm's financials. Tests override to deny.
      assertCanAccessFarm: jest
        .fn()
        .mockResolvedValue({ id: 'farm-1', userId: USER_ID }),
      getFarmIdsWithCapability: jest.fn().mockResolvedValue(['farm-1']),
      // Unscoped caller — every pond the ponds repo knows about, which is what
      // the real service hands back for an owner or manager. The pond-scoping
      // suite at the bottom of this file plays the scoped case.
      getAccessiblePondIds: jest.fn(async () => pondRows.map((p) => p.id)),
    };

    module = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: createMockRepository(),
        },
        {
          // Ponds are read only to prove an optionally-named pond belongs to
          // the farm the caller was authorized for. Defaults to "the pond is
          // in farm-1", so a test that names one is not fighting this.
          provide: getRepositoryToken(Pond),
          useValue: {
            findOne: jest
              .fn()
              .mockResolvedValue({ id: 'pond-1', farmId: 'farm-1' }),
            // `findAll` looks the named ponds up in one go, to read `status`
            // for the archived flag and the name for the row label.
            find: jest.fn(async () => pondRows),
          },
        },
        { provide: FarmAccessService, useValue: mockFarmAccess },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    mockRepository = module.get<Repository<Transaction>>(
      getRepositoryToken(Transaction),
    );
    mockPondsRepository = module.get(getRepositoryToken(Pond));
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

    /**
     * A money row may now name the pond it belongs to, which means the id has
     * to be checked. Being authorized for a FARM does not authorize an
     * arbitrary pond id: without this, a farmer could pass their own farmId
     * with another tenant's pondId and attach money to a pond in a farm they
     * cannot see. Same rule ExpensesService.create applies to cropId.
     */
    it('refuses a pond that belongs to another farm', async () => {
      const pondsRepo = module.get(getRepositoryToken(Pond));
      pondsRepo.findOne.mockResolvedValue({
        id: 'pond-x',
        farmId: 'someone-elses-farm',
      });

      await expect(
        service.create(
          {
            farmId: 'farm-1',
            transactionDate: new Date().toISOString(),
            type: 'expense',
            category: 'Feed',
            amount: 1000,
            pondId: 'pond-x',
          } as any,
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('attributes the money when the pond really is in that farm', async () => {
      const result = await service.create(
        {
          farmId: 'farm-1',
          transactionDate: new Date().toISOString(),
          type: 'expense',
          category: 'Feed',
          amount: 1000,
          pondId: 'pond-1',
        } as any,
        USER_ID,
      );

      expect(result).toEqual(expect.objectContaining({ pondId: 'pond-1' }));
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
      // Same rows, plus the two flags every money row now carries.
      expect(result).toEqual([
        {
          id: '1',
          amount: 100,
          inventoryPurchase: false,
          pondName: null,
          archived: false,
        },
      ]);
    });

    it('filters by farmId after a VIEW_FINANCIALS check', async () => {
      const farmId = 'farm-1';
      await service.findAll(USER_ID, { farmId });

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

  /**
   * The money screen had no date filter at all. These pin the contract the
   * frontend builds against: inclusive on BOTH bounds, and a 400 rather than
   * an empty list when the range is backwards.
   */
  describe('findAll — date range', () => {
    const tx = (id: string, transactionDate: string) => ({
      id,
      farmId: 'farm-1',
      transactionDate,
    });

    // `find` is mocked, so run the where-clause the service built against real
    // rows rather than trusting a shape assertion.
    const applyWhere = (rows: any[], where: any) =>
      rows.filter((r) => {
        const d = where.transactionDate;
        if (!d) return true;
        const at = new Date(r.transactionDate).getTime();
        const ms = (v: any) => new Date(v).getTime();
        if (d.type === 'between') {
          const [from, to] = d.value as [Date, Date];
          return at >= ms(from) && at <= ms(to);
        }
        if (d.type === 'moreThanOrEqual') return at >= ms(d.value);
        return at <= ms(d.value);
      });

    /**
     * The bounds are IST calendar days, NOT UTC days. Every user of this app
     * is in IST, so "this month" bucketed in UTC would hide the first
     * morning's entries and show five and a half hours of next month's spend
     * — a wrong number on the screen the farmer trusts most.
     */
    it('is inclusive on both IST-local bounds and drops rows outside them', async () => {
      const rows = [
        // 2026-01-31 17:30 IST — genuinely before the range.
        tx('before', '2026-01-31T12:00:00.000Z'),
        // 2026-02-01 01:30 IST — the FIRST day, pre-dawn. UTC bucketing files
        // this under January and loses it.
        tx('ist-first-morning', '2026-01-31T20:00:00.000Z'),
        tx('middle', '2026-02-15T09:00:00.000Z'),
        // 2026-02-28 23:30 IST — late on the LAST day, must be kept.
        tx('ist-last-night', '2026-02-28T18:00:00.000Z'),
        // 2026-03-01 01:30 IST — March. A UTC end-of-day bound leaks it in.
        tx('ist-next-month', '2026-02-28T20:00:00.000Z'),
      ];
      mockRepository.find.mockImplementation(({ where }: any) =>
        Promise.resolve(applyWhere(rows, where)),
      );

      const result = await service.findAll(USER_ID, {
        farmId: 'farm-1',
        startDate: '2026-02-01',
        endDate: '2026-02-28',
      });

      expect((result as any[]).map((r) => r.id)).toEqual([
        'ist-first-morning',
        'middle',
        'ist-last-night',
      ]);
    });

    it('rejects an inverted range with 400 instead of returning nothing', async () => {
      await expect(
        service.findAll(USER_ID, {
          farmId: 'farm-1',
          startDate: '2026-03-01',
          endDate: '2026-02-01',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockRepository.find).not.toHaveBeenCalled();
    });

    it('applies no date filter when neither bound is given', async () => {
      await service.findAll(USER_ID, { farmId: 'farm-1' });
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { farmId: 'farm-1' },
        order: { transactionDate: 'DESC' },
      });
    });
  });

  /**
   * D2 — an inventory purchase writes a transaction with `inventoryItemId`
   * set. The farmer chooses whether the totals describe those; default ON, so
   * an unset param never silently drops money.
   */
  describe('findAll — includeInventoryPurchases', () => {
    it('keeps inventory purchases by default', async () => {
      await service.findAll(USER_ID, { farmId: 'farm-1' });
      const { where } = mockRepository.find.mock.calls[0][0];
      expect(where).not.toHaveProperty('inventoryItemId');
    });

    it('excludes rows with an inventoryItemId when false', async () => {
      await service.findAll(USER_ID, {
        farmId: 'farm-1',
        includeInventoryPurchases: false,
      });
      const { where } = mockRepository.find.mock.calls[0][0];
      // IsNull() — the SQL is `inventory_item_id IS NULL`.
      expect(where.inventoryItemId).toEqual(IsNull());
    });
  });

  /**
   * Row flags the Money screen renders directly — without them the entries
   * list cannot colour or label anything.
   */
  describe('findAll — row flags', () => {
    it('flags inventory purchases per row', async () => {
      mockRepository.find.mockResolvedValue([
        { id: 'bought-feed', inventoryItemId: 'item-1' },
        { id: 'paid-labour', inventoryItemId: null },
      ]);

      const rows: any[] = await service.findAll(USER_ID, { farmId: 'farm-1' });

      expect(rows.map((r) => r.inventoryPurchase)).toEqual([true, false]);
    });

    it('reports archived=false on a row that names no pond', async () => {
      mockRepository.find.mockResolvedValue([{ id: 't1', pondId: null }]);

      const rows: any[] = await service.findAll(USER_ID, { farmId: 'farm-1' });

      // A farm-level cost — a licence, a shared generator — belongs to no pond,
      // so there is no archived status to read. No pond is looked up either.
      expect(rows[0].archived).toBe(false);
      expect(rows[0].pondName).toBeNull();
      expect(mockPondsRepository.find).not.toHaveBeenCalled();
    });

    /**
     * `archived` used to be hardcoded `false` for every transaction, which was
     * right while one hung off a FARM only. Once a row could name a pond that
     * `false` became a wrong answer confidently given: the Money tab's "count
     * archived ponds" switch dropped an archived pond's EXPENSES and kept its
     * transactions, so flipping it moved the headline by less than the hint
     * beside it promised, and the list never marked the row.
     */
    it('reads archived and the pond name from the pond the row names', async () => {
      mockRepository.find.mockResolvedValue([
        { id: 't1', pondId: 'pond-old' },
        { id: 't2', pondId: 'pond-1' },
      ]);
      pondRows = [
        { id: 'pond-old', displayName: 'Old Pond', status: 'archived' },
        { id: 'pond-1', displayName: 'Pond One', status: 'active' },
      ];

      const rows: any[] = await service.findAll(USER_ID, { farmId: 'farm-1' });

      expect(rows.map((r) => r.archived)).toEqual([true, false]);
      expect(rows.map((r) => r.pondName)).toEqual(['Old Pond', 'Pond One']);
      // One lookup for the whole page, not one per row.
      expect(mockPondsRepository.find).toHaveBeenCalledTimes(1);
    });

    it('drops archived-pond rows when includeArchivedPonds is false (D3)', async () => {
      mockRepository.find.mockResolvedValue([
        { id: 't1', pondId: 'pond-old' },
        { id: 't2', pondId: 'pond-1' },
        { id: 't3', pondId: null },
      ]);
      pondRows = [
        { id: 'pond-old', status: 'archived' },
        { id: 'pond-1', status: 'active' },
      ];

      const rows: any[] = await service.findAll(USER_ID, {
        farmId: 'farm-1',
        includeArchivedPonds: false,
      });

      // The farm-level row survives: it belongs to no pond, so no pond's
      // retirement can take it away.
      expect(rows.map((r) => r.id)).toEqual(['t2', 't3']);
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
    // One conditional-aggregate query now, not one per bucket. Records the
    // `andWhere` fragments so the date/inventory bounds can be asserted.
    const stubQb = (raw: any) => {
      const andWhere = jest.fn().mockReturnThis();
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere,
        getRawOne: jest.fn().mockResolvedValue(raw),
      };
      mockRepository.createQueryBuilder.mockReturnValue(qb);
      return qb;
    };

    it('returns a summary after a VIEW_FINANCIALS check', async () => {
      stubQb({ income: '1500', expense: '800', inventory: '300' });

      const result = await service.getSummaryByFarm('farm-1', USER_ID);

      expect(mockFarmAccess.assertCanAccessFarm).toHaveBeenCalledWith(
        USER_ID,
        'farm-1',
        'VIEW_FINANCIALS',
      );
      expect(result).toEqual({
        totalIncome: 1500,
        totalExpense: 800,
        netProfit: 700,
        // The slice of totalExpense that came from inventory purchases, so the
        // client renders "of which inventory: ₹300" without a second request.
        inventoryExpense: 300,
      });
    });

    it('bounds the aggregate by the date range, end of the last day included', async () => {
      const qb = stubQb({ income: '0', expense: '0', inventory: '0' });

      await service.getSummaryByFarm('farm-1', USER_ID, {
        startDate: '2026-02-01',
        endDate: '2026-02-28',
      });

      // IST-local day boundaries: 00:00 IST on the 1st is 18:30Z on Jan 31,
      // and the range ends at 18:29:59.999Z on the 28th. A UTC bound would
      // both hide the first morning and leak 5.5h of March.
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('>= :startDate'),
        { startDate: new Date('2026-01-31T18:30:00.000Z') },
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('<= :endDate'),
        { endDate: new Date('2026-02-28T18:29:59.999Z') },
      );
    });

    it('rejects an inverted range with 400', async () => {
      stubQb({ income: '0', expense: '0', inventory: '0' });
      await expect(
        service.getSummaryByFarm('farm-1', USER_ID, {
          startDate: '2026-03-01',
          endDate: '2026-02-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('drops inventory purchases and zeroes the subtotal when excluded', async () => {
      const qb = stubQb({ income: '1500', expense: '500', inventory: '300' });

      const result = await service.getSummaryByFarm('farm-1', USER_ID, {
        includeInventoryPurchases: false,
      });

      expect(qb.andWhere).toHaveBeenCalledWith('t.inventoryItemId IS NULL');
      // The subtotal describes what is INSIDE totalExpense — nothing, here.
      expect(result.inventoryExpense).toBe(0);
      expect(result.totalExpense).toBe(500);
    });
  });
});

/**
 * Pond scoping on the money list.
 *
 * VIEW_FINANCIALS is overridable, so an owner can grant it to a pond-scoped
 * viewer or worker. That member's pond COSTS are narrowed, and so is the
 * financial report — a transaction attributed to a pond outside their scope
 * was the last piece of another pond's money still reaching them, and the one
 * row in the Money tab's list that the headline above it did not contain.
 */
describe('TransactionsService.findAll — pond scoping', () => {
  const build = (allowedPondIds: string[]) => {
    const transactionsRepository = {
      find: jest.fn().mockResolvedValue([
        { id: 'mine', pondId: 'p1' },
        { id: 'theirs', pondId: 'p2' },
        { id: 'farm-level', pondId: null },
      ]),
    };
    const pondsRepository = {
      find: jest.fn().mockResolvedValue([
        { id: 'p1', farmId: 'farm-1', status: 'active' },
        { id: 'p2', farmId: 'farm-1', status: 'active' },
      ]),
    };
    const farmAccess = {
      assertCanAccessFarm: jest.fn().mockResolvedValue({ id: 'farm-1' }),
      getFarmIdsWithCapability: jest.fn().mockResolvedValue(['farm-1']),
      getAccessiblePondIds: jest.fn().mockResolvedValue(allowedPondIds),
    };
    const service = new TransactionsService(
      transactionsRepository as any,
      pondsRepository as any,
      farmAccess as any,
    );
    return { service, farmAccess };
  };

  it('hides a pond transaction the caller is scoped away from', async () => {
    const { service, farmAccess } = build(['p1']);

    const rows: any[] = await service.findAll(USER_ID, { farmId: 'farm-1' });

    expect(rows.map((r) => r.id)).toEqual(['mine', 'farm-level']);
    expect(farmAccess.getAccessiblePondIds).toHaveBeenCalledWith(
      USER_ID,
      'farm-1',
      'VIEW_FINANCIALS',
    );
  });

  it('narrows nothing for an unscoped caller — owner and manager always are', async () => {
    const { service } = build(['p1', 'p2']);

    const rows: any[] = await service.findAll(USER_ID, { farmId: 'farm-1' });

    expect(rows.map((r) => r.id)).toEqual(['mine', 'theirs', 'farm-level']);
  });
});

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { In } from 'typeorm';
import { ExpensesService } from './expenses.service';

/**
 * `GET /expenses` — the pond / cycle / date / category list the Money screen
 * needs. The interesting property is not the filtering, it is that every
 * branch FAILS CLOSED: a caller who does not hold VIEW_FINANCIALS on a farm
 * must get none of that farm's costs, including when they name no farm at all.
 */
/**
 * A query builder that actually FILTERS.
 *
 * `cycleTransactions` is nothing but its where-clauses — the cycle window, the
 * pond and the type — so a mock that returns every row regardless would assert
 * the shape of SQL strings and prove nothing about which rows come back.
 * This interprets the handful of clause shapes that method emits
 * (`t.<field> <op> :<param>`), which makes "a transaction outside the window
 * does not appear" a real test: break a bound in the service and it fails.
 */
const filteringQb = (rows: any[]) => {
  const preds: [string, any][] = [];
  const push = (clause: string, params: any) => (
    preds.push([clause, params]), qb
  );
  const matches = (row: any) =>
    preds.every(([clause, params]) => {
      const m = /^t\.(\w+) (=|>=|<=) :(\w+)$/.exec(clause);
      if (!m) return true;
      const [, field, op, param] = m;
      const left = row[field];
      const right = params[param];
      if (left instanceof Date || right instanceof Date) {
        const a = new Date(left).getTime();
        const b = new Date(right).getTime();
        if (op === '=') return a === b;
        return op === '>=' ? a >= b : a <= b;
      }
      if (op === '=') return left === right;
      return op === '>=' ? left >= right : left <= right;
    });
  const qb: any = {
    where: push,
    andWhere: push,
    orderBy: () => qb,
    take: () => qb,
    getMany: async () => rows.filter(matches),
  };
  return qb;
};

const build = (over: any = {}) => {
  const expensesRepository = {
    find: jest.fn().mockResolvedValue(over.rows ?? []),
  };
  const cropsRepository = {
    findOne: jest.fn().mockResolvedValue(
      over.crop ?? {
        id: 'crop-1',
        pondId: 'pond-1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ),
  };
  const transactionsRepository = {
    createQueryBuilder: jest
      .fn()
      .mockImplementation(() => filteringQb(over.transactions ?? [])),
  };
  const harvestsService = {
    findAll: jest.fn().mockResolvedValue(over.harvests ?? []),
  };
  const farmAccess = {
    assertCanAccessFarm: jest.fn().mockResolvedValue({ id: 'farm-1' }),
    assertCanAccessPond: jest.fn().mockResolvedValue({ id: 'pond-1' }),
    getFarmIdsWithCapability: jest
      .fn()
      .mockResolvedValue(over.capableFarmIds ?? ['farm-1']),
    getAccessiblePondIds: jest
      .fn()
      .mockResolvedValue(over.pondIds ?? ['pond-1', 'pond-2']),
    ...over.farmAccess,
  };
  const service = new ExpensesService(
    expensesRepository as any,
    cropsRepository as any,
    harvestsService as any,
    farmAccess as any,
    transactionsRepository as any,
  );
  return {
    service,
    expensesRepository,
    transactionsRepository,
    farmAccess,
    harvestsService,
  };
};

const whereOf = (repo: any, call = 0) => repo.find.mock.calls[call][0].where;

describe('ExpensesService.findAll — authorization (fail closed)', () => {
  it('refuses a farm the caller may not view financials on, and reads nothing', async () => {
    const { service, expensesRepository, farmAccess } = build();
    farmAccess.assertCanAccessFarm.mockRejectedValue(new ForbiddenException());

    await expect(
      service.findAll({ farmId: 'other-farm' } as any, 'worker'),
    ).rejects.toThrow(ForbiddenException);

    expect(farmAccess.assertCanAccessFarm).toHaveBeenCalledWith(
      'worker',
      'other-farm',
      'VIEW_FINANCIALS',
    );
    expect(expensesRepository.find).not.toHaveBeenCalled();
  });

  it('with NO farmId, restricts to the farms where the caller holds VIEW_FINANCIALS', async () => {
    const { service, expensesRepository, farmAccess } = build({
      capableFarmIds: ['farm-1'],
      pondIds: ['pond-1'],
    });

    await service.findAll({} as any, 'manager');

    expect(farmAccess.getFarmIdsWithCapability).toHaveBeenCalledWith(
      'manager',
      'VIEW_FINANCIALS',
    );
    expect(whereOf(expensesRepository).pondId).toEqual(In(['pond-1']));
  });

  it('returns nothing at all for a caller with VIEW_FINANCIALS on no farm', async () => {
    const { service, expensesRepository } = build({ capableFarmIds: [] });

    const rows = await service.findAll({} as any, 'stranger');

    expect(rows).toEqual([]);
    // Never fall through to an unscoped read.
    expect(expensesRepository.find).not.toHaveBeenCalled();
  });

  it('returns nothing when the caller is scoped out of every pond on the farm', async () => {
    const { service, expensesRepository } = build({ pondIds: [] });

    const rows = await service.findAll({ farmId: 'farm-1' } as any, 'worker');

    expect(rows).toEqual([]);
    expect(expensesRepository.find).not.toHaveBeenCalled();
  });

  it('authorizes a named pond before reading it', async () => {
    const { service, expensesRepository, farmAccess } = build();

    await service.findAll({ pondId: 'pond-9' } as any, 'u');

    expect(farmAccess.assertCanAccessPond).toHaveBeenCalledWith(
      'u',
      'pond-9',
      'VIEW_FINANCIALS',
    );
    expect(whereOf(expensesRepository).pondId).toBe('pond-9');
  });

  it('authorizes a named cycle through its pond', async () => {
    const { service, expensesRepository, farmAccess } = build();

    await service.findAll({ cropId: 'crop-1' } as any, 'u');

    expect(farmAccess.assertCanAccessPond).toHaveBeenCalledWith(
      'u',
      'pond-1',
      'VIEW_FINANCIALS',
    );
    expect(whereOf(expensesRepository).cropId).toBe('crop-1');
  });
});

describe('ExpensesService.findAll — filters', () => {
  it('bounds `date` inclusively on both ends', async () => {
    const rows = [
      { id: 'before', date: '2026-01-31' },
      { id: 'start', date: '2026-02-01' },
      { id: 'end', date: '2026-02-28' },
      { id: 'after', date: '2026-03-01' },
    ];
    const { service, expensesRepository } = build();
    // `expenses.date` is a plain DATE column, so Between compares directly.
    expensesRepository.find.mockImplementation(({ where }: any) => {
      const [from, to] = where.date.value as [string, string];
      return Promise.resolve(rows.filter((r) => r.date >= from && r.date <= to));
    });

    const out = await service.findAll(
      { pondId: 'pond-1', startDate: '2026-02-01', endDate: '2026-02-28' } as any,
      'u',
    );

    expect((out as any[]).map((r) => r.id)).toEqual(['start', 'end']);
  });

  it('rejects an inverted range with 400 before touching the database', async () => {
    const { service, expensesRepository } = build();

    await expect(
      service.findAll(
        { pondId: 'pond-1', startDate: '2026-03-01', endDate: '2026-02-01' } as any,
        'u',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(expensesRepository.find).not.toHaveBeenCalled();
  });

  it('passes a category filter through', async () => {
    const { service, expensesRepository } = build();
    await service.findAll({ pondId: 'pond-1', category: 'Feed' } as any, 'u');
    expect(whereOf(expensesRepository).category).toBe('Feed');
  });
});

/**
 * Row flags. The Money screen colours archived rows slate and labels them, so
 * the boolean has to be ON THE ROW — the per-pond report breakdown cannot
 * colour an entries list.
 */
describe('ExpensesService — row flags', () => {
  const rows = [
    { id: 'e1', amount: '100', pond: { id: 'p1', status: 'archived' } },
    { id: 'e2', amount: '200', pond: { id: 'p2', status: 'active' } },
  ];

  it('marks costs from an archived pond and strips the joined pond back off', async () => {
    const { service, expensesRepository } = build({ rows });

    const out: any[] = await service.findAll({ pondId: 'p1' } as any, 'u');

    expect(expensesRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ relations: { pond: true } }),
    );
    expect(out.map((r) => r.archived)).toEqual([true, false]);
    // The join exists to read `status`, not to bloat every row with an entity.
    expect(out[0]).not.toHaveProperty('pond');
    expect(out[0].id).toBe('e1');
  });

  it('reports inventoryPurchase=false — a purchase writes a transaction, not an expense', async () => {
    const { service } = build({ rows });

    const out: any[] = await service.findAll({ pondId: 'p1' } as any, 'u');

    expect(out.every((r) => r.inventoryPurchase === false)).toBe(true);
  });

  it('flags the cycle read the same way', async () => {
    const { service } = build({ rows });

    const out: any[] = await service.findByCycle('crop-1', 'u');

    expect(out.map((r) => r.archived)).toEqual([true, false]);
  });
});

describe('ExpensesService.getCycleFinancials — date range', () => {
  it('counts only the harvests inside the range', async () => {
    const { service } = build({
      rows: [{ amount: '100', category: 'Feed', date: '2026-02-10' }],
      harvests: [
        { harvestDate: '2026-01-15', salePriceTotal: 5000, weightKg: 10 },
        { harvestDate: '2026-02-10', salePriceTotal: 8000, weightKg: 20 },
        { harvestDate: '2026-03-15', salePriceTotal: 9000, weightKg: 30 },
      ],
    });

    const out = await service.getCycleFinancials('crop-1', 'u', {
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    });

    expect(out.totalRevenue).toBe(8000);
    expect(out.totalHarvestKg).toBe(20);
  });

  it('counts every harvest when no range is given', async () => {
    const { service } = build({
      harvests: [
        { harvestDate: '2026-01-15', salePriceTotal: 5000, weightKg: 10 },
        { harvestDate: '2026-03-15', salePriceTotal: 9000, weightKg: 30 },
      ],
    });

    const out = await service.getCycleFinancials('crop-1', 'u');

    expect(out.totalRevenue).toBe(14000);
  });
});

/**
 * The other half of the two-table money merge.
 *
 * The farm Money screen writes a `transactions` row and can tag it to a pond;
 * the pond's Expenses tab reads `expenses WHERE cropId = ...`. A transaction
 * has no cropId, so a pond-tagged cost was invisible there: "i added an expense
 * in the money button ... and selected one pond ... but the expense tab inside
 * that pond didnt show this."
 *
 * The list and the total have to move TOGETHER — `getCycleFinancials` reduces
 * over `findByCycle`, so every case below asserts both.
 */
describe('ExpensesService.findByCycle — pond-tagged transactions', () => {
  // Cycle: stocked 10 Jan, still running.
  const crop = {
    id: 'crop-1',
    pondId: 'pond-1',
    stockingDate: '2026-01-10',
    createdAt: new Date('2026-01-08T00:00:00.000Z'),
  };
  const tx = (over: any = {}) => ({
    id: 't1',
    pondId: 'pond-1',
    type: 'expense',
    category: 'feed',
    amount: '750.50',
    description: 'Feed from the Money tab',
    transactionDate: new Date('2026-02-10T06:00:00.000Z'),
    createdAt: new Date('2026-02-10T06:00:00.000Z'),
    inventoryItemId: null,
    createdById: 'u',
    ...over,
  });

  it('shows a pond-tagged transaction in the cycle list AND in totalExpenses', async () => {
    const { service } = build({
      crop,
      rows: [{ id: 'e1', amount: '100', category: 'Feed', date: '2026-02-01' }],
      transactions: [tx()],
    });

    const list: any[] = await service.findByCycle('crop-1', 'u');
    expect(list.map((r) => r.id)).toEqual(['transaction:t1', 'e1']);
    // pg hands numerics back as strings — the row must carry a number.
    expect(list[0].amount).toBe(750.5);
    // Marked as coming from the other table, and impossible to mistake for an
    // expense id the edit/delete endpoints would accept.
    expect(list[0].source).toBe('transaction');

    const { totalExpenses } = await service.getCycleFinancials('crop-1', 'u');
    expect(totalExpenses).toBe(850.5);
  });

  it('excludes a transaction on ANOTHER pond', async () => {
    const { service } = build({
      crop,
      transactions: [tx({ pondId: 'pond-2' })],
    });

    expect(await service.findByCycle('crop-1', 'u')).toEqual([]);
    expect((await service.getCycleFinancials('crop-1', 'u')).totalExpenses).toBe(
      0,
    );
  });

  it('excludes a transaction dated BEFORE the cycle window opened', async () => {
    const { service } = build({
      crop,
      // 9 Jan IST — the day before stocking.
      transactions: [
        tx({ transactionDate: new Date('2026-01-09T06:00:00.000Z') }),
      ],
    });

    expect(await service.findByCycle('crop-1', 'u')).toEqual([]);
    expect((await service.getCycleFinancials('crop-1', 'u')).totalExpenses).toBe(
      0,
    );
  });

  it('excludes a transaction dated AFTER a closed cycle was harvested', async () => {
    const { service } = build({
      crop: { ...crop, actualHarvestDate: new Date('2026-03-01T04:00:00.000Z') },
      transactions: [
        tx({ transactionDate: new Date('2026-03-02T06:00:00.000Z') }),
      ],
    });

    expect(await service.findByCycle('crop-1', 'u')).toEqual([]);
  });

  it('keeps a transaction dated ON the harvest day — the window is inclusive', async () => {
    const { service } = build({
      // Harvested 1 Mar IST; the cost was typed later that same IST day.
      crop: { ...crop, actualHarvestDate: new Date('2026-03-01T04:00:00.000Z') },
      transactions: [
        tx({ transactionDate: new Date('2026-03-01T16:00:00.000Z') }),
      ],
    });

    expect((await service.findByCycle('crop-1', 'u')).length).toBe(1);
  });

  it('leaves income out — this cycle takes revenue from harvests, not typed rows', async () => {
    const { service } = build({
      crop,
      transactions: [tx({ type: 'income', category: 'harvest_sale' })],
    });

    expect(await service.findByCycle('crop-1', 'u')).toEqual([]);
  });

  it('dates the row by the IST calendar day, not the UTC one', async () => {
    const { service } = build({
      crop,
      // 18:30Z on 9 Feb is 10 Feb 00:00 IST — a 10 Feb cost.
      transactions: [
        tx({ transactionDate: new Date('2026-02-09T18:30:00.000Z') }),
      ],
    });

    const [row]: any[] = await service.findByCycle('crop-1', 'u');
    expect(row.date).toBe('2026-02-10');
  });

  it('narrows with ?startDate/?endDate on top of the cycle window', async () => {
    const { service } = build({
      crop,
      transactions: [
        // All three sit inside the cycle window; only the middle one is inside
        // the requested range, so BOTH bounds have to be applied.
        tx({ id: 'early', transactionDate: new Date('2026-01-15T06:00:00.000Z') }),
        tx({ id: 'in', transactionDate: new Date('2026-02-10T06:00:00.000Z') }),
        tx({ id: 'late', transactionDate: new Date('2026-04-10T06:00:00.000Z') }),
      ],
    });

    const list: any[] = await service.findByCycle('crop-1', 'u', {
      startDate: '2026-02-01',
      endDate: '2026-02-28',
    });
    expect(list.map((r) => r.id)).toEqual(['transaction:in']);
  });

  it('marks a projected row archived when the crop’s pond is retired', async () => {
    const { service } = build({
      crop: { ...crop, pond: { id: 'pond-1', status: 'archived' } },
      transactions: [tx()],
    });

    const [row]: any[] = await service.findByCycle('crop-1', 'u');
    expect(row.archived).toBe(true);
  });

  it('returns NOTHING to a caller without VIEW_FINANCIALS — neither table is read', async () => {
    const { service, transactionsRepository, expensesRepository } = build({
      crop,
      transactions: [tx()],
      farmAccess: {
        assertCanAccessPond: jest.fn().mockRejectedValue(new ForbiddenException()),
      },
    });

    await expect(service.findByCycle('crop-1', 'worker')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(
      service.getCycleFinancials('crop-1', 'worker'),
    ).rejects.toThrow(ForbiddenException);
    expect(transactionsRepository.createQueryBuilder).not.toHaveBeenCalled();
    expect(expensesRepository.find).not.toHaveBeenCalled();
  });
});

/**
 * The Money tab's pond-cost line items.
 *
 * `expenses.date` is a plain DATE column and the SQL range filter compares it
 * as `YYYY-MM-DD`, so the day printed on the row has to be derived the same
 * way. `toISOString()` does not: a driver that hydrates the column into a Date
 * at IST-local midnight is 18:30 UTC the day BEFORE, so the row rendered a day
 * earlier than the range that had just selected it — the classic DATE-1.
 */
describe('ExpensesService.findMoneyEntries — the day on the row', () => {
  const buildQb = (rows: any[]) => {
    const qb: any = {
      innerJoin: jest.fn(() => qb),
      where: jest.fn(() => qb),
      andWhere: jest.fn(() => qb),
      select: jest.fn(() => qb),
      addSelect: jest.fn(() => qb),
      orderBy: jest.fn(() => qb),
      take: jest.fn(() => qb),
      getRawMany: jest.fn().mockResolvedValue(rows),
    };
    const { service, farmAccess } = build();
    (service as any).expensesRepository = { createQueryBuilder: () => qb };
    return { service, qb, farmAccess };
  };

  it('buckets a hydrated Date by the IST calendar day, not the UTC one', async () => {
    // 2026-02-09T18:30:00Z is 2026-02-10 00:00 IST — the row is a 10 Feb cost.
    const { service } = buildQb([
      {
        id: 'e1',
        date: new Date('2026-02-09T18:30:00.000Z'),
        amount: '250.00',
        category: 'Feed',
        pondId: 'p1',
      },
    ]);

    const [entry] = await service.findMoneyEntries('u');

    expect(entry.transactionDate).toBe('2026-02-10');
    expect(entry.transactionDate).not.toBe('2026-02-09');
  });

  it('passes a string date straight through', async () => {
    const { service } = buildQb([
      { id: 'e1', date: '2026-02-10', amount: '250.00', category: 'Feed' },
    ]);

    const [entry] = await service.findMoneyEntries('u');

    expect(entry.transactionDate).toBe('2026-02-10');
  });
});

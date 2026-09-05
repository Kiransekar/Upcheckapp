import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { In } from 'typeorm';
import { ExpensesService } from './expenses.service';

/**
 * `GET /expenses` — the pond / cycle / date / category list the Money screen
 * needs. The interesting property is not the filtering, it is that every
 * branch FAILS CLOSED: a caller who does not hold VIEW_FINANCIALS on a farm
 * must get none of that farm's costs, including when they name no farm at all.
 */
const build = (over: any = {}) => {
  const expensesRepository = {
    find: jest.fn().mockResolvedValue(over.rows ?? []),
  };
  const cropsRepository = {
    findOne: jest
      .fn()
      .mockResolvedValue(over.crop ?? { id: 'crop-1', pondId: 'pond-1' }),
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
  );
  return { service, expensesRepository, farmAccess, harvestsService };
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

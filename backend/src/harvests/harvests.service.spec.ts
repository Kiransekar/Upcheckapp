import { ForbiddenException } from '@nestjs/common';
import { HarvestsService } from './harvests.service';

/**
 * Harvest sales as Money-tab line items.
 *
 * The projection is read-only on purpose: `getFinancialReport` already sums
 * every harvest's `salePriceTotal` into revenue AND adds the transactions
 * table, so writing a real Transaction on harvest create would double-count.
 */
function makeService(rows: any[], farmIds = ['f1']) {
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
  const repo = { createQueryBuilder: jest.fn(() => qb) };
  const farmAccess = {
    getFarmIdsWithCapability: jest.fn().mockResolvedValue(farmIds),
  };
  const svc = new HarvestsService(repo as any, {} as any, farmAccess as any);
  return { svc, qb, farmAccess };
}

const row = (over: any = {}) => ({
  id: 'h1',
  harvestDate: '2026-01-05',
  salePriceTotal: '42000.00',
  weightKg: 800,
  buyerName: 'Ravi Traders',
  farmId: 'f1',
  pondName: 'Pond 1',
  cropName: 'Cycle A',
  ...over,
});

describe('HarvestsService.findMoneyEntries', () => {
  it('projects a harvest sale into an income line item', async () => {
    const { svc } = makeService([row()]);

    const [entry] = await svc.findMoneyEntries('u');

    expect(entry).toEqual({
      id: 'harvest:h1',
      source: 'harvest',
      farmId: 'f1',
      transactionDate: '2026-01-05',
      type: 'income',
      category: 'Harvest',
      description: 'Pond 1 · Cycle A',
      amount: 42000,
      buyerName: 'Ravi Traders',
      weightKg: 800,
    });
  });

  /**
   * A harvest logged with no sale price yet is NOT ₹0 of revenue — it is a sale
   * that has not happened, and it contributes nothing to the report either. A
   * ₹0 row on screen would be a line the total above it does not contain.
   */
  it('excludes harvests with no sale price recorded yet', async () => {
    const { svc, qb } = makeService([]);

    await svc.findMoneyEntries('u');

    const clauses = qb.andWhere.mock.calls.map((c: any[]) => c[0]).join(' ');
    expect(clauses).toContain('salePriceTotal IS NOT NULL');
    expect(clauses).toContain('salePriceTotal > 0');
  });

  // Sale prices are financials. This is narrower than `findAll`'s
  // merely-accessible scoping, and matches transactionsService.findAll —
  // whose output these rows are merged with.
  it('scopes to farms where the caller may view financials', async () => {
    const { svc, farmAccess } = makeService([]);

    await svc.findMoneyEntries('u');

    expect(farmAccess.getFarmIdsWithCapability).toHaveBeenCalledWith(
      'u',
      'VIEW_FINANCIALS',
    );
  });

  it('returns nothing for a caller who may view no farm financials', async () => {
    const { svc, qb } = makeService([row()], []);

    expect(await svc.findMoneyEntries('worker')).toEqual([]);
    expect(qb.getRawMany).not.toHaveBeenCalled();
  });

  // Postgres numeric comes back as a string; adding one to a number would
  // concatenate rather than fail.
  it('coerces the numeric sale price', async () => {
    const { svc } = makeService([row({ salePriceTotal: '1500.50' })]);

    const [entry] = await svc.findMoneyEntries('u');

    expect(entry.amount).toBe(1500.5);
  });
});

/**
 * A pond's CONTINUOUS harvest history spans every crop cycle it has run.
 * Before `pondId` existed, the app asked for a pond's harvests by omitting
 * cropId — which returned every harvest on every accessible farm, sale prices
 * included. The filter must narrow WITHIN the farm scope, never replace it.
 */
function makeFindAllService(farmIds = ['f1']) {
  const qb: any = {
    innerJoin: jest.fn(() => qb),
    where: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    orderBy: jest.fn(() => qb),
    take: jest.fn(() => qb),
    addSelect: jest.fn(() => qb),
    getMany: jest.fn().mockResolvedValue([]),
    getRawAndEntities: jest.fn().mockResolvedValue({ entities: [], raw: [] }),
  };
  const repo = { createQueryBuilder: jest.fn(() => qb) };
  const farmAccess = {
    getAccessibleFarmIds: jest.fn().mockResolvedValue(farmIds),
    // Unrestricted member: every pond on each accessible farm.
    getAccessiblePondIds: jest.fn().mockResolvedValue(['p1', 'p2']),
    getFarmIdsWithCapability: jest.fn().mockResolvedValue(farmIds),
  };
  const svc = new HarvestsService(repo as any, {} as any, farmAccess as any);
  return { svc, qb, farmAccess };
}

describe('HarvestsService.findAll pond filter', () => {
  it('filters by pond across all of its crops', async () => {
    const { svc, qb } = makeFindAllService();

    await svc.findAll('u', undefined, 'p1');

    expect(qb.andWhere).toHaveBeenCalledWith('crop.pondId = :pondId', {
      pondId: 'p1',
    });
    // No cropId filter — that is the whole point of a cross-cycle history.
    expect(qb.andWhere).not.toHaveBeenCalledWith(
      'harvest.cropId = :cropId',
      expect.anything(),
    );
  });

  it('still constrains to the accessible farms — the pond filter never widens scope', async () => {
    const { svc, qb } = makeFindAllService(['f1', 'f2']);

    await svc.findAll('u', undefined, 'p1');

    expect(qb.where).toHaveBeenCalledWith('pond.farmId IN (:...farmIds)', {
      farmIds: ['f1', 'f2'],
    });
  });

  it('returns nothing when the caller can reach no farm, whatever pond they name', async () => {
    const { svc, qb } = makeFindAllService([]);

    await expect(svc.findAll('u', undefined, 'p1')).resolves.toEqual([]);
    expect(qb.getMany).not.toHaveBeenCalled();
  });

  // The list route carries no capability guard, so a viewer or a pond-scoped
  // worker reaches it. It may show them what came out of the pond; it may not
  // show them what it sold for.
  it('masks the sale price and buyer for a farm the caller cannot see the books of', async () => {
    const { svc, qb, farmAccess } = makeFindAllService(['f1', 'f2']);
    qb.getRawAndEntities.mockResolvedValue({
      entities: [
        { id: 'h1', salePriceTotal: 900, buyerName: 'Trader A' },
        { id: 'h2', salePriceTotal: 800, buyerName: 'Trader B' },
      ],
      raw: [{ row_farm_id: 'f1' }, { row_farm_id: 'f2' }],
    });
    farmAccess.getFarmIdsWithCapability.mockResolvedValue(['f1']);

    const rows = await svc.findAll('u');

    expect(rows[0]).toMatchObject({ salePriceTotal: 900, buyerName: 'Trader A' });
    expect(rows[1]).toMatchObject({ salePriceTotal: null, buyerName: null });
  });

  it('narrows to the ponds a scoped worker may reach', async () => {
    const { svc, qb, farmAccess } = makeFindAllService(['f1']);
    farmAccess.getAccessiblePondIds.mockResolvedValue(['p2']);

    await svc.findAll('u');

    expect(qb.andWhere).toHaveBeenCalledWith('crop.pondId IN (:...pondIds)', {
      pondIds: ['p2'],
    });
  });
});

/**
 * A harvest closes a cycle and books revenue. It used to ride WRITE_MANAGEMENT
 * on the route and WRITE_OPERATIONAL on the client — the same key as a pH
 * reading — so any worker could sell the pond. RECORD_HARVEST is its own
 * capability, and the service asserts it rather than trusting the route guard.
 */
function makeGateService(allowed: boolean) {
  const repo = {
    create: jest.fn((v: any) => v),
    save: jest.fn(async (v: any) => ({ id: 'h1', ...v })),
    findOne: jest.fn(async () => ({ id: 'h1', crop: { pondId: 'p1' } })),
    findOneBy: jest.fn(async () => ({ id: 'h1' })),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const cropsService = {
    findOneAccessible: jest.fn(async () => ({ id: 'c1', pondId: 'p1' })),
    closeCycle: jest.fn(),
  };
  const farmAccess = {
    assertCanAccessPond: jest.fn(async () => {
      if (!allowed) throw new ForbiddenException();
      return { id: 'p1' };
    }),
  };
  const svc = new HarvestsService(
    repo as any,
    cropsService as any,
    farmAccess as any,
  );
  return { svc, repo, farmAccess, cropsService };
}

describe('RECORD_HARVEST gate', () => {
  const dto = {
    cropId: 'c1',
    harvestDate: '2026-02-01',
    weightKg: 100,
    harvestType: 'partial',
  } as any;

  it('refuses a worker with no grant, and asks for RECORD_HARVEST by name', async () => {
    const { svc, repo, farmAccess } = makeGateService(false);

    await expect(svc.create(dto, 'worker-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(farmAccess.assertCanAccessPond).toHaveBeenCalledWith(
      'worker-1',
      'p1',
      'RECORD_HARVEST',
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('allows the same worker once the capability resolves true', async () => {
    const { svc, repo } = makeGateService(true);

    await expect(svc.create(dto, 'worker-1')).resolves.toEqual(
      expect.objectContaining({ id: 'h1' }),
    );
    // ...and records who did it: a harvest is money, and the money tables
    // carried no actor at all before this.
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ createdById: 'worker-1' }),
    );
  });

  it('gates an edit and stamps the editor', async () => {
    const { svc, repo, farmAccess } = makeGateService(true);

    await svc.update('h1', { weightKg: 120 } as any, 'manager-1');

    expect(farmAccess.assertCanAccessPond).toHaveBeenCalledWith(
      'manager-1',
      'p1',
      'RECORD_HARVEST',
    );
    expect(repo.update).toHaveBeenCalledWith('h1', {
      weightKg: 120,
      updatedById: 'manager-1',
    });
  });

  it('gates a delete', async () => {
    const { svc, repo } = makeGateService(false);

    await expect(svc.remove('h1', 'worker-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(repo.delete).not.toHaveBeenCalled();
  });
});

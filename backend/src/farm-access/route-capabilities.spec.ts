/**
 * W1 regression guard.
 *
 * Twenty call sites in the engine and reporting services authorized via the
 * OWNER-ONLY `pondsService.findOne` / `cropsService.findOne` while the
 * capability matrix said managers and workers had access. A manager could log
 * water quality but got a bare 403 starting a cycle on the same pond — the role
 * advertised authority the app then refused.
 *
 * The fix moved those sites onto the member-aware helpers AND declared the
 * policy at the route with `@OwnsResource`. This spec reads the decorator
 * metadata off the real controllers and pins it, so that:
 *
 *   1. a route cannot silently lose its guard,
 *   2. a route's capability cannot drift away from what the service asserts,
 *   3. the service-layer check stays EQUAL to the route guard — never stricter.
 *
 * When a route legitimately changes capability, change it here too, in the same
 * commit, and make sure the matching service assert moves with it.
 */
import 'reflect-metadata';
import {
  OWNS_RESOURCE_KEY,
  OwnsResourceOptions,
} from '../common/decorators/owns-resource.decorator';
import { FeedAdvisorController } from '../feed-advisor/feed-advisor.controller';
import { DiseaseWarningController } from '../disease-warning/disease-warning.controller';
import { MeasurementController } from '../measurement/measurement.controller';
import { PondContextController } from '../pond-context/pond-context.controller';
import { HarvestTimingController } from '../harvest-timing/harvest-timing.controller';
import { ReportsController } from '../reports/reports.controller';
import { HarvestsController } from '../harvests/harvests.controller';
import { InventoryController } from '../inventory/inventory.controller';
import { FarmsController } from '../farms/farms.controller';
import { CropsController } from '../crops/crops.controller';
import { PondsController } from '../ponds/ponds.controller';
import { InventoryService } from '../inventory/inventory.service';
import { TransactionsService } from '../transactions/transactions.service';

type Row = [
  controller: new (...args: any[]) => any,
  handler: string,
  expected: OwnsResourceOptions,
];

const P = (capability: OwnsResourceOptions['capability']) => ({
  entityType: 'Pond',
  paramName: 'pondId',
  ownerPath: 'farm.userId',
  capability,
});

const ROUTES: Row[] = [
  // feed-advisor — planning writes are WRITE_MANAGEMENT, reads READ, and
  // recording what was actually fed is field data (WRITE_OPERATIONAL).
  [FeedAdvisorController, 'generate', P('WRITE_MANAGEMENT')],
  [FeedAdvisorController, 'recent', P('READ')],
  [
    FeedAdvisorController,
    'logActual',
    {
      entityType: 'FeedPlan',
      paramName: 'id',
      ownerPath: 'pond.farm.userId',
      capability: 'WRITE_OPERATIONAL',
    },
  ],

  // disease-warning — persisting a snapshot is operational output; reads READ.
  [DiseaseWarningController, 'snapshot', P('WRITE_OPERATIONAL')],
  [DiseaseWarningController, 'recent', P('READ')],
  [DiseaseWarningController, 'latest', P('READ')],

  // measurement — field logging is WRITE_OPERATIONAL, time-series reads READ.
  [MeasurementController, 'create', P('WRITE_OPERATIONAL')],
  [MeasurementController, 'query', P('READ')],
  [
    MeasurementController,
    'findOne',
    {
      entityType: 'Measurement',
      paramName: 'id',
      ownerPath: 'pond.farm.userId',
      capability: 'READ',
    },
  ],
  [
    MeasurementController,
    'edit',
    {
      entityType: 'Measurement',
      paramName: 'id',
      ownerPath: 'pond.farm.userId',
      capability: 'WRITE_OPERATIONAL',
    },
  ],

  // pond-context — dashboard read.
  [PondContextController, 'get', P('READ')],

  // harvest-timing — the persisted-history read.
  [HarvestTimingController, 'recent', P('READ')],

  // harvests — a harvest closes a cycle and books revenue. It used to ride
  // WRITE_MANAGEMENT (and, on the client, WRITE_OPERATIONAL: the same key as a
  // pH reading), so any worker could sell the pond. RECORD_HARVEST is its own
  // capability, owner/manager by default, grantable per role or per member.
  [
    HarvestsController,
    'create',
    {
      entityType: 'Crop',
      paramName: 'cropId',
      ownerPath: 'pond.farm.userId',
      capability: 'RECORD_HARVEST',
    },
  ],
  ...(['findOne', 'update', 'remove'] as const).map(
    (handler): Row => [
      HarvestsController,
      handler,
      {
        entityType: 'Harvest',
        paramName: 'id',
        ownerPath: 'crop.pond.farm.userId',
        capability: 'RECORD_HARVEST',
      },
    ],
  ),

  // reports — cycle analysis is a financial report, hence VIEW_FINANCIALS and
  // NOT the member-aware crop path.
  [
    ReportsController,
    'getCycleAnalysis',
    {
      entityType: 'Crop',
      paramName: 'id',
      ownerPath: 'pond.farm.userId',
      capability: 'VIEW_FINANCIALS',
    },
  ],

  // farm lifecycle — archive/unarchive/delete are the farm's existence, which
  // is the one thing an owner can never delegate (OWNER_ONLY is in
  // NEVER_OVERRIDABLE, so no policy or override can reach these).
  ...(['archive', 'unarchive', 'remove'] as const).map((handler): Row => [
    FarmsController,
    handler,
    {
      entityType: 'Farm',
      paramName: 'id',
      ownerPath: 'userId',
      capability: 'OWNER_ONLY',
    },
  ]),

  // pond lifecycle — archive and its undo are WRITE_MANAGEMENT, NOT
  // OWNER_ONLY: a manager runs the ponds. Deletion stays OWNER_ONLY (below,
  // unchanged) because it destroys history rather than hiding it.
  ...(['archive', 'unarchive'] as const).map((handler): Row => [
    PondsController,
    handler,
    {
      entityType: 'Pond',
      paramName: 'id',
      ownerPath: 'farm.userId',
      capability: 'WRITE_MANAGEMENT',
    },
  ]),

  // crops — closing a cycle IS recording a harvest. These rode
  // WRITE_MANAGEMENT, which let a member the owner had explicitly blocked from
  // harvesting complete the cycle and write the harvest weight anyway.
  ...(['harvest', 'closeCycle'] as const).map((handler): Row => [
    CropsController,
    handler,
    {
      entityType: 'Crop',
      paramName: 'id',
      ownerPath: 'pond.farm.userId',
      capability: 'RECORD_HARVEST',
    },
  ]),
];

const metaFor = (
  controller: new (...args: any[]) => any,
  handler: string,
): OwnsResourceOptions | undefined =>
  Reflect.getMetadata(OWNS_RESOURCE_KEY, controller.prototype[handler]);

describe('W1 — route guard capabilities match the service-layer policy', () => {
  it.each(ROUTES)(
    '%p.%s declares the expected @OwnsResource',
    (controller, handler, expected) => {
      const meta = metaFor(controller, handler);
      expect(meta).toBeDefined();
      expect(meta).toEqual(expected);
    },
  );

  it('never declares a capability outside the known matrix', () => {
    const known = [
      'READ',
      'WRITE_OPERATIONAL',
      'WRITE_MANAGEMENT',
      'VIEW_FINANCIALS',
      'MANAGE_WORKERS',
      'OWNER_ONLY',
      'RECORD_HARVEST',
      'VIEW_INVENTORY',
      'MANAGE_INVENTORY',
    ];
    for (const [controller, handler] of ROUTES) {
      expect(known).toContain(metaFor(controller, handler)!.capability);
    }
  });

  // These routes deliberately carry NO route guard; each is documented where it
  // lives. If someone adds one, the guard will 404 legitimate calls (no single
  // resource id to resolve), so this pins the omission as intended.
  const UNGUARDED: Array<[new (...args: any[]) => any, string, string]> = [
    [MeasurementController, 'createBatch', 'a batch may span several ponds'],
    [HarvestTimingController, 'optimize', 'pondId is optional (pure preview)'],
    // Inventory (D11): the guard resolves an owner path off a single entity,
    // and inventory is farm-scoped with the farmId in the BODY on create and on
    // the item (not the URL) everywhere else. It enforces in the service via
    // farmAccess.assertCanAccessFarm instead — pinned below and exercised in
    // inventory.service.spec.ts.
    ...(
      [
        'create',
        'findAll',
        'getLowStock',
        'findOne',
        'adjustStock',
        'update',
        'remove',
        'listMovements',
        'setPairing',
      ] as const
    ).map((handler): [new (...args: any[]) => any, string, string] => [
      InventoryController,
      handler,
      'farm-scoped, enforced in InventoryService',
    ]),
  ];

  // The inventory capability contract, pinned so it cannot silently slide back
  // to OWNER_ONLY (D13). Read off the service, which is where it is asserted.
  it.each([
    ['create', 'MANAGE_INVENTORY'],
    ['findAll', 'VIEW_INVENTORY'],
    ['findOne', 'VIEW_INVENTORY'],
    ['update', 'MANAGE_INVENTORY'],
    ['remove', 'MANAGE_INVENTORY'],
    ['getLowStock', 'VIEW_INVENTORY'],
    ['adjustStock', 'MANAGE_INVENTORY'],
    ['listMovements', 'VIEW_INVENTORY'],
    ['setPairing', 'MANAGE_INVENTORY'],
  ])('InventoryService.%s asserts %s', async (method, capability) => {
    const assertCanAccessFarm = jest
      .fn()
      .mockResolvedValue({ id: 'farm-1', userId: 'owner-1', rolePolicy: null });
    const qb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const service = new InventoryService(
      {
        create: (d: any) => d,
        save: jest.fn().mockResolvedValue({}),
        find: jest.fn().mockResolvedValue([]),
        findOneBy: jest
          .fn()
          .mockResolvedValue({ id: 'i1', farmId: 'farm-1', quantity: 10 }),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
        createQueryBuilder: () => qb,
      } as any,
      {
        create: (d: any) => d,
        save: jest.fn().mockResolvedValue({}),
        find: jest.fn().mockResolvedValue([]),
      } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      { createAutoAlert: jest.fn() } as any,
      { assertCanAccessFarm, getFarmIdsWithCapability: jest.fn() } as any,
      {
        find: jest.fn().mockResolvedValue([]),
        save: jest.fn().mockResolvedValue({}),
        create: (d: any) => d,
      } as any,
      {
        transaction: jest.fn((cb: any) =>
          cb({ delete: jest.fn(), insert: jest.fn(), update: jest.fn() }),
        ),
      } as any,
    );

    const args: Record<string, unknown[]> = {
      create: [{ farmId: 'farm-1', name: 'x', category: 'feed' }, 'u1'],
      findAll: ['u1', 'farm-1'],
      findOne: ['i1', 'u1'],
      update: ['i1', { name: 'x' }, 'u1'],
      remove: ['i1', 'u1'],
      getLowStock: ['farm-1', 'u1'],
      adjustStock: ['i1', -1, 'u1'],
      listMovements: ['i1', 'u1'],
      setPairing: ['i1', ['farm-1'], 'u1'],
    };
    await (service as any)[method](...args[method]);

    expect(assertCanAccessFarm).toHaveBeenCalledWith(
      'u1',
      'farm-1',
      capability,
    );
  });

  it.each(UNGUARDED)(
    '%p.%s intentionally has no @OwnsResource (%s)',
    (controller, handler) => {
      expect(metaFor(controller, handler)).toBeUndefined();
    },
  );

  // Transaction writes (D12): update/remove rode VIEW_FINANCIALS — the same
  // capability as merely SEEING the money, so anyone with financial read
  // access could rewrite or hard-delete a transaction. Pinned to
  // WRITE_MANAGEMENT so the gate cannot silently slide back onto the read
  // capability. Reads and create stay on VIEW_FINANCIALS, unpinned here.
  it.each([
    ['update', 'WRITE_MANAGEMENT'],
    ['remove', 'WRITE_MANAGEMENT'],
  ])('TransactionsService.%s asserts %s', async (method, capability) => {
    const assertCanAccessFarm = jest
      .fn()
      .mockResolvedValue({ id: 'farm-1', userId: 'owner-1' });
    const service = new TransactionsService(
      {
        findOneBy: jest.fn().mockResolvedValue({ id: 't1', farmId: 'farm-1' }),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
      } as any,
      { assertCanAccessFarm } as any,
    );

    const args: Record<string, unknown[]> = {
      update: ['t1', { amount: 1 }, 'u1'],
      remove: ['t1', 'u1'],
    };
    await (service as any)[method](...args[method]);

    expect(assertCanAccessFarm).toHaveBeenCalledWith(
      'u1',
      'farm-1',
      capability,
    );
  });
});

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

  // These two routes deliberately carry NO route guard; both are documented in
  // the controllers. If someone adds one, the guard will 404 legitimate calls
  // (no single resource id to resolve), so this pins the omission as intended.
  const UNGUARDED: Array<
    [new (...args: any[]) => any, string, string]
  > = [
    [MeasurementController, 'createBatch', 'a batch may span several ponds'],
    [HarvestTimingController, 'optimize', 'pondId is optional (pure preview)'],
  ];

  it.each(UNGUARDED)(
    '%p.%s intentionally has no @OwnsResource (%s)',
    (controller, handler) => {
      expect(metaFor(controller, handler)).toBeUndefined();
    },
  );
});

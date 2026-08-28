import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Pond } from '../ponds/pond.entity';
import { Crop } from '../crops/crop.entity';
import { SamplingData } from '../sampling/sampling-data.entity';
import { MortalityRecord } from '../mortality/mortality-record.entity';
import { FeedRecord } from '../feed-records/feed-record.entity';
import { FeedingTrayCheck } from '../feeding-tray-checks/feeding-tray-check.entity';
import { WaterQualityRecord } from '../water-quality/water-quality-record.entity';
import { PondsService } from '../ponds/ponds.service';
import { CropsService } from '../crops/crops.service';
import { ShrimpCalculationsService } from '../shrimp-calculations/shrimp-calculations.service';
import { FarmAccessService } from '../farm-access/farm-access.service';

export interface PondContext {
  pondId: string;
  cropId: string | null;
  /** Cultured species (free text, e.g. "Penaeus monodon") — tunes the engines. */
  species: string | null;
  areaM2: number | null;
  /** Total installed aerator power (HP) — auto-fills the Aeration optimizer. */
  installedAeratorHp: number | null;
  doc: number | null;
  /**
   * Latest value of EACH water-quality parameter. Daily params (DO, pH,
   * salinity, temp — probe-measured) come from the newest entry; periodic
   * chemistry (ammonia, nitrite, nitrate, alkalinity — test-kit/lab) is the
   * latest NON-NULL value, carried forward from whenever it was last measured.
   */
  waterQuality: {
    dissolvedOxygen: number | null;
    ph: number | null;
    temperature: number | null;
    salinity: number | null;
    ammonia: number | null;
    nitrite: number | null;
    nitrate: number | null;
    alkalinity: number | null;
    /** When the newest water-quality record was logged. */
    recordedAt: string | null;
    /** Each parameter's OWN source-record time — probe params can come from
     * different records than one another, so freshness must be per-parameter. */
    dissolvedOxygenAsOf: string | null;
    phAsOf: string | null;
    temperatureAsOf: string | null;
    salinityAsOf: string | null;
    /** When ammonia (chemistry) was last measured — may be older. */
    chemistryAsOf: string | null;
    /** When alkalinity was last measured — independent of ammonia's date. */
    alkalinityAsOf: string | null;
  } | null;
  /** Free (un-ionised) NH3 derived from latest ammonia(TAN)+pH+temp. */
  freeAmmoniaMgL: number | null;
  /** Latest sampled average body weight (g). */
  abwG: number | null;
  /** Mortality-adjusted live population estimate. */
  livePopulation: number | null;
  /** Standing biomass estimate (kg). */
  biomassKg: number | null;
  /** Crop targets the engines consume. */
  crop: {
    stockingCount: number | null;
    carryingCapacityKgM2: number | null;
    feedPriceRpPerKg: number | null;
    targetSrPercent: number | null;
    targetSize: number | null;
    targetCultivationDays: number | null;
  } | null;
  // ── Continuous loop metrics (feed in → tray feedback → FCR) ──
  /** Cumulative feed fed this crop (kg). */
  cumulativeFeedKg: number | null;
  /** Running FCR = cumulative feed / standing biomass (jala §10). */
  runningFcr: number | null;
  /** Latest feeding-tray residue → prefills the Feed Advisor's tray input. */
  latestTrayResidue: 'empty' | 'few_left' | 'a_lot_left' | null;
  /** Timestamps of the most recent feed log / tray check (for "done today"). */
  lastFeedAt: string | null;
  lastTrayAt: string | null;
  /** When the latest sampling (ABW) was taken. */
  samplingAt: string | null;
  /**
   * Data confidence the engines attach to their output — driven by how complete
   * and fresh the pond's logged inputs are. More current values → higher score.
   */
  confidence: DataConfidence;
}

export interface DataConfidence {
  score: number; // 0..100
  band: 'high' | 'medium' | 'low';
  /** Inputs not logged yet (raise these to improve accuracy). */
  missing: string[];
  /** Inputs present but older than their freshness window. */
  stale: string[];
}

interface ConfidenceFactor {
  key: string;
  present: boolean;
  ageDays: number | null;
  weight: number;
  freshWindowDays: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Single source of the farmer's latest inputs for a pond (PRD "capture once,
 * reuse everywhere"). Engines read this snapshot instead of re-asking the
 * farmer for DO / NH3 / temp / ABW / population they already logged.
 */
@Injectable()
export class PondContextService {
  constructor(
    @InjectRepository(SamplingData)
    private readonly samplingRepo: Repository<SamplingData>,
    @InjectRepository(MortalityRecord)
    private readonly mortalityRepo: Repository<MortalityRecord>,
    @InjectRepository(FeedRecord)
    private readonly feedRepo: Repository<FeedRecord>,
    @InjectRepository(FeedingTrayCheck)
    private readonly trayRepo: Repository<FeedingTrayCheck>,
    @InjectRepository(WaterQualityRecord)
    private readonly wqRepo: Repository<WaterQualityRecord>,
    @InjectRepository(Pond)
    private readonly pondRepo: Repository<Pond>,
    @InjectRepository(Crop)
    private readonly cropRepo: Repository<Crop>,
    private readonly pondsService: PondsService,
    private readonly cropsService: CropsService,
    private readonly calc: ShrimpCalculationsService,
    private readonly farmAccess: FarmAccessService,
  ) {}

  /**
   * Every pond on a farm the caller may READ, in one request.
   *
   * The redesigned Farms and Ponds screens open on per-pond numbers — day, DO,
   * biomass — for the whole farm at once. Asking for them one pond at a time
   * meant 9–24 round trips on the two most-visited screens in the app, which
   * on a rural connection is the entire load time.
   *
   * The per-pond work is unchanged and so is the access check: each snapshot
   * still goes through getContext, which enforces READ and pond scoping. A
   * pond that fails (deleted mid-flight, scoped out) is dropped rather than
   * failing the batch — a partial farm view beats a blank screen.
   */
  async getFarmContexts(
    farmId: string,
    userId: string,
  ): Promise<PondContext[]> {
    const pondIds = await this.farmAccess.getAccessiblePondIds(
      userId,
      farmId,
      'READ',
    );

    return this.buildContextsFor(pondIds);
  }

  /**
   * Build contexts for an ALREADY-AUTHORISED set of ponds, using a fixed
   * number of set-based queries rather than one fan-out per pond.
   *
   * This used to call `getContext` per pond: ~7 queries each, so a 43-pond
   * farm issued ~300. Every one is a round trip to Supabase in Singapore from
   * a backend in Oregon (~180ms), which is where the Farms screen's load time
   * went — the queries themselves run in well under a millisecond.
   *
   * Now it is 9 queries REGARDLESS of pond count. The caller must already
   * have authorised `pondIds` (getFarmContexts does, via
   * getAccessiblePondIds); nothing here re-checks access, which is also what
   * removes the per-pond pond+farm read.
   */
  private async buildContextsFor(pondIds: string[]): Promise<PondContext[]> {
    if (!pondIds.length) return [];

    const ponds = await this.pondRepo.find({ where: { id: In(pondIds) } });
    const cropIds = ponds
      .map((p) => p.activeCycleId)
      .filter((id): id is string => !!id);
    // A pond with an active crop takes its sampling from THAT crop; a pond
    // without one falls back to its latest sampling overall. Same rule as
    // getContext, expressed as two set queries instead of one per pond.
    const cropPondPairs = ponds
      .filter((p) => p.activeCycleId)
      .map((p) => ({ pondId: p.id, cropId: p.activeCycleId as string }));
    const croplessPondIds = ponds
      .filter((p) => !p.activeCycleId)
      .map((p) => p.id);

    const [crops, wqRows, samplingByCrop, samplingByPond, mortality, feed, trays] =
      await Promise.all([
        cropIds.length
          ? this.cropRepo.find({
              where: { id: In(cropIds) },
              relations: ['species'],
            })
          : Promise.resolve([]),
        this.latestWaterQualityFor(pondIds),
        cropPondPairs.length
          ? this.latestSamplingByCrop(cropPondPairs.map((p) => p.cropId))
          : Promise.resolve([]),
        croplessPondIds.length
          ? this.latestSamplingByPond(croplessPondIds)
          : Promise.resolve([]),
        cropIds.length
          ? this.mortalityRepo
              .createQueryBuilder('m')
              .select('m.crop_id', 'cropId')
              .addSelect('SUM(m.estimatedTotal)', 'total')
              .where('m.cropId IN (:...cropIds)', { cropIds })
              .groupBy('m.crop_id')
              .getRawMany()
          : Promise.resolve([]),
        cropIds.length
          ? this.feedRepo
              .createQueryBuilder('feed')
              .select('feed.crop_id', 'cropId')
              .addSelect('SUM(feed.quantityKg)', 'totalFeed')
              .addSelect('MAX(feed.recordedAt)', 'lastFeedAt')
              .where('feed.cropId IN (:...cropIds)', { cropIds })
              .groupBy('feed.crop_id')
              .getRawMany()
          : Promise.resolve([]),
        cropIds.length
          ? this.latestTrayByCrop(cropIds)
          : Promise.resolve([]),
      ]);

    const cropById = new Map(crops.map((c) => [c.id, c]));
    const mortalityByCrop = new Map(mortality.map((r) => [r.cropId, r]));
    const feedByCrop = new Map(feed.map((r) => [r.cropId, r]));
    const trayByCrop = new Map(trays.map((t) => [t.cropId, t]));
    const samplingForCrop = new Map(samplingByCrop.map((s) => [s.cropId, s]));
    const samplingForPond = new Map(samplingByPond.map((s) => [s.pondId, s]));

    const wqByPond = new Map<string, WaterQualityRecord[]>();
    for (const row of wqRows) {
      const list = wqByPond.get(row.pondId);
      if (list) list.push(row);
      else wqByPond.set(row.pondId, [row]);
    }

    return ponds.map((pond) => {
      const cropId = pond.activeCycleId ?? null;
      return this.buildContext(pond, {
        crop: cropId ? (cropById.get(cropId) ?? null) : null,
        wqRecords: wqByPond.get(pond.id) ?? [],
        sampling: cropId
          ? (samplingForCrop.get(cropId) ?? null)
          : (samplingForPond.get(pond.id) ?? null),
        mortalityAgg: cropId ? (mortalityByCrop.get(cropId) ?? null) : null,
        feedAgg: cropId ? (feedByCrop.get(cropId) ?? null) : null,
        tray: cropId ? (trayByCrop.get(cropId) ?? null) : null,
      });
    });
  }

  /**
   * The newest 60 water-quality rows for EACH pond, in one query.
   *
   * A LATERAL join is what makes "top N per group" a single statement instead
   * of one query per pond. It walks the (pond_id, recorded_at DESC) composite
   * index straight to each pond's newest rows and stops — the index added in
   * AddWaterQualityPondRecordedAtIndex exists precisely for this shape.
   *
   * Columns are aliased to the ENTITY's property names because
   * `resolveWaterQuality` reads them by property (dissolvedOxygen, recordedAt,
   * …). Only those it actually reads are selected.
   */
  private async latestWaterQualityFor(
    pondIds: string[],
  ): Promise<WaterQualityRecord[]> {
    return this.wqRepo.query(
      `SELECT w.pond_id AS "pondId",
              w.recorded_at AS "recordedAt",
              w.dissolved_oxygen AS "dissolvedOxygen",
              w.ph, w.temperature, w.salinity,
              w.ammonia, w.nitrite, w.nitrate, w.alkalinity
         FROM unnest($1::uuid[]) AS p(id)
         JOIN LATERAL (
              SELECT * FROM water_quality_records w2
               WHERE w2.pond_id = p.id
               ORDER BY w2.recorded_at DESC
               LIMIT 60
         ) w ON true`,
      [pondIds],
    );
  }

  /** Latest sampling per crop — DISTINCT ON collapses to one row per group. */
  private async latestSamplingByCrop(cropIds: string[]): Promise<SamplingData[]> {
    return this.samplingRepo.query(
      `SELECT DISTINCT ON (crop_id)
              crop_id AS "cropId", pond_id AS "pondId",
              sampling_date AS "samplingDate", mbw_g AS "mbwG"
         FROM sampling_data
        WHERE crop_id = ANY($1::uuid[])
        ORDER BY crop_id, sampling_date DESC`,
      [cropIds],
    );
  }

  /** Latest sampling per pond, for ponds with no active crop. */
  private async latestSamplingByPond(pondIds: string[]): Promise<SamplingData[]> {
    return this.samplingRepo.query(
      `SELECT DISTINCT ON (pond_id)
              pond_id AS "pondId", crop_id AS "cropId",
              sampling_date AS "samplingDate", mbw_g AS "mbwG"
         FROM sampling_data
        WHERE pond_id = ANY($1::uuid[])
        ORDER BY pond_id, sampling_date DESC`,
      [pondIds],
    );
  }

  /** Latest feeding-tray check per crop. */
  private async latestTrayByCrop(
    cropIds: string[],
  ): Promise<FeedingTrayCheck[]> {
    return this.trayRepo.query(
      `SELECT DISTINCT ON (crop_id)
              crop_id AS "cropId", check_date AS "checkDate",
              remaining_feed_status AS "remainingFeedStatus"
         FROM feeding_tray_checks
        WHERE crop_id = ANY($1::uuid[])
        ORDER BY crop_id, check_date DESC`,
      [cropIds],
    );
  }

  /**
   * Every readable pond across ALL the caller's farms, in one request.
   *
   * Same convention as `GET /ponds/mine` and the farm-less transactions list:
   * scope by `getAccessibleFarmIds` rather than making the client loop per
   * farm. A multi-farm account used to pay one round trip per farm here.
   */
  async getMyContexts(userId: string): Promise<PondContext[]> {
    const farmIds = await this.farmAccess.getAccessibleFarmIds(userId);
    // One farm at a time. getFarmContexts already caps itself at 6 concurrent
    // contexts; fanning the farms out on top of that would multiply through it
    // and put far more than the pool's 5 connections' worth of work in flight.
    const out: PondContext[] = [];
    for (const farmId of farmIds) {
      out.push(...(await this.getFarmContexts(farmId, userId)));
    }
    return out;
  }

  /**
   * Resolve each water-quality parameter to its latest NON-NULL value across
   * recent records (newest first). Daily probe params surface from the newest
   * entry; periodic chemistry carries forward from whenever it was last
   * measured — so a 4-day-old ammonia reading still reaches the engines instead
   * of being hidden behind today's probe-only entry.
   */
  resolveWaterQuality(
    records: WaterQualityRecord[],
  ): PondContext['waterQuality'] {
    if (!records.length) return null;
    const latest = <K extends keyof WaterQualityRecord>(key: K) => {
      for (const r of records) {
        const v = r[key] as unknown as number | null | undefined;
        if (v != null) return { value: Number(v), at: r.recordedAt };
      }
      return { value: null as number | null, at: null as Date | null };
    };
    const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
    const dox = latest('dissolvedOxygen');
    const ph = latest('ph');
    const temp = latest('temperature');
    const sal = latest('salinity');
    const amm = latest('ammonia');
    const alk = latest('alkalinity');
    return {
      dissolvedOxygen: dox.value,
      ph: ph.value,
      temperature: temp.value,
      salinity: sal.value,
      ammonia: amm.value,
      nitrite: latest('nitrite').value,
      nitrate: latest('nitrate').value,
      alkalinity: alk.value,
      recordedAt: iso(records[0].recordedAt as unknown as Date),
      dissolvedOxygenAsOf: iso(dox.at),
      phAsOf: iso(ph.at),
      temperatureAsOf: iso(temp.at),
      salinityAsOf: iso(sal.at),
      chemistryAsOf: iso(amm.at),
      alkalinityAsOf: iso(alk.at),
    };
  }

  /** Live population = stocking count − cumulative (estimated) mortality, ≥ 0. */
  estimateLivePopulation(
    stockingCount: number | null | undefined,
    cumulativeMortality: number,
  ): number | null {
    if (stockingCount == null) return null;
    return Math.max(0, Math.round(stockingCount - cumulativeMortality));
  }

  /** Standing biomass (kg) = population × ABW / 1000. */
  biomass(livePopulation: number | null, abwG: number | null): number | null {
    if (livePopulation == null || abwG == null) return null;
    return round2((livePopulation * abwG) / 1000);
  }

  /** Running FCR = cumulative feed / standing biomass (jala §10). */
  runningFcr(
    cumulativeFeedKg: number,
    biomassKg: number | null,
  ): number | null {
    if (biomassKg == null || biomassKg <= 0) return null;
    return round2(cumulativeFeedKg / biomassKg);
  }

  /**
   * Data-confidence score from input completeness + freshness. A present value
   * within its freshness window scores full weight; an absent one scores 0; a
   * stale one decays toward a 0.3 floor. So "all values fed and current" → high
   * confidence, "ammonia missing or 3 weeks old" → lower.
   */
  computeConfidence(factors: ConfidenceFactor[]): DataConfidence {
    const freshness = (ageDays: number | null, window: number) => {
      if (ageDays == null) return 0;
      if (ageDays <= window) return 1;
      return Math.max(0.3, 1 - (ageDays - window) / window);
    };
    let got = 0;
    let total = 0;
    const missing: string[] = [];
    const stale: string[] = [];
    for (const f of factors) {
      total += f.weight;
      if (!f.present) {
        missing.push(f.key);
        continue;
      }
      const fr = freshness(f.ageDays, f.freshWindowDays);
      got += f.weight * fr;
      if (fr < 1) stale.push(f.key);
    }
    const score = total > 0 ? Math.round((got / total) * 100) : 0;
    const band: DataConfidence['band'] =
      score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low';
    return { score, band, missing, stale };
  }

  async getContext(pondId: string, userId: string): Promise<PondContext> {
    // Dashboard read — READ is enough (owner, manager, worker, viewer).
    const pond = await this.pondsService.findOneAccessible(pondId, userId, 'READ');
    const cropId = pond.activeCycleId ?? null;

    // Everything below only depends on pondId/cropId (known once the pond is
    // fetched), not on each other — fan out instead of awaiting one-by-one.
    // Mortality and feed use a SQL SUM instead of loading every row into JS.
    const [crop, wqRecords, sampling, mortalityAgg, feedAgg, tray] =
      await Promise.all([
        cropId
          // Member-aware crop read: this is a dashboard path and must NOT go
          // through the VIEW_FINANCIALS-strict cropsService.findOne. We pass
          // the pond we just cleared above so the crop read doesn't re-fetch
          // and re-check the very same pond three lines later.
          ? this.cropsService.findOneForVerifiedPond(cropId, pond.id, userId)
          : Promise.resolve(null),
        // Latest non-null value per WQ parameter across recent records.
        this.wqRepo.find({
          where: { pondId },
          order: { recordedAt: 'DESC' },
          take: 60,
        }),
        // Latest sampling for this pond (prefer the active crop).
        this.samplingRepo.findOne({
          where: cropId ? { pondId, cropId } : { pondId },
          order: { samplingDate: 'DESC' },
        }),
        cropId
          ? this.mortalityRepo
              .createQueryBuilder('m')
              .select('SUM(m.estimatedTotal)', 'total')
              .where('m.cropId = :cropId', { cropId })
              .getRawOne()
          : Promise.resolve(null),
        cropId
          ? this.feedRepo
              .createQueryBuilder('feed')
              .select('SUM(feed.quantityKg)', 'totalFeed')
              .addSelect('MAX(feed.recordedAt)', 'lastFeedAt')
              .where('feed.cropId = :cropId', { cropId })
              .getRawOne()
          : Promise.resolve(null),
        cropId
          ? this.trayRepo.findOne({
              where: { cropId },
              order: { checkDate: 'DESC' },
            })
          : Promise.resolve(null),
      ]);

    return this.buildContext(pond, {
      crop,
      wqRecords,
      sampling,
      mortalityAgg,
      feedAgg,
      tray,
    });
  }

  /**
   * Assemble one context from data that has ALREADY been fetched.
   *
   * Split out so the single-pond path (`getContext`, one pond at a time) and
   * the whole-farm path (`getFarmContexts`, one set-based query per data type)
   * produce byte-identical results from the same code. The arithmetic lives
   * here exactly once; only the FETCHING strategy differs between them.
   *
   * Access is the caller's job — this method performs no checks and must
   * never be handed a pond the caller has not already cleared.
   */
  private buildContext(
    pond: Pond,
    deps: {
      crop: Crop | null;
      wqRecords: WaterQualityRecord[];
      sampling: SamplingData | null;
      mortalityAgg: { total?: number | string | null } | null;
      feedAgg: {
        totalFeed?: number | string | null;
        lastFeedAt?: Date | string | null;
      } | null;
      tray: FeedingTrayCheck | null;
    },
  ): PondContext {
    const { crop, wqRecords, sampling, mortalityAgg, feedAgg, tray } = deps;
    const pondId = pond.id;
    const cropId = pond.activeCycleId ?? null;
    const areaM2 = Number(pond.overrideAreaM2 ?? pond.calculatedAreaM2) || null;
    const installedAeratorHp =
      pond.installedAeratorHp != null ? Number(pond.installedAeratorHp) : null;

    const wq = this.resolveWaterQuality(wqRecords);
    const abwG = sampling?.mbwG != null ? Number(sampling.mbwG) : null;
    const samplingAt = sampling?.samplingDate
      ? new Date(sampling.samplingDate).toISOString()
      : null;

    // Cumulative estimated mortality for the active crop.
    const cumulativeMortality = Number(mortalityAgg?.total) || 0;
    const livePopulation = this.estimateLivePopulation(
      crop?.stockingCount,
      cumulativeMortality,
    );

    const freeAmmoniaMgL =
      wq?.ammonia != null && wq?.ph != null && wq?.temperature != null
        ? this.calc.calculateFreeAmmonia(
            Number(wq.ammonia),
            Number(wq.ph),
            Number(wq.temperature),
            wq?.salinity != null ? Number(wq.salinity) : 0,
          ).unionizedAmmonia
        : null;

    const biomassKg = this.biomass(livePopulation, abwG);

    // Continuous loop metrics: cumulative feed, running FCR, latest tray residue.
    let cumulativeFeedKg: number | null = null;
    let latestTrayResidue: PondContext['latestTrayResidue'] = null;
    let lastFeedAt: string | null = null;
    let lastTrayAt: string | null = null;
    if (cropId) {
      cumulativeFeedKg = round2(Number(feedAgg?.totalFeed) || 0);
      lastFeedAt = feedAgg?.lastFeedAt
        ? new Date(feedAgg.lastFeedAt).toISOString()
        : null;

      const status = tray?.remainingFeedStatus;
      if (
        status === 'empty' ||
        status === 'few_left' ||
        status === 'a_lot_left'
      ) {
        latestTrayResidue = status;
      }
      lastTrayAt = tray?.checkDate
        ? new Date(tray.checkDate).toISOString()
        : null;
    }
    const runningFcr =
      cumulativeFeedKg != null
        ? this.runningFcr(cumulativeFeedKg, biomassKg)
        : null;

    // Confidence from input completeness + freshness. Daily probe params have a
    // 1-day window; weekly chemistry ~10d; ABW ~14d.
    const now = Date.now();
    const ageDays = (iso: string | null) =>
      iso ? (now - new Date(iso).getTime()) / 86400000 : null;
    const confidence = this.computeConfidence([
      {
        key: 'DO',
        present: wq?.dissolvedOxygen != null,
        ageDays: ageDays(wq?.dissolvedOxygenAsOf ?? null),
        weight: 2,
        freshWindowDays: 1,
      },
      {
        key: 'pH',
        present: wq?.ph != null,
        ageDays: ageDays(wq?.phAsOf ?? null),
        weight: 1.5,
        freshWindowDays: 1,
      },
      {
        key: 'Temperature',
        present: wq?.temperature != null,
        ageDays: ageDays(wq?.temperatureAsOf ?? null),
        weight: 1.5,
        freshWindowDays: 1,
      },
      {
        key: 'Salinity',
        present: wq?.salinity != null,
        ageDays: ageDays(wq?.salinityAsOf ?? null),
        weight: 1,
        freshWindowDays: 1,
      },
      {
        key: 'Ammonia',
        present: wq?.ammonia != null,
        ageDays: ageDays(wq?.chemistryAsOf ?? null),
        weight: 2,
        freshWindowDays: 10,
      },
      {
        key: 'Alkalinity',
        present: wq?.alkalinity != null,
        ageDays: ageDays(wq?.alkalinityAsOf ?? null),
        weight: 1,
        freshWindowDays: 14,
      },
      {
        key: 'Body weight',
        present: abwG != null,
        ageDays: ageDays(samplingAt),
        weight: 2,
        freshWindowDays: 14,
      },
      {
        key: 'Population',
        present: livePopulation != null,
        ageDays: 0,
        weight: 1,
        freshWindowDays: 9999,
      },
    ]);

    return {
      pondId,
      cropId,
      species: crop?.species?.scientificName ?? crop?.speciesType ?? null,
      areaM2,
      installedAeratorHp,
      doc: crop?.computedDOC ?? null,
      waterQuality: wq,
      freeAmmoniaMgL,
      abwG,
      livePopulation,
      biomassKg,
      crop: crop
        ? {
            stockingCount:
              crop.stockingCount != null ? Number(crop.stockingCount) : null,
            carryingCapacityKgM2:
              crop.carryingCapacityKgM2 != null
                ? Number(crop.carryingCapacityKgM2)
                : null,
            feedPriceRpPerKg:
              crop.feedPriceRpPerKg != null
                ? Number(crop.feedPriceRpPerKg)
                : null,
            targetSrPercent:
              crop.targetSrPercent != null
                ? Number(crop.targetSrPercent)
                : null,
            targetSize:
              crop.targetSize != null ? Number(crop.targetSize) : null,
            targetCultivationDays:
              crop.targetCultivationDays != null
                ? Number(crop.targetCultivationDays)
                : null,
          }
        : null,
      cumulativeFeedKg,
      runningFcr,
      latestTrayResidue,
      lastFeedAt,
      lastTrayAt,
      samplingAt,
      confidence,
    };
  }
}

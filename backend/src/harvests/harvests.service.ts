import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Harvest } from './harvest.entity';
import { CreateHarvestDto } from './dto/create-harvest.dto';
import { UpdateHarvestDto } from './dto/update-harvest.dto';
import { CropsService } from '../crops/crops.service';
import { FarmAccessService } from '../farm-access/farm-access.service';
import { toIstDateString } from '../common/ist-date';

/**
 * A harvest sale, projected into the shape the Money tab's entry list renders.
 *
 * `id` is deliberately NOT a transaction id — it is prefixed, and `source` says
 * what it is — so the UI cannot offer edit/delete on a row that has no
 * transaction behind it.
 */
export interface HarvestMoneyEntry {
  id: string;
  source: 'harvest';
  farmId: string;
  transactionDate: string;
  type: 'income';
  category: string;
  amount: number;
  description: string;
  buyerName?: string;
  weightKg?: number;
  pondId: string | null;
  pondName: string | null;
  /** The pond this sale came from is retired. Marked, never hidden (D3). */
  archived: boolean;
}

const asDateString = (d: unknown): string =>
  typeof d === 'string' ? d.slice(0, 10) : toIstDateString(new Date(d as any));

@Injectable()
export class HarvestsService {
  constructor(
    @InjectRepository(Harvest)
    private harvestsRepository: Repository<Harvest>,
    private cropsService: CropsService,
    private readonly farmAccess: FarmAccessService,
  ) {}

  async create(createDto: CreateHarvestDto, userId: string) {
    // Idempotent replay guard — a queued-then-retried harvest must not
    // double-insert or run closeCycle twice (double-counting biomass/revenue).
    // Verify the caller can access the found row's farm BEFORE returning it so
    // a replay with a guessed id can't leak another farm's harvest.
    if (createDto.id) {
      const existing = await this.harvestsRepository.findOne({
        where: { id: createDto.id },
        relations: ['crop'],
      });
      if (existing) {
        await this.farmAccess.assertCanAccessPond(
          userId,
          existing.crop.pondId,
          'RECORD_HARVEST',
        );
        return existing;
      }
    }

    // A harvest closes a cycle and books revenue — it is not a pH reading, and
    // it does not ride WRITE_OPERATIONAL. Owner/manager by default; an owner
    // can grant it to a role or to one person (roleSatisfies resolves both).
    const crop = await this.cropsService.findOneAccessible(
      createDto.cropId,
      userId,
    );
    await this.farmAccess.assertCanAccessPond(
      userId,
      crop.pondId,
      'RECORD_HARVEST',
    );

    const harvest = this.harvestsRepository.create({
      ...createDto,
      createdById: userId,
    });
    const savedHarvest = await this.harvestsRepository.save(harvest);

    if (createDto.harvestType === 'full') {
      await this.cropsService.closeCycle(
        createDto.cropId,
        createDto.harvestDate,
        userId,
      );
    }

    return savedHarvest;
  }

  /**
   * `pondId` gives a pond's CONTINUOUS harvest history — every harvest across
   * every crop cycle it has ever run. `cropId` cannot express that: harvests
   * hang off a crop, and a pond gets a new crop each cycle, so a farmer asking
   * "what has this pond produced?" previously had to be asked back "which of
   * your cycles?" — or, in the app, was shown every harvest on every farm.
   */
  async findAll(userId: string, cropId?: string, pondId?: string) {
    // Scope to farms the caller can access — cropId alone is an optional
    // filter, never the ownership boundary (was leaking every farm's harvests,
    // including sale prices, when omitted).
    const farmIds = await this.farmAccess.getAccessibleFarmIds(userId);
    if (farmIds.length === 0) return [];

    // A worker restricted to specific ponds must not see the whole farm's
    // harvests just because the row hangs off a crop rather than a pond.
    const pondIds = (
      await Promise.all(
        farmIds.map((farmId) =>
          this.farmAccess.getAccessiblePondIds(userId, farmId),
        ),
      )
    ).flat();
    if (pondIds.length === 0) return [];

    const qb = this.harvestsRepository
      .createQueryBuilder('harvest')
      .innerJoin('harvest.crop', 'crop')
      .innerJoin('crop.pond', 'pond')
      .addSelect('pond.farmId', 'row_farm_id')
      .where('pond.farmId IN (:...farmIds)', { farmIds })
      .andWhere('crop.pondId IN (:...pondIds)', { pondIds })
      .orderBy('harvest.harvestDate', 'DESC');
    if (cropId) qb.andWhere('harvest.cropId = :cropId', { cropId });
    // Filters WITHIN the pond scope established above — never widens it.
    if (pondId) qb.andWhere('crop.pondId = :pondId', { pondId });
    // ponytail: bounded cap to avoid an unbounded payload; paginate if needed.
    const { entities, raw } = await qb.take(500).getRawAndEntities();

    // A sale price is a financial. This list is an operational history (what
    // came out of this pond), so it stays readable by every member — but the
    // money on it is masked per farm unless the caller holds VIEW_FINANCIALS
    // there, matching `findMoneyEntries`. Masking beats dropping the row: the
    // worker still gets their harvest weights.
    const financialFarmIds = new Set(
      await this.farmAccess.getFarmIdsWithCapability(userId, 'VIEW_FINANCIALS'),
    );
    return entities.map((h, i) =>
      financialFarmIds.has(raw[i]?.row_farm_id)
        ? h
        : ({ ...h, salePriceTotal: null, buyerName: null } as Harvest),
    );
  }

  /**
   * Harvest sales as Money-tab line items — READ-ONLY projections, not rows.
   *
   * Reported as "after giving a harvest with some profit, that profit is not
   * shown in the money tab". It WAS in the headline: `getFinancialReport` sums
   * every harvest's `salePriceTotal` into revenue. What was missing is a line
   * the farmer can point at — the entry list under the hero renders the
   * `transactions` table only, and a harvest never writes one.
   *
   * The fix is emphatically NOT to write a Transaction when a harvest is
   * created: `getFinancialReport` sums harvest sale prices AND the transactions
   * table, so that would double-count every harvest in revenue and profit.
   * Merging at read time keeps one source of truth per number.
   *
   * Scoped to VIEW_FINANCIALS farms — a sale price is a financial, and this is
   * narrower than `findAll`'s merely-accessible scoping on purpose. It matches
   * `transactionsService.findAll`, whose output these rows are merged with.
   */
  async findMoneyEntries(
    userId: string,
    q?: {
      startDate?: string;
      endDate?: string;
      includeArchivedPonds?: boolean;
    },
  ): Promise<HarvestMoneyEntry[]> {
    const farmIds = await this.farmAccess.getFarmIdsWithCapability(
      userId,
      'VIEW_FINANCIALS',
    );
    if (farmIds.length === 0) return [];

    const qb = this.harvestsRepository
      .createQueryBuilder('harvest')
      .innerJoin('harvest.crop', 'crop')
      .innerJoin('crop.pond', 'pond')
      .where('pond.farmId IN (:...farmIds)', { farmIds });

    /**
     * The same two filters the report applies to the revenue it puts in the
     * headline, applied HERE rather than by the caller in memory.
     *
     * D3: the Money tab's "count archived ponds" toggle dropped a retired
     * pond's revenue from the total (the report skips the pond entirely) and
     * kept its harvest sale rows in the list underneath — a line item the
     * total above it did not contain.
     *
     * And the date range has to be SQL, not a `.filter()` after the fact: the
     * read is capped at 500 rows, so filtering afterwards made "this week"
     * search only the 500 most recent harvests instead of the week's.
     */
    if (q?.includeArchivedPonds === false) {
      qb.andWhere("pond.status <> 'archived'");
    }
    // `harvests.harvest_date` is a plain DATE column, so `YYYY-MM-DD` bounds
    // compare directly — no IST instant conversion, same as `expenses.date`.
    if (q?.startDate)
      qb.andWhere('harvest.harvestDate >= :startDate', {
        startDate: q.startDate,
      });
    if (q?.endDate)
      qb.andWhere('harvest.harvestDate <= :endDate', { endDate: q.endDate });

    const rows = await qb
      // A harvest logged with no sale price yet is NOT ₹0 of revenue — it is a
      // sale that has not happened. It contributes nothing to the report's
      // revenue either, so listing it would put a line item on screen that the
      // total above it does not contain. Same for a zero.
      .andWhere('harvest.salePriceTotal IS NOT NULL')
      .andWhere('harvest.salePriceTotal > 0')
      .select('harvest.id', 'id')
      .addSelect('harvest.harvestDate', 'harvestDate')
      .addSelect('harvest.salePriceTotal', 'salePriceTotal')
      .addSelect('harvest.weightKg', 'weightKg')
      .addSelect('harvest.buyerName', 'buyerName')
      .addSelect('pond.id', 'pondId')
      .addSelect('pond.farmId', 'farmId')
      .addSelect('pond.name', 'pondName')
      .addSelect('pond.status', 'pondStatus')
      .addSelect('crop.name', 'cropName')
      .orderBy('harvest.harvestDate', 'DESC')
      // ponytail: same bounded cap as findAll; paginate if a farm ever needs it.
      .take(500)
      .getRawMany<Record<string, any>>();

    return rows.map((r) => ({
      id: `harvest:${r.id}`,
      source: 'harvest' as const,
      farmId: r.farmId,
      transactionDate: asDateString(r.harvestDate),
      type: 'income' as const,
      category: 'Harvest',
      description: [r.pondName, r.cropName].filter(Boolean).join(' · '),
      amount: Number(r.salePriceTotal) || 0,
      buyerName: r.buyerName ?? undefined,
      weightKg: r.weightKg == null ? undefined : Number(r.weightKg),
      pondId: r.pondId ?? null,
      pondName: r.pondName ?? null,
      // Marked, never hidden (D3) — same flag the pond-cost rows carry, so the
      // client colours both from one rule.
      archived: r.pondStatus === 'archived',
    }));
  }

  async findOne(id: string): Promise<Harvest> {
    const harvest = await this.harvestsRepository.findOneBy({ id });
    if (!harvest) {
      throw new NotFoundException(`Harvest with ID ${id} not found`);
    }
    return harvest;
  }

  /**
   * Load a harvest and prove the caller may record harvests on its pond.
   *
   * The route guard says the same thing, but the service is where it is
   * enforced: `update`/`remove` are also reachable from other services, and a
   * guard on the HTTP layer proves nothing about those.
   */
  private async assertCanRecord(id: string, userId: string): Promise<Harvest> {
    const harvest = await this.harvestsRepository.findOne({
      where: { id },
      relations: ['crop'],
    });
    if (!harvest) {
      throw new NotFoundException(`Harvest with ID ${id} not found`);
    }
    await this.farmAccess.assertCanAccessPond(
      userId,
      harvest.crop.pondId,
      'RECORD_HARVEST',
    );
    return harvest;
  }

  async update(
    id: string,
    dto: UpdateHarvestDto,
    userId: string,
  ): Promise<Harvest> {
    await this.assertCanRecord(id, userId);
    await this.harvestsRepository.update(id, { ...dto, updatedById: userId });
    return this.findOne(id);
  }

  async remove(id: string, userId: string): Promise<{ message: string }> {
    await this.assertCanRecord(id, userId);
    await this.harvestsRepository.delete(id);
    return { message: 'Harvest deleted successfully' };
  }
}

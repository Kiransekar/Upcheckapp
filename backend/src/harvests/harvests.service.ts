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
          'WRITE_MANAGEMENT',
        );
        return existing;
      }
    }

    const harvest = this.harvestsRepository.create(createDto);
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

    const qb = this.harvestsRepository
      .createQueryBuilder('harvest')
      .innerJoin('harvest.crop', 'crop')
      .innerJoin('crop.pond', 'pond')
      .where('pond.farmId IN (:...farmIds)', { farmIds })
      .orderBy('harvest.harvestDate', 'DESC');
    if (cropId) qb.andWhere('harvest.cropId = :cropId', { cropId });
    // Filters WITHIN the farm scope established above — never widens it.
    if (pondId) qb.andWhere('crop.pondId = :pondId', { pondId });
    // ponytail: bounded cap to avoid an unbounded payload; paginate if needed.
    return qb.take(500).getMany();
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
  async findMoneyEntries(userId: string): Promise<HarvestMoneyEntry[]> {
    const farmIds = await this.farmAccess.getFarmIdsWithCapability(
      userId,
      'VIEW_FINANCIALS',
    );
    if (farmIds.length === 0) return [];

    const rows = await this.harvestsRepository
      .createQueryBuilder('harvest')
      .innerJoin('harvest.crop', 'crop')
      .innerJoin('crop.pond', 'pond')
      .where('pond.farmId IN (:...farmIds)', { farmIds })
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
      .addSelect('pond.farmId', 'farmId')
      .addSelect('pond.name', 'pondName')
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
    }));
  }

  async findOne(id: string): Promise<Harvest> {
    const harvest = await this.harvestsRepository.findOneBy({ id });
    if (!harvest) {
      throw new NotFoundException(`Harvest with ID ${id} not found`);
    }
    return harvest;
  }

  async update(id: string, dto: UpdateHarvestDto): Promise<Harvest> {
    await this.findOne(id);
    await this.harvestsRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<{ message: string }> {
    await this.findOne(id);
    await this.harvestsRepository.delete(id);
    return { message: 'Harvest deleted successfully' };
  }
}

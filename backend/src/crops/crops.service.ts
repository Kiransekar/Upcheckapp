import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import { Crop, computeDoc } from './crop.entity';
import { CreateCropDto } from './dto/create-crop.dto';
import { UpdateCropDto } from './dto/update-crop.dto';
import { HarvestCropDto } from './dto/harvest-crop.dto';
import { Pond } from '../ponds/pond.entity';
import { PondsService } from '../ponds/ponds.service';
import type { FarmCapability } from '../farm-access/farm-capability';

@Injectable()
export class CropsService {
  constructor(
    @InjectRepository(Crop)
    private cropsRepository: Repository<Crop>,
    private pondsService: PondsService,
    private dataSource: DataSource,
  ) {}

  async create(createCropDto: CreateCropDto, userId: string) {
    // Starting a cycle is WRITE_MANAGEMENT (owner + manager) — matching the
    // route guard. Owner-only findOne here used to 403 a manager who had
    // already passed that guard.
    const owned = await this.pondsService.findOneAccessible(
      createCropDto.pondId,
      userId,
      'WRITE_MANAGEMENT',
    );

    // Default status to 'active' — and use the SAME resolved value below so a
    // cycle created without an explicit status still links to the pond.
    const finalStatus = createCropDto.status || 'active';
    const isActive = finalStatus === 'active';

    // Calculate Stocking Density
    let stockingDensity = createCropDto.stockingDensity;
    if (owned.calculatedAreaM2 || owned.overrideAreaM2) {
      const area = owned.overrideAreaM2 || owned.calculatedAreaM2;
      if (area > 0 && createCropDto.stockingCount) {
        stockingDensity = Math.round(createCropDto.stockingCount / area);
      }
    }

    // Serialize the check-then-set on activeCycleId behind a row lock so two
    // concurrent CreateCycle requests for the same pond can't both read
    // activeCycleId=null and both create an 'active' crop (last-write-wins would
    // leave two active cycles, breaking DOC / density / P&L invariants).
    return this.dataSource.transaction(async (manager) => {
      const pond = isActive
        ? await manager.findOne(Pond, {
            where: { id: createCropDto.pondId },
            lock: { mode: 'pessimistic_write' },
          })
        : owned;

      if (isActive && pond?.activeCycleId) {
        throw new ConflictException(
          'Pond already has an active cycle. Close it first before starting a new one.',
        );
      }

      const crop = manager.create(Crop, {
        pondId: createCropDto.pondId,
        name: createCropDto.name,
        cropCode: createCropDto.cropCode,
        speciesType: createCropDto.speciesType,
        seedType: createCropDto.seedType,
        stockingCount: createCropDto.stockingCount,
        stockingDate: createCropDto.stockingDate,
        expectedHarvestDate: createCropDto.expectedHarvestDate,
        status: finalStatus,
        stockingDensity,
        // Stocking detail + cycle targets — undefined values fall back to the
        // entity column defaults (carrying capacity 1.25, target SR 75, etc.).
        totalSeed: createCropDto.totalSeed,
        feedPriceRpPerKg: createCropDto.feedPriceRpPerKg,
        carryingCapacityKgM2: createCropDto.carryingCapacityKgM2,
        targetCultivationDays: createCropDto.targetCultivationDays,
        targetSize: createCropDto.targetSize,
        targetSrPercent: createCropDto.targetSrPercent,
        srPredictionMethod: createCropDto.srPredictionMethod,
        initialAgeDays: createCropDto.initialAgeDays,
        preparationDays: createCropDto.preparationDays,
        totalFeedingTrays: createCropDto.totalFeedingTrays,
        hatcheryId: createCropDto.hatcheryId,
        speciesId: createCropDto.speciesId,
        broodstockId: createCropDto.broodstockId,
      });
      const savedCrop = await manager.save(crop);

      // Link as the pond's active cycle inside the same locked transaction.
      if (isActive && pond) {
        pond.activeCycleId = savedCrop.id;
        // AND move the pond out of 'fallow'. These two fields describe the same
        // fact and were allowed to disagree: a pond could hold an active cycle
        // while still reporting status 'fallow'. Every screen that asked "is
        // this pond stocked?" via status then answered no — so Farms, Ponds and
        // the pond page all showed a running cycle as empty and kept offering
        // "Start a cycle" for a pond that already had one.
        pond.status = 'active';
        await manager.save(pond);
      }

      return savedCrop;
    });
  }

  async findAll(pondId: string, userId: string) {
    if (!pondId) {
      // Similar to WaterQuality, return empty or implement user-based filtering if needed
      return [];
    }

    // Verify user owns the pond
    await this.pondsService.verifyOwner(pondId, userId);

    return this.cropsRepository.find({
      where: { pondId },
      order: { createdAt: 'DESC' },
    });
  }


  /**
   * VIEW_FINANCIALS crop read (owner + manager). This is the economics path —
   * P&L, cycle analysis. For anything user-facing that is NOT financial, use
   * `findOneAccessible`, which is member-aware at READ. Keeping both makes the
   * distinction explicit; picking the wrong one either 403s a legitimate
   * manager or leaks farm economics to a worker.
   */
  async findOne(id: string, userId: string) {
    const crop = await this.cropsRepository.findOneBy({ id });
    if (!crop) {
      throw new NotFoundException(`Crop with ID ${id} not found`);
    }
    // STRICT — this path feeds economics/PNL. Express that intent as the
    // capability that actually means it (owner + manager) rather than
    // owner-only, so it matches CAPABILITY_ROLES. `reports.getCycleAnalysis`
    // inherits the right behaviour from here.
    await this.pondsService.findOneAccessible(
      crop.pondId,
      userId,
      'VIEW_FINANCIALS',
    );
    return this.enrichWithDOC(crop);
  }

  /**
   * Member-aware crop read (owner or worker). Does NOT feed economics.
   *
   * `capability` exists for the harvest paths: closing a cycle must be gated on
   * RECORD_HARVEST, not on VIEW_FINANCIALS (`findOne`). Using `findOne` there
   * 403'd exactly the member the RECORD_HARVEST grant was built for — a worker
   * or a books-blind manager — AFTER the harvest row had already been saved.
   */
  async findOneAccessible(
    id: string,
    userId: string,
    capability: FarmCapability = 'READ',
  ) {
    const crop = await this.cropsRepository.findOneBy({ id });
    if (!crop) {
      throw new NotFoundException(`Crop with ID ${id} not found`);
    }
    await this.pondsService.verifyAccess(crop.pondId, userId, capability);
    return this.enrichWithDOC(crop);
  }

  /**
   * Same READ semantics as `findOneAccessible`, for a caller that has ALREADY
   * cleared the crop's pond at READ in the same request. `findOneAccessible`
   * would re-fetch that identical pond and re-run the identical check — one
   * wasted query per pond for an owner, three for a worker/viewer (the owner
   * fast-path misses, so each re-check adds a membership lookup).
   *
   * `verifiedPondId` is what makes skipping safe: if the crop does not in fact
   * belong to the pond the caller cleared (a stale `pond.activeCycleId`, say),
   * the caller's grant proves nothing about it, so we fall through to the full
   * check rather than trusting it.
   */
  async findOneForVerifiedPond(
    id: string,
    verifiedPondId: string,
    userId: string,
  ) {
    const crop = await this.cropsRepository.findOneBy({ id });
    if (!crop) {
      throw new NotFoundException(`Crop with ID ${id} not found`);
    }
    if (crop.pondId !== verifiedPondId) {
      await this.pondsService.verifyAccess(crop.pondId, userId, 'READ');
    }
    return this.enrichWithDOC(crop);
  }

  /** Member-aware crop list for a pond (owner or worker). */
  async findAllAccessible(pondId: string, userId: string) {
    if (!pondId) return [];
    await this.pondsService.verifyAccess(pondId, userId, 'READ');
    return this.cropsRepository.find({
      where: { pondId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Compute Day of Culture (DOC) dynamically based on stockingDate vs current date.
   * Accounts for initialAgeDays at stocking time.
   * Returns 0 if stockingDate is not set or is in the future.
   */
  computeDOC(crop: Crop): number {
    // Shared IST-calendar DOC (stocking day = 1); 0 when unstocked/future so
    // the API response keeps its numeric shape.
    return computeDoc(crop.stockingDate, crop.initialAgeDays) ?? 0;
  }

  /**
   * Attach computed DOC to a crop object for API responses.
   * The stored `doc` column is not updated — DOC is always computed dynamically.
   */
  private enrichWithDOC(crop: Crop) {
    return {
      ...crop,
      computedDOC: this.computeDOC(crop),
    };
  }

  async update(id: string, updateCropDto: UpdateCropDto, userId: string) {
    // Matches the route's WRITE_MANAGEMENT gate. `findOne` would demand
    // VIEW_FINANCIALS and 403 a member the owner granted WRITE_MANAGEMENT.
    await this.findOneAccessible(id, userId, 'WRITE_MANAGEMENT');
    await this.cropsRepository.update(id, updateCropDto);
    return this.findOneAccessible(id, userId, 'WRITE_MANAGEMENT');
  }

  async remove(id: string, userId: string) {
    const crop = await this.findOne(id, userId); // VIEW_FINANCIALS, see above

    // Deleting a cycle is OWNER_ONLY — assert it here rather than relying on
    // the route guard alone. An owner satisfies both this and the
    // VIEW_FINANCIALS check in findOne above; a manager clears findOne and is
    // stopped here, which is the intended outcome.
    const pond = await this.pondsService.findOneAccessible(
      crop.pondId,
      userId,
      'OWNER_ONLY',
    );
    if (pond.activeCycleId === id) {
      await this.pondsService.update(
        pond.id,
        { activeCycleId: null, status: 'fallow' } as any,
        userId,
      );
    }

    return this.cropsRepository.delete(id);
  }

  async harvest(id: string, harvestData: HarvestCropDto, userId: string) {
    // Completing a cycle IS recording a harvest — gate it on the capability
    // that says so, not on VIEW_FINANCIALS (which 403s a granted worker) and
    // not on the general WRITE_MANAGEMENT key (which would let a member the
    // owner explicitly blocked from harvesting close the cycle anyway).
    const crop = await this.findOneAccessible(id, userId, 'RECORD_HARVEST');

    // Assign only the two whitelisted fields — never spread the raw body, which
    // would let a caller overwrite arbitrary crop columns. Terminal status is
    // 'completed' (matching closeCycle and the entity's documented states) so
    // the same real event never lands in two different states.
    await this.cropsRepository.update(id, {
      actualHarvestDate: new Date(harvestData.actualHarvestDate),
      harvestWeightKg: harvestData.harvestWeightKg,
      status: 'completed',
    });

    // Unlink from ponds activeCycleId. Harvesting is RECORD_HARVEST.
    const pond = await this.pondsService.findOneAccessible(
      crop.pondId,
      userId,
      'RECORD_HARVEST',
    );
    if (pond.activeCycleId === id) {
      await this.pondsService.update(
        pond.id,
        { activeCycleId: null, status: 'fallow' } as any,
        userId,
      );
    }

    return this.findOneAccessible(id, userId, 'RECORD_HARVEST');
  }

  async closeCycle(id: string, actualHarvestDate: string, userId: string) {
    // RECORD_HARVEST, not VIEW_FINANCIALS: this runs inside `harvests.create`
    // for a full harvest, and gating it on the books 403'd the granted worker
    // AFTER the harvest row was already committed — leaving an orphan harvest
    // on a cycle that never closed.
    const crop = await this.findOneAccessible(id, userId, 'RECORD_HARVEST');

    // Idempotent close: the guard `status <> 'completed'` means a
    // double-submitted or concurrently-replayed full harvest closes the cycle
    // exactly once. The second call affects 0 rows and is rejected, so yield /
    // revenue can't be double-counted in reports and P&L.
    const res = await this.cropsRepository.update(
      { id, status: Not('completed') },
      { actualHarvestDate, status: 'completed' },
    );
    if (!res.affected) {
      throw new ConflictException('Cycle is already closed.');
    }

    // Unlink from ponds activeCycleId
    // We can't just set to null blindly, we should check if THIS crop is the active one.
    // But findOne verified ownership via pond.
    // Let's get the pond first to be safe?
    // findOne already calls pondService.findOne(crop.pondId), but doesn't return pond.

    // Closing a cycle is RECORD_HARVEST.
    const pond = await this.pondsService.findOneAccessible(
      crop.pondId,
      userId,
      'RECORD_HARVEST',
    );
    if (pond.activeCycleId === id) {
      await this.pondsService.update(
        pond.id,
        { activeCycleId: null, status: 'fallow' } as any,
        userId,
      );
    }

    return this.findOneAccessible(id, userId, 'RECORD_HARVEST');
  }
}

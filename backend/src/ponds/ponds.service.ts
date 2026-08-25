import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not, IsNull, In } from 'typeorm';
import { Pond } from './pond.entity';
import { PondDimensionHistory } from './pond-dimension-history.entity';
import { Crop } from '../crops/crop.entity';
import { CreatePondDto } from './dto/create-pond.dto';
import { UpdatePondDto } from './dto/update-pond.dto';
import { FarmsService } from '../farms/farms.service';
import { FarmCapability } from '../farm-access/farm-capability';
import { FarmAccessService } from '../farm-access/farm-access.service';
import { PondDimensionService } from './pond-dimension.service';
import { PondNamingService } from './pond-naming.service';
import { PageOptionsDto } from '../common/dto/page-options.dto';
import { PageMetaDto, PageDto } from '../common/dto/page.dto';

@Injectable()
export class PondsService {
  constructor(
    @InjectRepository(Pond)
    private pondsRepository: Repository<Pond>,
    @InjectRepository(PondDimensionHistory)
    private dimensionHistoryRepository: Repository<PondDimensionHistory>,
    private farmsService: FarmsService,
    private dimensionService: PondDimensionService,
    private namingService: PondNamingService,
    private dataSource: DataSource,
    private farmAccess: FarmAccessService,
  ) {}

  /**
   * Create a single pond or batch of ponds.
   */
  async create(createPondDto: CreatePondDto, userId: string) {
    // Route guard is WRITE_MANAGEMENT (owner+manager) — match it here, not
    // the legacy owner-only check, or managers pass the guard then 403 here.
    const farm = await this.farmAccess.assertCanAccessFarm(
      userId,
      createPondDto.farmId,
      'WRITE_MANAGEMENT',
    );
    const batchCount = createPondDto.batchCount ?? 1;

    // Validate prefix
    this.namingService.validatePrefix(createPondDto.namePrefix);

    // Validate pond limit
    await this.namingService.validatePondLimit(farm.id, batchCount);

    // Validate dimensions
    const geometryType = createPondDto.geometryType;
    this.dimensionService.validateDimensions(geometryType, {
      lengthM: createPondDto.lengthM,
      widthM: createPondDto.widthM,
      diameterM: createPondDto.diameterM,
      depthM: createPondDto.depthM,
      channelCount: createPondDto.channelCount,
    });

    // Calculate area
    const calculatedAreaM2 = this.dimensionService.calculateArea(geometryType, {
      lengthM: createPondDto.lengthM,
      widthM: createPondDto.widthM,
      diameterM: createPondDto.diameterM,
      depthM: createPondDto.depthM,
      channelCount: createPondDto.channelCount,
    });

    // Generate names
    const names = await this.namingService.generateBatchNames(
      farm.id,
      farm.farmCode,
      createPondDto.namePrefix,
      batchCount,
    );

    // Build pond entities
    const ponds = names.map((nameInfo) =>
      this.pondsRepository.create({
        farmId: farm.id,
        name: nameInfo.name,
        namePrefix: createPondDto.namePrefix.toUpperCase(),
        sequenceNumber: nameInfo.sequenceNumber,
        pondCode: nameInfo.pondCode,
        displayName: createPondDto.displayName,
        geometryType,
        constructionType: createPondDto.constructionType as any,
        lengthM: createPondDto.lengthM,
        widthM: createPondDto.widthM,
        diameterM: createPondDto.diameterM,
        depthM: createPondDto.depthM,
        installedAeratorHp: createPondDto.installedAeratorHp,
        aeratorCount: createPondDto.aeratorCount,
        channelCount: createPondDto.channelCount,
        calculatedAreaM2,
        overrideAreaM2: createPondDto.overrideAreaM2,
        gpsLat: createPondDto.gpsLat,
        gpsLng: createPondDto.gpsLng,
        boundary: createPondDto.boundary,
        status: 'fallow',
      }),
    );

    // Bulk save in transaction (decision 14A)
    const savedPonds = await this.dataSource.transaction(async (manager) => {
      return manager.save(ponds);
    });

    // Get dimension warnings for response
    const effectiveArea = createPondDto.overrideAreaM2 ?? calculatedAreaM2;
    const warnings = this.dimensionService.getWarnings(
      effectiveArea,
      createPondDto.depthM,
    );

    if (batchCount === 1) {
      return {
        pond: savedPonds[0],
        calculatedAreaM2,
        volumeM3: this.dimensionService.calculateVolume(
          effectiveArea,
          createPondDto.depthM,
        ),
        warnings,
      };
    }

    return {
      ponds: savedPonds.map((p) => ({
        id: p.id,
        pondCode: p.pondCode,
        name: p.name,
      })),
      count: savedPonds.length,
      calculatedAreaM2,
      volumeM3: this.dimensionService.calculateVolume(
        effectiveArea,
        createPondDto.depthM,
      ),
      warnings,
    };
  }

  /**
   * Return all ponds belonging to any farm owned by the given user.
   */
  async findAllForUser(userId: string): Promise<Pond[]> {
    // Ponds across every farm the user can access (owner or worker).
    const farmIds = await this.farmAccess.getAccessibleFarmIds(userId);
    if (farmIds.length === 0) return [];
    return this.pondsRepository
      .createQueryBuilder('pond')
      .innerJoin(
        'farms',
        'farm',
        'farm.id = pond.farm_id AND farm.deleted_at IS NULL',
      )
      .leftJoinAndSelect('pond.activeCycle', 'activeCycle')
      .where('pond.farm_id IN (:...farmIds)', { farmIds })
      .andWhere('pond.status != :archived', { archived: 'archived' })
      .orderBy('pond.name', 'ASC')
      .getMany();
  }

  /**
   * List ponds for a farm with optional filtering, search, sorting, and pagination.
   */
  async findAll(
    farmId: string,
    userId: string,
    options?: {
      status?: string;
      search?: string;
      sort?: string;
      includeArchived?: boolean;
    },
    pageOptionsDto?: PageOptionsDto,
  ): Promise<PageDto<Pond>> {
    // OwnershipGuard handles authorization

    const qb = this.pondsRepository
      .createQueryBuilder('pond')
      .leftJoinAndSelect('pond.activeCycle', 'activeCycle')
      .where('pond.farm_id = :farmId', { farmId });

    // Status filter
    if (options?.status) {
      qb.andWhere('pond.status = :status', { status: options.status });
    } else if (!options?.includeArchived) {
      qb.andWhere('pond.status != :archived', { archived: 'archived' });
    }

    // Search (pond name or display name)
    if (options?.search) {
      qb.andWhere(
        '(pond.name ILIKE :search OR pond.display_name ILIKE :search)',
        { search: `%${options.search}%` },
      );
    }

    // Sorting
    switch (options?.sort) {
      case 'name':
        qb.orderBy('pond.name', 'ASC');
        break;
      case 'updated_at':
        qb.orderBy('pond.updated_at', 'DESC');
        break;
      default:
        qb.orderBy('pond.name', 'ASC');
        break;
    }

    // Pagination
    const skip = pageOptionsDto?.skip || 0;
    const take = pageOptionsDto?.take || 50;
    qb.skip(skip).take(take);

    const [ponds, itemCount] = await qb.getManyAndCount();

    const pageMeta = new PageMetaDto({
      itemCount,
      pageOptionsDto: pageOptionsDto || { page: 1, take },
    });
    return new PageDto(ponds, pageMeta);
  }

  /**
   * #37: the dashboard was reported showing 0 active ponds for a farm with a
   * pond genuinely mid-cycle. CropsService.create() does correctly set
   * pond.activeCycleId transactionally, but this denormalized column is the
   * ONLY thing this count (and the pond's own dashboard) has ever relied on
   * — any future/edge-case path that starts a crop without going through
   * that exact transaction (a bulk import, a manual DB fix, a bug) would
   * silently undercount here with no way to notice. Cross-check against a
   * live active Crop row so a genuinely active pond is never missed just
   * because the denormalized column drifted.
   */
  async countActivePonds(farmId: string): Promise<number> {
    const nonArchivedPonds = await this.pondsRepository.find({
      where: { farmId, status: Not('archived') },
      select: { id: true, activeCycleId: true },
    });
    if (nonArchivedPonds.length === 0) return 0;

    const activePondIds = new Set(
      nonArchivedPonds.filter((p) => p.activeCycleId).map((p) => p.id),
    );

    const activeCrops = await this.dataSource.getRepository(Crop).find({
      where: {
        farmId,
        status: 'active',
        pondId: In(nonArchivedPonds.map((p) => p.id)),
      },
      select: { pondId: true },
    });
    for (const crop of activeCrops) activePondIds.add(crop.pondId);

    return activePondIds.size;
  }

  async countTotalPonds(farmId: string): Promise<number> {
    return this.pondsRepository.count({
      where: { farmId, status: Not('archived') },
    });
  }

  /**
   * OWNER-ONLY pond fetch. Deliberately NOT called `findOne`: sitting next to
   * the member-aware `findOneAccessible`, that name invited every new engine to
   * reach for it and silently 403 managers and workers who the capability
   * matrix says have access — which is exactly the bug W1 fixed across twenty
   * call sites.
   *
   * Use `findOneAccessible(id, userId, capability)` unless the operation really
   * is owner-exclusive. The only caller today is `remove()`, whose route guard
   * is `OWNER_ONLY`, so this check is equal to the guard rather than stricter.
   */
  async findOneAsOwner(id: string, userId: string) {
    const pond = await this.pondsRepository.findOne({
      where: { id },
      relations: ['farm'],
    });

    if (!pond) {
      throw new NotFoundException(`Pond with ID ${id} not found`);
    }

    // Enforce ownership: the pond's farm must belong to the caller.
    if (pond.farm && pond.farm.userId !== userId) {
      throw new ForbiddenException('You do not have access to this pond');
    }

    return pond;
  }

  async update(id: string, updatePondDto: UpdatePondDto, userId: string) {
    // Route guard is WRITE_MANAGEMENT (owner+manager); use the member-aware
    // fetch so a manager who passed the guard is not 403'd by owner-only findOne.
    const pond = await this.findOneAccessible(id, userId, 'WRITE_MANAGEMENT');

    // Check if dimensions changed — log history if so
    // Exclude activeCycleId and other non-dimension fields from dimension check
    const dimensionFields = {
      lengthM: updatePondDto.lengthM,
      widthM: updatePondDto.widthM,
      diameterM: updatePondDto.diameterM,
      depthM: updatePondDto.depthM,
      overrideAreaM2: updatePondDto.overrideAreaM2,
    };

    if (this.dimensionService.hasDimensionsChanged(pond, dimensionFields)) {
      // Log old dimensions to history
      const historyRecord = this.dimensionHistoryRepository.create({
        pondId: pond.id,
        changedByUserId: userId,
        lengthMBefore: pond.lengthM,
        widthMBefore: pond.widthM,
        diameterMBefore: pond.diameterM,
        depthMBefore: pond.depthM,
        calculatedAreaM2Before: pond.calculatedAreaM2,
        overrideAreaM2Before: pond.overrideAreaM2,
        changeReason: updatePondDto.changeReason,
      });
      await this.dimensionHistoryRepository.save(historyRecord);

      // Recalculate area if dimension inputs changed
      const newDimensions = {
        lengthM: updatePondDto.lengthM ?? pond.lengthM,
        widthM: updatePondDto.widthM ?? pond.widthM,
        diameterM: updatePondDto.diameterM ?? pond.diameterM,
        depthM: updatePondDto.depthM ?? pond.depthM,
        channelCount: updatePondDto.channelCount ?? pond.channelCount,
      };

      this.dimensionService.validateDimensions(
        pond.geometryType,
        newDimensions,
      );
      const newArea = this.dimensionService.calculateArea(
        pond.geometryType,
        newDimensions,
      );

      // Remove changeReason from DTO before saving
      // Also ensure activeCycleId is preserved if passed
      const { changeReason, ...updateFields } = updatePondDto;

      await this.pondsRepository.update(id, {
        ...updateFields,
        calculatedAreaM2: newArea,
        activeCycleId: updatePondDto.activeCycleId as any,
      });
    } else {
      const { changeReason, ...updateFields } = updatePondDto;
      await this.pondsRepository.update(id, {
        ...updateFields,
        activeCycleId: updatePondDto.activeCycleId as any,
      });
    }

    return this.findOneAccessible(id, userId, 'READ');
  }

  /**
   * Archive a pond (soft delete).
   * Returns 409 if pond has an active cycle.
   */
  async archive(id: string, userId: string) {
    // WRITE_MANAGEMENT route → member-aware fetch (see update()).
    const pond = await this.findOneAccessible(id, userId, 'WRITE_MANAGEMENT');

    if (pond.activeCycleId) {
      throw new ConflictException({
        error: 'active_cycle_exists',
        message:
          'Cannot archive a pond with an active cycle. Close or harvest the cycle first.',
        cycleId: pond.activeCycleId,
      });
    }

    if (pond.status === 'archived') {
      throw new BadRequestException('Pond is already archived');
    }

    await this.pondsRepository.update(id, {
      status: 'archived',
      archivedAt: new Date(),
    });

    return { message: 'Pond archived successfully' };
  }

  /**
   * Hard delete a pond. Only allowed for ponds with no cycles ever.
   */
  async remove(id: string, userId: string) {
    // Pond deletion is OWNER_ONLY at the route guard; keep the service check
    // equal to it, not stricter and not looser.
    const pond = await this.findOneAsOwner(id, userId);

    if (pond.activeCycleId) {
      throw new ConflictException('Cannot delete a pond with an active cycle');
    }

    // Deleting a pond cascades (onDelete:CASCADE) to ALL of its historical
    // crops, feed, water-quality, harvests, mortality and sampling. Only allow
    // it for a pond that has never held a crop; otherwise the operator must
    // archive it so the production history is preserved.
    const cropCount = await this.dataSource
      .getRepository(Crop)
      .count({ where: { pondId: id } });
    if (cropCount > 0) {
      throw new ConflictException(
        'Cannot delete a pond with crop history — archive it instead',
      );
    }

    await this.pondsRepository.delete(id);
    return { message: 'Pond deleted successfully' };
  }

  /**
   * Get dimension change history for a pond.
   */
  async getDimensionHistory(
    pondId: string,
    userId: string,
    pageOptionsDto?: PageOptionsDto,
  ): Promise<PageDto<PondDimensionHistory>> {
    await this.verifyAccess(pondId, userId, 'READ'); // Owner or worker may view
    const skip = pageOptionsDto?.skip || 0;
    const take = pageOptionsDto?.take || 10;
    const order = pageOptionsDto?.order || 'DESC';

    const [items, itemCount] =
      await this.dimensionHistoryRepository.findAndCount({
        where: { pondId },
        order: { changedAt: order },
        take,
        skip,
      });

    const pageMetaDto = new PageMetaDto({
      itemCount,
      pageOptionsDto: pageOptionsDto || { page: 1, take },
    });
    return new PageDto(items, pageMetaDto);
  }
  /**
   * Lightweight ownership verification.
   */
  async verifyOwner(id: string, userId: string): Promise<void> {
    const pond = await this.pondsRepository.findOne({
      where: { id },
      relations: ['farm'],
      select: {
        id: true,
        farm: {
          id: true,
          userId: true,
        },
      },
    });

    if (!pond) {
      throw new NotFoundException(`Pond with ID ${id} not found`);
    }

    if (pond.farm.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this pond',
      );
    }
  }

  /**
   * Member-aware pond fetch: passes for owner OR worker per the requested
   * capability. Use for worker-permitted operations (field-log create/read).
   * Returns the pond (with farm relation) or throws.
   */
  async findOneAccessible(
    id: string,
    userId: string,
    capability: FarmCapability = 'WRITE_OPERATIONAL',
  ): Promise<Pond> {
    const pond = await this.pondsRepository.findOne({
      where: { id },
      relations: ['farm'],
    });
    if (!pond) {
      throw new NotFoundException(`Pond with ID ${id} not found`);
    }
    // Owner fast-path, else delegate to the membership layer.
    if (!pond.farm || pond.farm.userId !== userId) {
      await this.farmsService.verifyAccess(pond.farmId, userId, capability);
    }
    return pond;
  }

  /** Member-aware lightweight access check (no entity returned). */
  async verifyAccess(
    id: string,
    userId: string,
    capability: FarmCapability = 'WRITE_OPERATIONAL',
  ): Promise<void> {
    await this.findOneAccessible(id, userId, capability);
  }
}

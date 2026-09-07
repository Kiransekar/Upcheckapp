import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeedRecord } from './feed-record.entity';
import { CreateFeedRecordDto } from './dto/create-feed-record.dto';
import { UpdateFeedRecordDto } from './dto/update-feed-record.dto';

import { PondsService } from '../ponds/ponds.service';

import { InventoryService } from '../inventory/inventory.service';
import { PageOptionsDto } from '../common/dto/page-options.dto';
import { PageMetaDto, PageDto } from '../common/dto/page.dto';
import { FarmAccessService } from '../farm-access/farm-access.service';
import { toIstDateString } from '../common/ist-date';

@Injectable()
export class FeedRecordsService {
  constructor(
    @InjectRepository(FeedRecord)
    private recordsRepository: Repository<FeedRecord>,
    private pondsService: PondsService,
    private inventoryService: InventoryService,
    private readonly farmAccess: FarmAccessService,
  ) {}

  async create(createDto: CreateFeedRecordDto, userId: string) {
    // Idempotent replay guard — must run BEFORE the inventory deduction so a
    // queued-then-retried feed record never double-deducts stock. Must also
    // verify the caller can access the found record's farm BEFORE returning
    // it — a replayed op with a guessed id must not leak another farm's record.
    if (createDto.id) {
      const existing = await this.recordsRepository.findOne({
        where: { id: createDto.id },
      });
      if (existing) {
        await this.farmAccess.assertCanAccessPond(
          userId,
          existing.pondId,
          'WRITE_OPERATIONAL',
        );
        return existing;
      }
    }

    // Fasting day enforcement: if isFasting, quantityKg must be 0
    if (createDto.isFasting) {
      if (createDto.quantityKg > 0) {
        throw new BadRequestException(
          'Fasting day: quantityKg must be 0 when isFasting is true',
        );
      }
      createDto.quantityKg = 0;
    }

    // Fetch pond to get activeCycleId and verify access (owner or worker)
    const pond = await this.pondsService.findOneAccessible(
      createDto.pondId,
      userId,
      'WRITE_OPERATIONAL',
    );

    // If inventory item selected, deduct stock (skip for fasting days).
    // WRITE_OPERATIONAL, not MANAGE_INVENTORY: a worker logging a feeding is
    // consuming stock, not managing the catalogue. `expectedFarmId` refuses an
    // item from another farm, so a feed log on this pond can only draw down
    // this pond's farm's stock.
    const shouldDeduct = !!createDto.inventoryItemId && !createDto.isFasting;
    if (shouldDeduct) {
      await this.inventoryService.adjustStock(
        createDto.inventoryItemId!,
        -createDto.quantityKg,
        userId,
        {
          capability: 'WRITE_OPERATIONAL',
          expectedFarmId: pond.farmId,
          reason: 'Feed log',
          // Only known here when the client minted an idempotency-key id
          // up front — a DB-generated id doesn't exist until save() below.
          feedRecordId: createDto.id,
        },
      );
    }

    const record = this.recordsRepository.create({
      id: createDto.id,
      pondId: createDto.pondId,
      cropId: pond.activeCycleId,
      // Client-supplied feeding time wins; omitted → column default (now).
      recordedAt: createDto.recordedAt
        ? new Date(createDto.recordedAt)
        : undefined,
      feedType: createDto.feedType,
      feedBrand: createDto.feedBrand,
      quantityKg: createDto.quantityKg,
      feedingTime: createDto.feedingTime,
      feedingMethod: createDto.feedingMethod,
      waterTemperature: createDto.waterTemperature,
      notes: createDto.isFasting
        ? createDto.notes || 'Fasting day'
        : createDto.notes,
      inventoryItemId: createDto.isFasting ? null : createDto.inventoryItemId,
      createdById: userId,
      updatedById: userId,
    });

    try {
      return await this.recordsRepository.save(record);
    } catch (err) {
      // Compensate the deduction if the record failed to persist, so stock is
      // never phantom-deducted with no matching record. adjustStock runs on the
      // inventory service's own connection, so a shared DB transaction can't
      // roll it back — a compensating credit is the correct fix at this
      // service boundary.
      if (shouldDeduct) {
        await this.inventoryService.adjustStock(
          createDto.inventoryItemId!,
          createDto.quantityKg,
          userId,
          {
            capability: 'WRITE_OPERATIONAL',
            expectedFarmId: pond.farmId,
            reason: 'Feed log failed',
            feedRecordId: createDto.id,
          },
        );
      }
      throw err;
    }
  }

  async findAll(
    userId: string,
    pondId?: string,
    cropId?: string,
    pageOptionsDto?: PageOptionsDto,
  ): Promise<PageDto<FeedRecord>> {
    const skip = pageOptionsDto?.skip || 0;
    const take = pageOptionsDto?.take || 10;
    const order = pageOptionsDto?.order || 'DESC';

    // Scope to farms the caller can access — pondId/cropId are optional
    // filters, never the ownership boundary.
    const farmIds = await this.farmAccess.getAccessibleFarmIds(userId);
    if (farmIds.length === 0) {
      const pageMetaDto = new PageMetaDto({
        itemCount: 0,
        pageOptionsDto: pageOptionsDto || { page: 1, take },
      });
      return new PageDto([], pageMetaDto);
    }

    const qb = this.recordsRepository
      .createQueryBuilder('feed')
      .innerJoin('feed.pond', 'pond')
      .where('pond.farmId IN (:...farmIds)', { farmIds })
      .orderBy('feed.recordedAt', order)
      .take(take)
      .skip(skip);
    if (pondId) qb.andWhere('feed.pondId = :pondId', { pondId });
    if (cropId) qb.andWhere('feed.cropId = :cropId', { cropId });

    const [items, itemCount] = await qb.getManyAndCount();

    const pageMetaDto = new PageMetaDto({
      itemCount,
      pageOptionsDto: pageOptionsDto || { page: 1, take },
    });
    return new PageDto(items, pageMetaDto);
  }

  async findOne(id: string): Promise<FeedRecord> {
    const record = await this.recordsRepository.findOneBy({ id });
    if (!record)
      throw new NotFoundException(`Feed record with ID ${id} not found`);
    return record;
  }

  async update(
    id: string,
    updateDto: UpdateFeedRecordDto,
    userId?: string,
  ): Promise<FeedRecord> {
    const existing = await this.findOne(id);

    // Fasting-day guard applies on PATCH too: a fasting day must have 0 feed.
    // (isFasting alone previously slipped through — it isn't a column and was
    // silently dropped, so the quantity was never checked on update.)
    const resultingQty = updateDto.quantityKg ?? Number(existing.quantityKg);
    if (updateDto.isFasting && resultingQty > 0) {
      throw new BadRequestException(
        'Fasting day: quantityKg must be 0 when isFasting is true',
      );
    }

    // Changing which inventory item a record draws from would need a two-item
    // stock transfer we don't model here — reject it rather than drift stock.
    if (
      updateDto.inventoryItemId !== undefined &&
      updateDto.inventoryItemId !== existing.inventoryItemId
    ) {
      throw new BadRequestException(
        'Changing the inventory item of a feed record is not supported',
      );
    }

    // Reconcile inventory for a changed quantity on the same item so edits do
    // not permanently drift stock (positive delta credits stock back).
    if (
      existing.inventoryItemId &&
      userId &&
      updateDto.quantityKg !== undefined &&
      updateDto.quantityKg !== Number(existing.quantityKg)
    ) {
      const delta = Number(existing.quantityKg) - updateDto.quantityKg;
      await this.inventoryService.adjustStock(
        existing.inventoryItemId,
        delta,
        userId,
        {
          capability: 'WRITE_OPERATIONAL',
          reason: 'Feed log edited',
          feedRecordId: id,
        },
      );
    }

    // isFasting / id are not persisted columns — strip them before the update
    // (id would otherwise reassign the primary key).
    const {
      isFasting: _isFasting,
      id: _id,
      recordedAt,
      ...columns
    } = updateDto;
    await this.recordsRepository.update(id, {
      ...columns,
      ...(recordedAt ? { recordedAt: new Date(recordedAt) } : {}),
      ...(userId ? { updatedById: userId } : {}),
    });
    return this.findOne(id);
  }

  async remove(id: string, userId?: string): Promise<{ message: string }> {
    const existing = await this.findOne(id);
    const shouldRestore = !!existing.inventoryItemId && !!userId;

    // Restore the stock BEFORE deleting the record, mirroring `create` — which
    // deducts first and compensates if the save fails. The other order silently
    // lost stock: the delete committed, then `adjustStock` threw (the item has
    // since been deleted, or this user no longer holds WRITE_OPERATIONAL on one
    // of its paired farms), and the credit never happened. The feed log was
    // gone, so nothing was left to say the store was ever drawn down — the
    // quantity was simply wrong from then on, with no trail explaining it.
    if (shouldRestore) {
      await this.inventoryService.adjustStock(
        existing.inventoryItemId!,
        Number(existing.quantityKg),
        userId!,
        {
          capability: 'WRITE_OPERATIONAL',
          reason: 'Feed log deleted',
          feedRecordId: id,
        },
      );
    }

    try {
      await this.recordsRepository.delete(id);
    } catch (err) {
      // Un-credit, so a failed delete does not leave stock that was never
      // returned sitting on top of a record that still claims to have used it.
      if (shouldRestore) {
        await this.inventoryService.adjustStock(
          existing.inventoryItemId!,
          -Number(existing.quantityKg),
          userId!,
          {
            capability: 'WRITE_OPERATIONAL',
            reason: 'Feed log delete failed',
            feedRecordId: id,
          },
        );
      }
      throw err;
    }
    return { message: 'Feed record deleted successfully' };
  }

  async getTotalFeedByPond(pondId: string): Promise<number> {
    const result = await this.recordsRepository
      .createQueryBuilder('feed')
      .select('SUM(feed.quantityKg)', 'totalFeed')
      .where('feed.pondId = :pondId', { pondId })
      .getRawOne();
    // SUM over a pg `numeric` column comes back as a STRING, so this returned
    // '123.45' where its sibling `getDailyFeedUsage` returns 123.45 — and it is
    // served raw to the client by GET /feed-records/pond/:id/total. Every
    // consumer had to remember to coerce (reports.service.ts does; the wire
    // does not), and the first one that forgot would have concatenated instead
    // of added. Coerce once, here.
    return parseFloat(result?.totalFeed ?? '0') || 0;
  }
  async getDailyFeedUsage(farmId: string, date: Date) {
    // Bucket by the farm's IST calendar day. The backend runs in UTC on Render,
    // so a setHours()-based window would span 05:30 IST→05:30 IST and drop
    // early-morning feeding (00:00–05:30 IST) into the previous day. Anchoring
    // the window with an explicit +05:30 offset gives the correct UTC instants.
    const istDay = toIstDateString(date); // 'YYYY-MM-DD' in IST
    const startOfDay = new Date(`${istDay}T00:00:00.000+05:30`);
    const endOfDay = new Date(`${istDay}T23:59:59.999+05:30`);

    const result = await this.recordsRepository
      .createQueryBuilder('feed')
      .leftJoin('feed.pond', 'pond')
      .select('SUM(feed.quantityKg)', 'totalFeed')
      .where('pond.farmId = :farmId', { farmId })
      .andWhere('feed.recordedAt BETWEEN :start AND :end', {
        start: startOfDay,
        end: endOfDay,
      })
      .getRawOne();

    return parseFloat(result?.totalFeed || '0');
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { InventoryItem } from './inventory-item.entity';
import { InventoryMovement } from './inventory-movement.entity';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { LOW_STOCK_SQL, isLowStock } from './inventory.constants';

import { AlertsService } from '../alerts/alerts.service';
import { FarmAccessService } from '../farm-access/farm-access.service';
import { FarmCapability, roleSatisfies } from '../farm-access/farm-capability';
import { FarmMember } from '../farm-access/farm-member.entity';
import { Farm } from '../farms/farm.entity';

/** Options for a stock adjustment. */
export interface AdjustStockOptions {
  /** Persisted to `last_adjustment_reason`. */
  reason?: string;
  /**
   * Capability the caller must hold. The inventory route passes
   * MANAGE_INVENTORY; the feed-log deduction passes WRITE_OPERATIONAL, because
   * a worker logging a feeding is not managing the catalogue.
   */
  capability?: FarmCapability;
  /** Reject the adjustment unless the item belongs to this farm. */
  expectedFarmId?: string;
  /** Set by the feed pipeline so a deduction can be traced to its log. */
  feedRecordId?: string;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectRepository(InventoryItem)
    private itemsRepository: Repository<InventoryItem>,
    @InjectRepository(InventoryMovement)
    private movementRepo: Repository<InventoryMovement>,
    @InjectRepository(FarmMember)
    private membersRepository: Repository<FarmMember>,
    private alertsService: AlertsService,
    private readonly farmAccess: FarmAccessService,
  ) {}

  async create(createDto: CreateInventoryItemDto, userId: string) {
    await this.farmAccess.assertCanAccessFarm(
      userId,
      createDto.farmId,
      'MANAGE_INVENTORY',
    );
    const item = this.itemsRepository.create(createDto);
    return this.itemsRepository.save(item);
  }

  async findAll(
    userId: string,
    farmId?: string,
    category?: string,
  ): Promise<InventoryItem[]> {
    const where: any = {};
    if (category) where.category = category;

    if (farmId) {
      await this.farmAccess.assertCanAccessFarm(
        userId,
        farmId,
        'VIEW_INVENTORY',
      );
      where.farmId = farmId;
    } else {
      // D7: this used to list OWNED farms only, so every non-owner member got
      // an empty inventory list. Scope it to the farms whose inventory the
      // caller may actually read.
      const farmIds = await this.farmAccess.getFarmIdsWithCapability(
        userId,
        'VIEW_INVENTORY',
      );
      if (farmIds.length === 0) return [];
      where.farmId = In(farmIds);
    }

    return this.itemsRepository.find({ where, order: { name: 'ASC' } });
  }

  /** Load an item and assert the caller's access at the given capability. */
  private async loadItem(
    id: string,
    userId: string,
    capability: FarmCapability,
  ): Promise<{ item: InventoryItem; farm: Farm }> {
    const item = await this.itemsRepository.findOneBy({ id });
    if (!item) {
      throw new NotFoundException(`Inventory item with ID ${id} not found`);
    }
    const farm = await this.farmAccess.assertCanAccessFarm(
      userId,
      item.farmId,
      capability,
    );
    return { item, farm };
  }

  async findOne(id: string, userId: string) {
    const { item } = await this.loadItem(id, userId, 'VIEW_INVENTORY');
    return item;
  }

  async update(id: string, updateDto: UpdateInventoryItemDto, userId: string) {
    await this.loadItem(id, userId, 'MANAGE_INVENTORY');
    // farmId is not on the DTO (D14) — an item cannot change farms.
    await this.itemsRepository.update(id, updateDto);
    return this.itemsRepository.findOneBy({ id });
  }

  async remove(id: string, userId: string) {
    await this.loadItem(id, userId, 'MANAGE_INVENTORY');
    return this.itemsRepository.delete(id);
  }

  async getLowStock(farmId: string, userId: string): Promise<InventoryItem[]> {
    await this.farmAccess.assertCanAccessFarm(userId, farmId, 'VIEW_INVENTORY');
    return this.itemsRepository
      .createQueryBuilder('item')
      .where('item.farmId = :farmId', { farmId })
      .andWhere(LOW_STOCK_SQL)
      .orderBy('item.name', 'ASC')
      .getMany();
  }

  /** One item's stock history, newest first. */
  async listMovements(
    itemId: string,
    userId: string,
  ): Promise<InventoryMovement[]> {
    await this.loadItem(itemId, userId, 'VIEW_INVENTORY');
    return this.movementRepo.find({
      where: { inventoryId: itemId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async countLowStock(farmId: string): Promise<number> {
    return this.itemsRepository
      .createQueryBuilder('item')
      .where('item.farmId = :farmId', { farmId })
      .andWhere(LOW_STOCK_SQL)
      .getCount();
  }

  async adjustStock(
    id: string,
    quantityChange: number,
    userId: string,
    options: AdjustStockOptions = {},
  ) {
    const { item, farm } = await this.loadItem(
      id,
      userId,
      options.capability ?? 'MANAGE_INVENTORY',
    );

    // A feed log on pond X must not be able to draw down another farm's stock.
    if (options.expectedFarmId && item.farmId !== options.expectedFarmId) {
      throw new BadRequestException(
        'Inventory item belongs to a different farm',
      );
    }

    // Atomic SQL-level delta (not read-modify-write in JS) so concurrent
    // feed logs can't clobber each other's stock updates. The guard clause
    // only blocks obviously-doomed decrements early with a friendlier
    // message; the WHERE clause below is the real concurrency-safe check.
    if (Number(item.quantity) + quantityChange < 0) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${item.quantity}, Required: ${Math.abs(quantityChange)}`,
      );
    }

    const result = await this.itemsRepository
      .createQueryBuilder()
      .update(InventoryItem)
      .set({
        quantity: () => `quantity + (${quantityChange})`,
        ...(options.reason !== undefined
          ? { lastAdjustmentReason: options.reason }
          : {}),
      })
      .where('id = :id AND quantity + (:quantityChange) >= 0', {
        id,
        quantityChange,
      })
      .execute();

    if (result.affected === 0) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${item.quantity}, Required: ${Math.abs(quantityChange)}`,
      );
    }

    // Append-only ledger. Written after the guard, so a rejected adjustment
    // leaves no trace of a change that never happened.
    await this.movementRepo.save(
      this.movementRepo.create({
        inventoryId: id,
        delta: quantityChange,
        reason: options.reason ?? null,
        createdById: userId ?? null,
        feedRecordId: options.feedRecordId ?? null,
      }),
    );

    // Re-fetch through the repository (not raw driver output) so the
    // result is a properly camelCase-mapped entity.
    const savedItem = (await this.itemsRepository.findOneBy({
      id,
    })) as InventoryItem;

    if (isLowStock(savedItem)) {
      await this.raiseLowStockAlert(savedItem, farm);
    }

    return savedItem;
  }

  /**
   * D10: the alert used to go to `farm.userId` alone, so the manager who does
   * the reordering never heard about it. Everyone who may see the stock gets
   * told it ran out.
   */
  private async raiseLowStockAlert(item: InventoryItem, farm: Farm) {
    try {
      const members = await this.membersRepository.find({
        where: { farmId: farm.id, status: 'active' },
      });
      const recipients = new Set<string>([farm.userId]);
      for (const m of members) {
        // MANAGE_INVENTORY, not VIEW_INVENTORY: an alert is a call to reorder,
        // so it goes to the people who can. VIEW_INVENTORY defaults to every
        // member including viewers, who would get a notification about stock
        // they are not allowed to touch.
        if (
          roleSatisfies(
            m.role,
            'MANAGE_INVENTORY',
            m.capabilityOverrides ?? null,
            farm.rolePolicy ?? null,
          )
        ) {
          recipients.add(m.userId);
        }
      }

      const message = `${item.name} is running low (${item.quantity} ${item.unit ?? ''}).`;
      for (const userId of recipients) {
        await this.alertsService.createAutoAlert(
          userId,
          farm.id,
          'inventory_low_stock',
          'Low Stock Alert',
          message,
          'warning',
          { inventoryItemId: item.id },
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to create low stock alert: ${error?.message ?? error}`,
      );
    }
  }
}

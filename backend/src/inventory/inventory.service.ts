import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { InventoryItem } from './inventory-item.entity';
import { InventoryMovement } from './inventory-movement.entity';
import { InventoryFarm } from './inventory-farm.entity';
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

/** An item plus every farm it is paired to (not persisted on the entity). */
export type InventoryItemWithFarms = InventoryItem & { farmIds: string[] };

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
    @InjectRepository(InventoryFarm)
    private pairingRepo: Repository<InventoryFarm>,
    private readonly dataSource: DataSource,
  ) {}

  async create(createDto: CreateInventoryItemDto, userId: string) {
    const farmIds = createDto.farmIds?.length
      ? createDto.farmIds
      : createDto.farmId
        ? [createDto.farmId]
        : [];

    // Security fix: an item with zero farms is unreachable by any capability
    // check (see assertPaired below), which used to mean "readable/writable
    // by anyone with the id" instead of "readable/writable by no one". Refuse
    // it at creation instead.
    if (!farmIds.length) {
      throw new BadRequestException(
        'An inventory item must be paired to at least one farm you can manage',
      );
    }

    // Pairing onto a farm requires managing it — every farm in the set, not
    // just one, since this establishes the pairing from scratch.
    await Promise.all(
      farmIds.map((f) =>
        this.farmAccess.assertCanAccessFarm(userId, f, 'MANAGE_INVENTORY'),
      ),
    );

    const { farmIds: _drop, ...rest } = createDto;
    const item = this.itemsRepository.create({
      ...rest,
      farmId: farmIds[0] ?? null,
    });
    const saved = await this.itemsRepository.save(item);

    if (farmIds.length) {
      await this.pairingRepo.save(
        farmIds.map((farmId) =>
          this.pairingRepo.create({ inventoryId: saved.id, farmId }),
        ),
      );
    }

    return saved;
  }

  async findAll(
    userId: string,
    farmId?: string,
    category?: string,
  ): Promise<InventoryItemWithFarms[]> {
    const where: any = {};
    if (category) where.category = category;

    let scopeFarmIds: string[];
    if (farmId) {
      await this.farmAccess.assertCanAccessFarm(
        userId,
        farmId,
        'VIEW_INVENTORY',
      );
      scopeFarmIds = [farmId];
    } else {
      // D7: this used to list OWNED farms only, so every non-owner member got
      // an empty inventory list. Scope it to the farms whose inventory the
      // caller may actually read.
      scopeFarmIds = await this.farmAccess.getFarmIdsWithCapability(
        userId,
        'VIEW_INVENTORY',
      );
      if (scopeFarmIds.length === 0) return [];
    }

    const pairs = await this.pairingRepo.find({
      where: { farmId: In(scopeFarmIds) },
    });
    const itemIds = [...new Set(pairs.map((p) => p.inventoryId))];
    if (!itemIds.length) return [];
    where.id = In(itemIds);

    const items = await this.itemsRepository.find({
      where,
      order: { name: 'ASC' },
    });

    // Fix (Task 8 regression): a multi-paired item used to only carry its
    // single fast-path `farmId`, so a farm-list screen grouping by farm
    // silently dropped it from every farm but its primary one. Attach every
    // paired farm (restricted to the caller's scope, which `pairs` already
    // is) so the frontend can list it under each one.
    const farmIdsByItem = new Map<string, string[]>();
    for (const p of pairs) {
      const arr = farmIdsByItem.get(p.inventoryId);
      if (arr) arr.push(p.farmId);
      else farmIdsByItem.set(p.inventoryId, [p.farmId]);
    }
    return items.map((item) => ({
      ...item,
      farmIds: farmIdsByItem.get(item.id) ?? (item.farmId ? [item.farmId] : []),
    }));
  }

  /**
   * The farms an item is stocked for. Prefers `inventory_farms`; falls back
   * to the single `farmId` column for rows written before the backfill (or
   * before a caller starts using the join table at all). Empty means
   * deliberately unpaired.
   */
  private async farmsFor(
    itemId: string,
    item?: InventoryItem,
  ): Promise<string[]> {
    const rows = await this.pairingRepo.find({ where: { inventoryId: itemId } });
    if (rows.length) return rows.map((r) => r.farmId);
    return item?.farmId ? [item.farmId] : [];
  }

  /**
   * READ needs the capability on ANY paired farm; WRITE needs it on EVERY
   * one. An item stocked for two farms is a shared resource — a user with
   * rights on only one of them must not be able to edit stock the other
   * depends on.
   *
   * FAILS CLOSED on a zero-farm item (no join rows, no legacy `farm_id`):
   * there is no farm to check access against, so it is DENIED, not skipped.
   * `create()` and `setPairing()` both refuse to leave an item with zero
   * farms, so this should only ever guard rows that predate that guarantee —
   * but a bare early-return here previously meant "readable/writable by
   * anyone who knows the id," which is a privilege hole, not a shortcut.
   */
  private async assertPaired(
    itemId: string,
    item: InventoryItem,
    userId: string,
    capability: FarmCapability,
    mode: 'any' | 'all',
  ): Promise<Farm> {
    const farmIds = await this.farmsFor(itemId, item);
    if (!farmIds.length) {
      throw new ForbiddenException('You cannot access this inventory item');
    }

    const results = await Promise.allSettled(
      farmIds.map((f) =>
        this.farmAccess.assertCanAccessFarm(userId, f, capability),
      ),
    );
    const fulfilled = results.filter(
      (r): r is PromiseFulfilledResult<Farm> => r.status === 'fulfilled',
    );
    const ok =
      mode === 'any'
        ? fulfilled.length > 0
        : fulfilled.length === results.length;
    if (!ok) {
      throw new ForbiddenException('You cannot access this inventory item');
    }
    // ok implies fulfilled.length > 0 in both modes (farmIds.length > 0 here).
    return fulfilled[0].value;
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
    const mode = capability === 'VIEW_INVENTORY' ? 'any' : 'all';
    const farm = await this.assertPaired(id, item, userId, capability, mode);
    return { item, farm };
  }

  async findOne(id: string, userId: string): Promise<InventoryItemWithFarms> {
    const { item } = await this.loadItem(id, userId, 'VIEW_INVENTORY');
    const farmIds = await this.farmsFor(id, item);
    return { ...item, farmIds };
  }

  /**
   * Replace the farms an item is paired to. A user must not be able to pair
   * an item AWAY from a farm they cannot manage, nor ONTO one they cannot —
   * so MANAGE_INVENTORY is asserted on the union of the old and new sets
   * before anything is written. Refuses to leave the item paired to zero
   * farms (same security fix as `create`: a zero-farm item is unreachable by
   * any capability check).
   */
  async setPairing(
    itemId: string,
    farmIds: string[],
    userId: string,
  ): Promise<void> {
    if (!farmIds.length) {
      throw new BadRequestException(
        'An inventory item must remain paired to at least one farm',
      );
    }

    const item = await this.itemsRepository.findOneBy({ id: itemId });
    if (!item) {
      throw new NotFoundException(
        `Inventory item with ID ${itemId} not found`,
      );
    }

    const oldFarmIds = await this.farmsFor(itemId, item);
    const union = [...new Set([...oldFarmIds, ...farmIds])];
    await Promise.all(
      union.map((f) =>
        this.farmAccess.assertCanAccessFarm(userId, f, 'MANAGE_INVENTORY'),
      ),
    );

    // ONE transaction: the join table (authoritative) and the fast-path
    // `farmId` column must never disagree about which farms an item belongs
    // to. A failure partway through used to leave them able to drift.
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(InventoryFarm, { inventoryId: itemId });
      await manager.insert(
        InventoryFarm,
        farmIds.map((farmId) => ({ inventoryId: itemId, farmId })),
      );
      await manager.update(InventoryItem, itemId, { farmId: farmIds[0] });
    });
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

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
import { TransactionsService } from '../transactions/transactions.service';
import { CreateTransactionDto } from '../transactions/dto/create-transaction.dto';
// Read-only joins for the two cross-links on the detail screen: the pond a
// consumption fed, and the expense a purchase wrote. Repositories only — no
// service of another module is touched.
import { Transaction } from '../transactions/transaction.entity';
import { FeedRecord } from '../feed-records/feed-record.entity';
import { Pond } from '../ponds/pond.entity';

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
  /**
   * Reject the adjustment unless the item is stocked for this farm. Checked
   * against EVERY paired farm (`inventory_farms`), not the legacy single
   * `farm_id` column — an item shared by farms {A,B} is legitimately drawn
   * down by a feed log on either one.
   */
  expectedFarmId?: string;
  /** Set by the feed pipeline so a deduction can be traced to its log. */
  feedRecordId?: string;
  /**
   * Present only when this adjustment is a purchase. Opt-in: a plain stock
   * correction must not write a money row. When set, `adjustStock` records a
   * 'inventory'-category expense of `amount`, tagged with the item, in the
   * SAME transaction as the stock update.
   *
   * `farmId` names which farm is billed. It is REQUIRED when the item is
   * paired to more than one farm — a purchase spends exactly one farm's cash
   * and silently picking the first paired farm would bill the wrong one. It
   * is checked against the farms `loadItem` actually AUTHORIZED (mode 'all',
   * so every paired farm), which is what closes the old cross-farm billing
   * hole (Task 9 review finding 1): a farmId that is not in that set is a
   * 400, never a bill.
   */
  purchase?: { amount: number; farmId?: string };
  /**
   * Client-minted UUID (F1). Becomes the movement row's PRIMARY KEY and the
   * linked transaction's id, so replaying the same request writes one
   * movement, one money row and moves the quantity once. The PK is the real
   * guard — a lost race fails the INSERT and rolls the whole transaction
   * back; the pre-check below only turns the common retry into a success
   * instead of a 500.
   */
  idempotencyKey?: string;
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
    private readonly transactionsService: TransactionsService,
    @InjectRepository(Transaction)
    private txRepo: Repository<Transaction>,
    @InjectRepository(FeedRecord)
    private feedRepo: Repository<FeedRecord>,
    @InjectRepository(Pond)
    private pondRepo: Repository<Pond>,
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

    // DELIBERATE: creating an item with an opening quantity and a unitPrice
    // writes NO money row. `quantity * unitPrice` is the value of stock the
    // farmer already owns, not cash they spent today — auto-expensing it
    // would book last season's feed as this week's cost the moment someone
    // finally types their store into the app. Money is opt-in and explicit,
    // through the purchase path on PATCH /inventory/:id/adjust (`amount`),
    // which is also where the idempotency key and the bill-to farm live.
    const { farmIds: _drop, ...rest } = createDto;
    const item = this.itemsRepository.create({ ...rest, farmId: farmIds[0] });

    // ONE transaction, same as setPairing and adjustStock: an item saved
    // without its pairing rows is a zero-farm item, which assertPaired denies
    // to everyone — an unreachable orphan nobody can delete.
    return this.dataSource.transaction(async (manager) => {
      const saved = await manager.getRepository(InventoryItem).save(item);
      await manager.insert(
        InventoryFarm,
        farmIds.map((farmId) => ({ inventoryId: saved.id, farmId })),
      );
      return saved;
    });
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
   *
   * ORDERED (I3): callers pick a representative farm out of this list (the
   * bill-to farm for a purchase, the first alert recipient). Without an ORDER
   * BY that representative was whatever Postgres happened to return first,
   * i.e. not reproducible between two identical calls.
   */
  private async farmsFor(
    itemId: string,
    item?: InventoryItem,
  ): Promise<string[]> {
    const rows = await this.pairingRepo.find({
      where: { inventoryId: itemId },
      order: { farmId: 'ASC' },
    });
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
  ): Promise<Farm[]> {
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
    // In mode 'all' this is EVERY paired farm, in farmsFor's sorted order — so
    // `[0]` is a reproducible choice, and the whole list is available to
    // callers that must reach all of them (the low-stock alert).
    return fulfilled.map((r) => r.value);
  }

  /**
   * READ ('any') vs WRITE ('all'). The ONE line deciding whether a caller must
   * be authorized on every paired farm or merely one of them; see assertPaired.
   */
  private static modeFor(capability: FarmCapability): 'any' | 'all' {
    return capability === 'VIEW_INVENTORY' ? 'any' : 'all';
  }

  /** Load an item and assert the caller's access at the given capability. */
  private async loadItem(
    id: string,
    userId: string,
    capability: FarmCapability,
  ): Promise<{ item: InventoryItem; farms: Farm[] }> {
    const item = await this.itemsRepository.findOneBy({ id });
    if (!item) {
      throw new NotFoundException(`Inventory item with ID ${id} not found`);
    }
    const farms = await this.assertPaired(
      id,
      item,
      userId,
      capability,
      InventoryService.modeFor(capability),
    );
    return { item, farms };
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
    const { farms } = await this.loadItem(id, userId, 'MANAGE_INVENTORY');
    // farmId is not on the DTO (D14) — an item cannot change farms.
    await this.itemsRepository.update(id, updateDto);
    const saved = await this.itemsRepository.findOneBy({ id });

    /**
     * THIS is where the stuck banner came from.
     *
     * Editing an item is how a farmer actually restocks — open it, change the
     * quantity, save — and this method wrote the new number and told the alerts
     * nothing. Only `adjustStock` kept them honest. So the "running low" alert
     * stayed open on an item that was full, could not be dismissed for good,
     * and came back on every launch.
     *
     * Same call as `adjustStock` makes, deliberately: one rule, both writers.
     */
    if (saved) await this.syncLowStockAlerts(saved, farms);
    return saved;
  }

  async remove(id: string, userId: string) {
    await this.loadItem(id, userId, 'MANAGE_INVENTORY');
    return this.itemsRepository.delete(id);
  }

  /**
   * Low-stock rows for one farm, scoped through `inventory_farms` (C2).
   *
   * Filtering on the legacy `item.farmId` alone hid a shared item from every
   * farm but its fast-path one, so the badge count disagreed with `findAll`.
   * The legacy column stays in the OR as the un-backfilled fallback, exactly
   * as `farmsFor` does — every writer keeps `farm_id` inside the pairing set,
   * so the OR cannot pull in a farm the item is not stocked for.
   */
  private async lowStockQuery(farmId: string) {
    const pairs = await this.pairingRepo.find({ where: { farmId } });
    const ids = pairs.map((p) => p.inventoryId);
    return this.itemsRepository
      .createQueryBuilder('item')
      .where(
        ids.length
          ? '(item.farmId = :farmId OR item.id IN (:...ids))'
          : 'item.farmId = :farmId',
        { farmId, ids },
      )
      .andWhere(LOW_STOCK_SQL);
  }

  async getLowStock(farmId: string, userId: string): Promise<InventoryItem[]> {
    await this.farmAccess.assertCanAccessFarm(userId, farmId, 'VIEW_INVENTORY');
    const qb = await this.lowStockQuery(farmId);
    return qb.orderBy('item.name', 'ASC').getMany();
  }

  /**
   * One item's stock history, newest first, with the pond a consumption went
   * to attached where it is derivable.
   *
   * The pond is JOINED at read time through `feed_record_id` rather than
   * stored on the movement: no column, no migration, no backfill, and it
   * works for every row already in the table. A deleted feed record simply
   * gives `pondId: null` — the movement still says what left the store, which
   * is the part that must outlive the feed log.
   */
  async listMovements(
    itemId: string,
    userId: string,
  ): Promise<(InventoryMovement & { pondId: string | null; pondName: string | null })[]> {
    await this.loadItem(itemId, userId, 'VIEW_INVENTORY');
    const rows = await this.movementRepo.find({
      where: { inventoryId: itemId },
      order: { createdAt: 'DESC' },
      take: 100,
    });

    const feedIds = [
      ...new Set(rows.map((r) => r.feedRecordId).filter(Boolean) as string[]),
    ];
    const pondByFeed = new Map<string, { id: string; name: string }>();
    if (feedIds.length) {
      const feeds = await this.feedRepo.find({ where: { id: In(feedIds) } });
      const ponds = await this.pondRepo.find({
        where: { id: In([...new Set(feeds.map((f) => f.pondId))]) },
      });
      const byId = new Map(ponds.map((p) => [p.id, p]));
      for (const f of feeds) {
        const p = byId.get(f.pondId);
        if (p) pondByFeed.set(f.id, { id: p.id, name: p.name });
      }
    }

    return rows.map((r) => {
      const pond = r.feedRecordId ? pondByFeed.get(r.feedRecordId) : undefined;
      return { ...r, pondId: pond?.id ?? null, pondName: pond?.name ?? null };
    });
  }

  /**
   * The money rows this item's purchases created — the other half of the
   * inventory↔money link, so a farmer can see the expense their stock
   * addition wrote.
   *
   * Gated on VIEW_FINANCIALS *per farm*, not on VIEW_INVENTORY: a storekeeper
   * who may count bags is not automatically allowed to read what the farm
   * paid for them. Farms the caller cannot see financials for are dropped,
   * and no visible farm yields an empty list rather than a 403 — the section
   * simply does not render.
   */
  async listPurchases(itemId: string, userId: string): Promise<Transaction[]> {
    const { item } = await this.loadItem(itemId, userId, 'VIEW_INVENTORY');
    const farmIds = await this.farmsFor(itemId, item);
    const visible = await this.farmAccess.getFarmIdsWithCapability(
      userId,
      'VIEW_FINANCIALS',
    );
    const allowed = farmIds.filter((f) => visible.includes(f));
    if (!allowed.length) return [];
    return this.txRepo.find({
      where: { inventoryItemId: itemId, farmId: In(allowed) },
      order: { transactionDate: 'DESC' },
      take: 50,
    });
  }

  async countLowStock(farmId: string): Promise<number> {
    const qb = await this.lowStockQuery(farmId);
    return qb.getCount();
  }

  async adjustStock(
    id: string,
    quantityChange: number,
    userId: string,
    options: AdjustStockOptions = {},
  ) {
    const capability = options.capability ?? 'MANAGE_INVENTORY';

    // T9 guard. `purchase` bills a farm through createInternal, which
    // performs NO capability check by design — safe only because mode 'all'
    // means the caller is authorized on every paired farm. A caller combining
    // `purchase` with VIEW_INVENTORY would get mode 'any', so `farm` could be
    // a farm they merely have READ access to, and that farm would be billed.
    // Same bug class as the caller-supplied `purchase.farmId` already removed
    // from this path; closed here before it can be written.
    if (options.purchase && InventoryService.modeFor(capability) === 'any') {
      throw new ForbiddenException(
        'A purchase requires a write capability on every paired farm',
      );
    }

    // Money only ever follows stock coming IN. An `amount` on a deduction is
    // a caller mistake (double-counting a consumption as a second expense —
    // see D2), so it is refused rather than silently dropped.
    if (options.purchase && quantityChange <= 0) {
      throw new BadRequestException(
        'A purchase must add stock; a reduction cannot carry an amount',
      );
    }

    const { item, farms } = await this.loadItem(id, userId, capability);

    // Which farm the purchase bills. `farms` is every paired farm the caller
    // just proved MANAGE_INVENTORY on (mode 'all'), so membership here IS the
    // authorization check — an unpaired or unauthorized farmId never reaches
    // createInternal.
    let billTo: Farm | undefined;
    if (options.purchase) {
      billTo = options.purchase.farmId
        ? farms.find((f) => f.id === options.purchase!.farmId)
        : farms.length === 1
          ? farms[0]
          : undefined;
      if (!billTo) {
        throw new BadRequestException(
          options.purchase.farmId
            ? 'The purchase must be billed to a farm this item is stocked for'
            : 'This item is shared by several farms — name the farm this purchase belongs to',
        );
      }
    }

    // A feed log on pond X must not be able to draw down another farm's stock.
    // C1: checked against every farm the item is PAIRED to, not the legacy
    // single `farmId` column — an item shared by {A,B} has farmId === A, so
    // the old check threw for every legitimate deduction billed to B.
    if (
      options.expectedFarmId &&
      !(await this.farmsFor(id, item)).includes(options.expectedFarmId)
    ) {
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

    // ONE transaction across the guarded stock UPDATE, the movement row and
    // (when this is a purchase) the money row. Review finding (Task 9,
    // review round 2): these used to be three independent awaits — a
    // `createInternal` failure after the stock UPDATE committed left a
    // durable quantity change with no movement/money trail, and a retried
    // request would double-apply the delta. Same pattern as `setPairing`:
    // throwing inside the callback rolls everything in it back, so the
    // `affected === 0` guard still leaves no movement row and no money row.
    await this.dataSource.transaction(async (manager) => {
      // F1 replay guard. The movement id IS the client's idempotency key, so
      // "has this adjustment already been applied?" is one indexed PK lookup.
      // A retry returns the item untouched: no second decrement, no second
      // money row.
      if (options.idempotencyKey) {
        const seen = await manager.findOne(InventoryMovement, {
          where: { id: options.idempotencyKey },
        });
        if (seen) return;
      }

      const result = await manager
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
      //
      // `insert`, not `save`: save() with an explicit PK does a SELECT and
      // then an UPDATE when the row exists, which would silently accept a
      // concurrent replay that slipped past the pre-check above. A plain
      // INSERT raises the unique violation instead, rolling back this
      // transaction — including the quantity change — so the adjustment is
      // applied exactly once even under a lost race.
      const movementRepo = manager.getRepository(InventoryMovement);
      await movementRepo.insert({
        ...(options.idempotencyKey ? { id: options.idempotencyKey } : {}),
        inventoryId: id,
        delta: quantityChange,
        reason: options.reason ?? null,
        createdById: userId ?? null,
        feedRecordId: options.feedRecordId ?? null,
      });

      // Opt-in money write. A purchase spends the farm's cash, so it goes
      // through TransactionsService — but via the INTERNAL, unchecked path:
      // the caller already proved MANAGE_INVENTORY (or WRITE_OPERATIONAL) on
      // EVERY farm this item is paired to above (loadItem/assertPaired, mode
      // 'all' for any non-VIEW_INVENTORY capability), so any farm in `farms`
      // is a safe bill-to. `billTo` is resolved from that authorized list
      // above: the caller may NAME a farm (required once the item is shared,
      // otherwise the bill lands on an arbitrary one) but a name outside the
      // authorized set is a 400, never a bill — which is what the earlier
      // `options.purchase.farmId` was missing (Task 9 review finding 1).
      // No `purchase` option means no money row — a plain stock correction
      // stays out of the ledger, and a CONSUMPTION never gets here at all
      // (D2: consumption is cost attribution, not a second rupee).
      // F1 closed: the money row's id is the same client key as the movement
      // id (different tables, so one key serves both), which makes the write
      // deterministic even if this ever runs outside the replay guard above.
      if (options.purchase) {
        await this.transactionsService.createInternal(
          {
            ...(options.idempotencyKey ? { id: options.idempotencyKey } : {}),
            farmId: billTo!.id,
            transactionDate: new Date().toISOString(),
            type: 'expense',
            category: 'inventory',
            amount: options.purchase.amount,
            inventoryItemId: id,
          } as CreateTransactionDto,
          userId,
          manager,
        );
      }
    });

    // Re-fetch through the repository (not raw driver output) so the
    // result is a properly camelCase-mapped entity.
    const savedItem = (await this.itemsRepository.findOneBy({
      id,
    })) as InventoryItem;

    // I3: alert EVERY paired farm, not an arbitrary one. Each farm the item is
    // stocked for depends on that stock; warning only whichever row Postgres
    // returned first left the others to discover the shortage themselves.
    // Mode is 'all' on any write capability, so `farms` is all of them.
    await this.syncLowStockAlerts(savedItem, farms);

    return savedItem;
  }

  /**
   * Bring the low-stock alerts into line with what the item now holds.
   *
   * EVERY path that can change stock level or reorder level must call this,
   * which is the whole reason it is a method rather than two blocks.
   * `adjustStock` did this inline and `update` did not — and `update` is what
   * the inventory EDIT FORM calls. So a farmer who restocked the obvious way
   * (open the item, change the quantity, save) left the alert open forever:
   * the item was no longer low, so nothing would re-raise it and nothing would
   * ever clear it. The banner sat on Today, survived being dismissed, and came
   * back on every launch — "I restocked but it still shows low stock".
   *
   * Editing the reorder LEVEL counts too, in both directions: raising it above
   * the quantity should warn, lowering it below should clear.
   */
  private async syncLowStockAlerts(item: InventoryItem, farms: Farm[]) {
    if (isLowStock(item)) {
      for (const f of farms) {
        await this.raiseLowStockAlert(item, f);
      }
      return;
    }
    // No longer low, so the alert is no longer true. Closed for EVERY
    // recipient, not just the actor — the manager who reordered is often not
    // the owner who was warned.
    try {
      await this.alertsService.resolveAutoAlerts(
        'inventory_low_stock',
        'inventoryItemId',
        item.id,
      );
    } catch (error: any) {
      // Never fail a stock write because an alert would not close.
      this.logger.error(
        `Failed to resolve low stock alerts: ${error?.message ?? error}`,
      );
    }
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
        // One open alert per item per person. Feed is logged daily, and every
        // log from a low bag came back through here — so without this a farmer
        // got the same sentence again every single day, and dismissing one
        // just revealed the next. The alert reappears only after the current
        // one is read AND the stock is still low.
        if (
          await this.alertsService.hasOpenAutoAlert(
            userId,
            'inventory_low_stock',
            'inventoryItemId',
            item.id,
          )
        ) {
          continue;
        }
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

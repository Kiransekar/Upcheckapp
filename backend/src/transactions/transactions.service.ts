import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull, EntityManager } from 'typeorm';
import { Transaction } from './transaction.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import {
  TransactionQueryDto,
  dateRangeWhere,
  istBounds,
} from './dto/money-query.dto';
import { FarmAccessService } from '../farm-access/farm-access.service';
import { FarmCapability } from '../farm-access/farm-capability';
import { Pond } from '../ponds/pond.entity';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    @InjectRepository(Pond)
    private pondsRepository: Repository<Pond>,
    private readonly farmAccess: FarmAccessService,
  ) {}

  async create(createDto: CreateTransactionDto, userId: string) {
    // Idempotent replay guard for offline-queue drains — a retried timed-out
    // POST must not double-record. Verify the caller can view the found row's
    // farm financials BEFORE returning it so a guessed id can't leak another
    // farm's transaction.
    if (createDto.id) {
      const existing = await this.transactionsRepository.findOneBy({
        id: createDto.id,
      });
      if (existing) {
        await this.farmAccess.assertCanAccessFarm(
          userId,
          existing.farmId,
          'VIEW_FINANCIALS',
        );
        return existing;
      }
    }

    // Financials are owner/manager only (VIEW_FINANCIALS); workers/viewers denied.
    await this.farmAccess.assertCanAccessFarm(
      userId,
      createDto.farmId,
      'VIEW_FINANCIALS',
    );
    /**
     * A named pond MUST belong to the named farm.
     *
     * Without this, a farmer could pass their own `farmId` (which they are
     * authorized for) together with another tenant's `pondId` and attach money
     * to that pond — polluting a farm they have no access to. Same rule
     * `ExpensesService.create` applies to `cropId`: authorization on the parent
     * never implies authorization for an arbitrary child id.
     */
    if (createDto.pondId) {
      const pond = await this.pondsRepository.findOne({
        where: { id: createDto.pondId },
      });
      if (!pond || pond.farmId !== createDto.farmId) {
        throw new BadRequestException(
          'pondId does not belong to the specified farm',
        );
      }
    }

    // Stamp the actor so money rows say who entered them.
    const transaction = this.transactionsRepository.create({
      ...createDto,
      createdById: userId,
      updatedById: userId,
    });
    return this.transactionsRepository.save(transaction);
  }

  /**
   * INTERNAL, unchecked — no VIEW_FINANCIALS assert. Mirrors
   * InventoryService.countLowStock: exists for another module (currently
   * only an inventory purchase) that has already authorized the write under
   * ITS OWN capability (e.g. MANAGE_INVENTORY) and must not be forced to
   * also hold VIEW_FINANCIALS, a financial READ capability, just to record
   * the money it just spent. The CALLER is responsible for authorization —
   * this method trusts it completely. Do not expose this over HTTP.
   *
   * Accepts an optional `manager` so the write can join a transaction the
   * CALLER already opened (e.g. InventoryService.adjustStock's stock-update +
   * movement + money transaction) — falls back to this service's own
   * repository, which runs autocommitted, when no manager is given.
   */
  async createInternal(
    createDto: CreateTransactionDto,
    userId: string,
    manager?: EntityManager,
  ) {
    const repo = manager
      ? manager.getRepository(Transaction)
      : this.transactionsRepository;
    const transaction = repo.create({
      ...createDto,
      createdById: userId,
      updatedById: userId,
    });
    return repo.save(transaction);
  }

  async findAll(userId: string, q: Partial<TransactionQueryDto> = {}) {
    const { farmId, type } = q;
    const where: any = {};
    if (type) where.type = type;

    // Validates the range (400 when inverted) as well as building the filter.
    const dateWhere = dateRangeWhere(q, { timestamp: true });
    if (dateWhere) where.transactionDate = dateWhere;

    // D2 toggle: an inventory purchase writes a transaction with the item id
    // set. Excluding them changes what the totals DESCRIBE, so it is opt-out,
    // never the default.
    if (q.includeInventoryPurchases === false) where.inventoryItemId = IsNull();

    // A pond filter narrows to money attributed to that pond. Farm-level rows
    // carry no pond and correctly drop out — "what did this pond cost me" is
    // not answered by the farm's licence fee.
    if (q.pondId) where.pondId = q.pondId;

    if (farmId) {
      await this.farmAccess.assertCanAccessFarm(
        userId,
        farmId,
        'VIEW_FINANCIALS',
      );
      where.farmId = farmId;
    } else {
      // Restrict to farms where the caller may view financials (owner/manager).
      const farmIds = await this.farmAccess.getFarmIdsWithCapability(
        userId,
        'VIEW_FINANCIALS',
      );
      if (farmIds.length === 0) return [];
      where.farmId = In(farmIds);
    }

    const rows = await this.transactionsRepository.find({
      where,
      order: { transactionDate: 'DESC' },
    });
    // Row flags the Money screen renders directly, so transaction and expense
    // rows share one shape on the client.
    // ponytail: `archived` is hardcoded false. It was exactly right while a
    // transaction hung off a FARM only; now that one may optionally name a
    // pond, a row on an archived pond will not be marked as such. Join the pond
    // here when enough money is attributed for that to be visible.
    return rows.map((t) => ({
      ...t,
      inventoryPurchase: t.inventoryItemId != null,
      archived: false,
    }));
  }

  private async findWithCapability(
    id: string,
    userId: string,
    capability: FarmCapability,
  ): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findOneBy({ id });
    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }
    // Throws Forbidden/NotFound unless the caller holds this capability on the farm.
    await this.farmAccess.assertCanAccessFarm(
      userId,
      transaction.farmId,
      capability,
    );
    return transaction;
  }

  private findOwned(id: string, userId: string): Promise<Transaction> {
    return this.findWithCapability(id, userId, 'VIEW_FINANCIALS');
  }

  findOne(id: string, userId: string) {
    return this.findOwned(id, userId);
  }

  async update(id: string, updateDto: UpdateTransactionDto, userId: string) {
    // Rewriting money is a write, not a view — gated on WRITE_MANAGEMENT, not
    // VIEW_FINANCIALS (which anyone with read access to financials also has).
    await this.findWithCapability(id, userId, 'WRITE_MANAGEMENT');
    // Never allow re-pointing a transaction at a farm the caller can't manage financially.
    if (updateDto.farmId) {
      await this.farmAccess.assertCanAccessFarm(
        userId,
        updateDto.farmId,
        'WRITE_MANAGEMENT',
      );
    }
    // `id` rides on the DTO for create-time idempotency only — spreading it
    // into an UPDATE would reassign the primary key.
    const { id: _id, ...columns } = updateDto;
    await this.transactionsRepository.update(id, {
      ...columns,
      updatedById: userId,
    });
    return this.transactionsRepository.findOneBy({ id });
  }

  async remove(id: string, userId: string) {
    // Hard delete — same reasoning as update: erasing money is a write.
    await this.findWithCapability(id, userId, 'WRITE_MANAGEMENT');
    return this.transactionsRepository.delete(id);
  }

  async getSummaryByFarm(
    farmId: string,
    userId: string,
    q: Partial<TransactionQueryDto> = {},
  ) {
    await this.farmAccess.assertCanAccessFarm(
      userId,
      farmId,
      'VIEW_FINANCIALS',
    );
    // Validate the range up front; the bounds go on the query builder below
    // because this aggregates in SQL rather than through `find`.
    dateRangeWhere(q);

    // One pass with conditional aggregates instead of a query per bucket —
    // three round trips would otherwise be needed now that the inventory
    // subtotal rides along.
    const qb = this.transactionsRepository
      .createQueryBuilder('t')
      .select(
        "SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END)",
        'income',
      )
      .addSelect(
        "SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END)",
        'expense',
      )
      .addSelect(
        "SUM(CASE WHEN t.type = 'expense' AND t.inventoryItemId IS NOT NULL THEN t.amount ELSE 0 END)",
        'inventory',
      )
      .where('t.farmId = :farmId', { farmId });

    // IST-local day bounds — see dateRangeWhere. A bare `YYYY-MM-DD` against a
    // timestamptz would run the day 05:30–05:29 IST.
    const { start, end } = istBounds(q);
    if (start) qb.andWhere('t.transactionDate >= :startDate', { startDate: start });
    if (end) qb.andWhere('t.transactionDate <= :endDate', { endDate: end });
    if (q.includeInventoryPurchases === false) {
      qb.andWhere('t.inventoryItemId IS NULL');
    }

    const row = await qb.getRawOne();
    const totalIncome = Number(row?.income || 0);
    const totalExpense = Number(row?.expense || 0);

    return {
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      // The slice of `totalExpense` that came from inventory purchases, so the
      // client can render "of which inventory: ₹X" without a second request.
      // Zero when `includeInventoryPurchases=false`, because those rows are
      // then not in `totalExpense` either.
      inventoryExpense:
        q.includeInventoryPurchases === false
          ? 0
          : Number(row?.inventory || 0),
    };
  }
}

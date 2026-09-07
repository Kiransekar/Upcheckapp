import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Expense } from './expense.entity';
import { Crop } from '../crops/crop.entity';
import { Transaction } from '../transactions/transaction.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';
import {
  DateRangeDto,
  dateRangeWhere,
  inDateRange,
  istBounds,
} from '../transactions/dto/money-query.dto';
import { HarvestsService } from '../harvests/harvests.service';
import { FarmAccessService } from '../farm-access/farm-access.service';
import { istDayRangeUtc, toIstDateString } from '../common/ist-date';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The IST calendar day of a value that may arrive either way.
 *
 * A `date` column comes back from pg as `'YYYY-MM-DD'` and is already local; a
 * `timestamptz` comes back as a `Date` and must be shifted to IST before the
 * day is read, or anything after 18:30 UTC files under tomorrow. Same rule
 * `Crop`'s DOC helper and `findMoneyEntries` follow.
 */
const istDay = (value: string | Date): string =>
  value instanceof Date ? toIstDateString(value) : String(value).slice(0, 10);

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private expensesRepository: Repository<Expense>,
    @InjectRepository(Crop)
    private cropsRepository: Repository<Crop>,
    private harvestsService: HarvestsService, // For P&L reports
    private readonly farmAccess: FarmAccessService,
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
  ) {}

  /**
   * Resolve a crop to its pond and assert the caller may view financials.
   * Returns the crop (with its pond joined) — `findByCycle` needs the cycle's
   * window and the pond's archived status, and this already reads the row.
   */
  private async assertCropFinancials(cropId: string, userId: string) {
    const crop = await this.cropsRepository.findOne({
      where: { id: cropId },
      relations: { pond: true },
    });
    if (!crop) {
      throw new NotFoundException(`Crop with ID ${cropId} not found`);
    }
    await this.farmAccess.assertCanAccessPond(
      userId,
      crop.pondId,
      'VIEW_FINANCIALS',
    );
    return crop;
  }

  async create(createDto: CreateExpenseDto, userId: string) {
    // Validate expense amount is positive
    if (!createDto.amount || createDto.amount <= 0) {
      throw new BadRequestException('Expense amount must be positive');
    }

    // Cost entry is owner/manager only (VIEW_FINANCIALS); returns the pond.
    const pond = await this.farmAccess.assertCanAccessPond(
      userId,
      createDto.pondId,
      'VIEW_FINANCIALS',
    );

    // If a cropId is supplied, it MUST belong to the same pond the caller was
    // just authorized for — otherwise a user could attach an expense to another
    // tenant's crop (their pondId + a victim's cropId), polluting that farm's
    // P&L/break-even. Access to the pond does not imply access to an arbitrary crop.
    if (createDto.cropId) {
      const crop = await this.cropsRepository.findOne({
        where: { id: createDto.cropId },
      });
      if (!crop || crop.pondId !== createDto.pondId) {
        throw new BadRequestException(
          'cropId does not belong to the specified pond',
        );
      }
    }

    const expense = this.expensesRepository.create({
      pondId: createDto.pondId,
      cropId: createDto.cropId || pond.activeCycleId, // Auto-link to active cycle if exists
      amount: createDto.amount,
      category: createDto.category,
      description: createDto.description,
      date: createDto.date,
      userId,
    });

    return this.expensesRepository.save(expense);
  }

  /**
   * `GET /expenses` — pond / cycle / date / category filtering.
   *
   * FAIL CLOSED. Each branch authorizes at the narrowest thing the caller
   * named, and the no-farmId branch restricts to the farms where the caller
   * holds VIEW_FINANCIALS — the same rule `TransactionsService.findAll` uses.
   * Pond scoping is applied on top via `getAccessiblePondIds`, so a worker
   * restricted to two ponds never sees the rest of the farm's costs.
   */
  async findAll(q: ExpenseQueryDto, userId: string) {
    const where: any = {};
    // `expenses.date` is a plain DATE column, so the bounds compare directly.
    const dateWhere = dateRangeWhere(q);
    if (dateWhere) where.date = dateWhere;
    if (q.category) where.category = q.category;

    if (q.cropId) {
      // Resolves the crop's pond and asserts VIEW_FINANCIALS on it.
      await this.assertCropFinancials(q.cropId, userId);
      where.cropId = q.cropId;
      if (q.pondId) where.pondId = q.pondId;
    } else if (q.pondId) {
      await this.farmAccess.assertCanAccessPond(
        userId,
        q.pondId,
        'VIEW_FINANCIALS',
      );
      where.pondId = q.pondId;
    } else {
      const farmIds = q.farmId
        ? [
            (
              await this.farmAccess.assertCanAccessFarm(
                userId,
                q.farmId,
                'VIEW_FINANCIALS',
              )
            ).id,
          ]
        : await this.farmAccess.getFarmIdsWithCapability(
            userId,
            'VIEW_FINANCIALS',
          );
      if (farmIds.length === 0) return [];
      const pondIds = (
        await Promise.all(
          farmIds.map((farmId) =>
            this.farmAccess.getAccessiblePondIds(
              userId,
              farmId,
              'VIEW_FINANCIALS',
            ),
          ),
        )
      ).flat();
      if (pondIds.length === 0) return [];
      where.pondId = In(pondIds);
    }

    return this.listWithFlags(where);
  }

  /**
   * The shared read for every expense list, with the two row flags the Money
   * screen renders: `archived` (the pond this cost belongs to is retired — the
   * client colours those rows) and `inventoryPurchase`, which is always false
   * because an inventory purchase writes a TRANSACTION, not an expense. It is
   * present so expense and transaction rows share one shape on the client.
   *
   * The pond is joined only to read its status and is stripped back off, so
   * the row shape gains two booleans rather than a nested entity.
   */
  private async listWithFlags(where: any) {
    const rows = await this.expensesRepository.find({
      where,
      order: { date: 'DESC' },
      relations: { pond: true },
    });
    return rows.map(({ pond, ...e }) => ({
      ...e,
      archived: pond?.status === 'archived',
      inventoryPurchase: false,
    }));
  }

  /**
   * Every pond cost the caller may see, as Money-tab line items.
   *
   * The two ledgers are separate tables written by different screens:
   * `transactions` (the Money tab's own "Add entry") and `expenses` (the pond
   * Expenses tab). The Money tab's HEADLINE has always summed both — the
   * financial report reads this service — but its ENTRY LIST rendered
   * `transactions` only, and the pond costs were fetched solely when the
   * farmer drilled into one specific pond. So a cost typed on a pond moved the
   * total and then had no line to point at: "I added expense inside a pond but
   * it didnt show inside the money screen".
   *
   * Merged at READ time, exactly like `HarvestsService.findMoneyEntries`, and
   * for the same reason: writing a Transaction per expense would double-count
   * it, because the report already sums this table.
   *
   * Scoped to VIEW_FINANCIALS and then to the ponds the caller may see, which
   * is the same scoping `findAll`'s no-farm branch applies.
   */
  async findMoneyEntries(userId: string, q?: Partial<ExpenseQueryDto>) {
    const farmIds = await this.farmAccess.getFarmIdsWithCapability(
      userId,
      'VIEW_FINANCIALS',
    );
    if (farmIds.length === 0) return [];

    const pondIds = (
      await Promise.all(
        farmIds.map((farmId) =>
          this.farmAccess.getAccessiblePondIds(
            userId,
            farmId,
            'VIEW_FINANCIALS',
          ),
        ),
      )
    ).flat();
    if (pondIds.length === 0) return [];

    const qb = this.expensesRepository
      .createQueryBuilder('expense')
      .innerJoin('expense.pond', 'pond')
      .where('expense.pondId IN (:...pondIds)', { pondIds });

    // Same default as the financial report (D3): a retired pond's money is
    // marked, not erased. Only an explicit `false` hides it.
    if (q?.includeArchivedPonds === false) {
      qb.andWhere("pond.status <> 'archived'");
    }
    // 400 on an inverted range rather than silently returning nothing.
    dateRangeWhere(q);
    if (q?.startDate) qb.andWhere('expense.date >= :startDate', { startDate: q.startDate });
    if (q?.endDate) qb.andWhere('expense.date <= :endDate', { endDate: q.endDate });

    const rows = await qb
      .select('expense.id', 'id')
      .addSelect('expense.date', 'date')
      .addSelect('expense.amount', 'amount')
      .addSelect('expense.category', 'category')
      .addSelect('expense.description', 'description')
      .addSelect('expense.pondId', 'pondId')
      .addSelect('pond.farmId', 'farmId')
      .addSelect('pond.displayName', 'pondDisplayName')
      .addSelect('pond.pondCode', 'pondCode')
      .addSelect('pond.status', 'pondStatus')
      .orderBy('expense.date', 'DESC')
      // ponytail: same bounded cap as the harvest projection; paginate if a
      // farm ever outgrows it.
      .take(500)
      .getRawMany<Record<string, any>>();

    return rows.map((r) => ({
      id: `expense:${r.id}`,
      source: 'expense' as const,
      farmId: r.farmId,
      pondId: r.pondId,
      pondName: r.pondDisplayName || r.pondCode || null,
      // IST-local day, not UTC (DATE-1). A driver that hydrates the DATE column
      // into a Date at local midnight is 18:30 UTC the day BEFORE, so
      // `toISOString()` filed the cost one day early — and the SQL range filter
      // above, which compares the raw date, disagreed with the day printed on
      // the row it returned.
      transactionDate:
        r.date instanceof Date ? toIstDateString(r.date) : String(r.date),
      type: 'expense' as const,
      category: r.category,
      description: r.description ?? null,
      amount: Number(r.amount) || 0,
      archived: r.pondStatus === 'archived',
    }));
  }

  /**
   * Expense totals for a set of ponds, BY POND — one query, not one per crop.
   *
   * The financial report used to reach costs only through
   * `getCycleFinancials(cropId)`, i.e. `WHERE cropId = ...`. An expense with no
   * crop — which `create` produces whenever the pond has no running cycle,
   * since it falls back to `pond.activeCycleId` — matched no crop and was
   * therefore counted NOWHERE: not in the headline, not in any list. A farmer
   * between crops could record costs all season and see ₹0.
   *
   * Filtering by pond instead of by crop counts every row exactly once,
   * cropped or not.
   */
  async totalsByPond(pondIds: string[], q?: DateRangeDto) {
    const empty = new Map<string, { total: number; byCategory: Record<string, number> }>();
    if (pondIds.length === 0) return empty;

    const qb = this.expensesRepository
      .createQueryBuilder('expense')
      .where('expense.pondId IN (:...pondIds)', { pondIds });
    if (q?.startDate) qb.andWhere('expense.date >= :startDate', { startDate: q.startDate });
    if (q?.endDate) qb.andWhere('expense.date <= :endDate', { endDate: q.endDate });

    const rows = await qb
      .select('expense.pondId', 'pondId')
      .addSelect('expense.category', 'category')
      .addSelect('SUM(expense.amount)', 'total')
      .groupBy('expense.pondId')
      .addGroupBy('expense.category')
      .getRawMany<{ pondId: string; category: string; total: string }>();

    for (const row of rows) {
      const amount = Number(row.total) || 0;
      const entry = empty.get(row.pondId) ?? { total: 0, byCategory: {} };
      entry.total += amount;
      entry.byCategory[row.category] =
        (entry.byCategory[row.category] || 0) + amount;
      empty.set(row.pondId, entry);
    }
    return empty;
  }

  /**
   * The farm Money screen's pond-tagged costs, as cycle expense rows.
   *
   * The reverse of `findMoneyEntries`, and the other half of the same bug.
   * Money lives in two tables: the Money screen writes a `transactions` row
   * (which may now name a pond) and the pond's Expenses tab reads
   * `expenses WHERE cropId = ...`. A transaction has no `cropId` and never
   * will, so a pond-tagged cost could not appear there — "I added an expense
   * in the money button and selected one pond ... but the expense tab inside
   * that pond didnt show this."
   *
   * Merged at READ time, exactly like the projection going the other way.
   * Nothing is migrated and the Money screen keeps writing where it wrote.
   *
   * WHICH transactions belong to the cycle — a transaction has a pond and a
   * date but no cycle, so: same pond, dated inside the cycle's window. The
   * window opens on the stocking day (or, for a cycle never stocked, the day
   * the cycle was created — pond prep is spent before stocking) and closes on
   * the actual harvest day, staying open while the cycle still runs.
   *
   * `transaction_date` is a timestamptz, so the window's IST calendar days are
   * converted to UTC instants; `expenses.date` is a plain DATE compared as a
   * string. That is why the two halves of `findByCycle` filter differently —
   * they are NOT interchangeable.
   *
   * Expense-type rows only. Income is deliberately left out: this cycle's
   * `totalRevenue` is derived from harvests, and a farmer who records a
   * harvest AND types the sale as an income row would have it counted twice.
   * ponytail: revisit if income ever needs a home here — it needs a
   * harvest-vs-typed reconciliation rule first, not just a `type` filter.
   */
  private async cycleTransactions(crop: Crop, q?: DateRangeDto) {
    const startDay = istDay(crop.stockingDate ?? crop.createdAt);
    const endDay = crop.actualHarvestDate
      ? istDay(crop.actualHarvestDate)
      : null;

    const qb = this.transactionsRepository
      .createQueryBuilder('t')
      .where('t.pondId = :pondId', { pondId: crop.pondId })
      .andWhere('t.type = :type', { type: 'expense' })
      .andWhere('t.transactionDate >= :cycleStart', {
        cycleStart: istDayRangeUtc(startDay).start,
      });
    if (endDay) {
      qb.andWhere('t.transactionDate <= :cycleEnd', {
        cycleEnd: istDayRangeUtc(endDay).end,
      });
    }

    // The caller's `?startDate=&endDate=` narrows on top of the window, the
    // same way it does for the expense half. (`findByCycle` has already called
    // `dateRangeWhere` for the inverted-range 400.)
    const { start, end } = istBounds(q ?? {});
    if (start) qb.andWhere('t.transactionDate >= :qStart', { qStart: start });
    if (end) qb.andWhere('t.transactionDate <= :qEnd', { qEnd: end });

    const rows = await qb
      .orderBy('t.transactionDate', 'DESC')
      // ponytail: same bounded cap as the other two money projections.
      .take(500)
      .getMany();

    // D3: a retired pond's money is MARKED, not erased — the row flag the
    // client colours, same as `listWithFlags`.
    const archived = crop.pond?.status === 'archived';

    return rows.map((t) => ({
      // Prefixed, like `findMoneyEntries`: there is no expense with this id,
      // and the prefix makes that impossible to miss client-side.
      id: `transaction:${t.id}`,
      source: 'transaction' as const,
      cropId: crop.id,
      pondId: crop.pondId,
      date: toIstDateString(t.transactionDate),
      category: t.category,
      // pg returns numeric as a STRING.
      amount: Number(t.amount) || 0,
      description: t.description ?? null,
      userId: t.createdById,
      createdAt: t.createdAt,
      // `transactions` has no updated_at column; the creation instant is the
      // only timestamp this row can honestly report.
      updatedAt: t.createdAt,
      archived,
      inventoryPurchase: t.inventoryItemId != null,
    }));
  }

  /**
   * Every cost in this cycle, from BOTH money tables.
   *
   * `getCycleFinancials` reduces over this exact list, so the itemised rows
   * and the total printed above them cannot disagree — one code path, by
   * construction.
   */
  async findByCycle(cropId: string, userId: string, q?: DateRangeDto) {
    // Authorization for both halves: VIEW_FINANCIALS on the crop's pond.
    const crop = await this.assertCropFinancials(cropId, userId);
    const where: any = { cropId };
    const dateWhere = dateRangeWhere(q);
    if (dateWhere) where.date = dateWhere;
    const [expenses, projected] = await Promise.all([
      this.listWithFlags(where),
      this.cycleTransactions(crop, q),
    ]);
    return [...expenses, ...projected].sort((a, b) =>
      istDay(b.date as any).localeCompare(istDay(a.date as any)),
    );
  }

  async getCycleFinancials(cropId: string, userId: string, q?: DateRangeDto) {
    // 1. Get Expenses (also performs the VIEW_FINANCIALS authorization check).
    // This is the SAME list the Expenses tab itemises — both halves of the
    // ledger — so the total below can never disagree with the rows above it.
    // The category breakdown therefore carries the free-text category a
    // transaction was typed with alongside the expense enum; that is what the
    // farmer wrote, and inventing a mapping would misfile their money.
    const expenses = await this.findByCycle(cropId, userId, q);
    const totalExpenses = expenses.reduce(
      (sum, e) => sum + Number(e.amount),
      0,
    );

    // Group expenses by category
    const expensesByCategory = expenses.reduce(
      (acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
        return acc;
      },
      {} as Record<string, number>,
    );

    // 2. Get Revenue + harvested biomass (Harvests). findAll is
    // (userId, cropId?) — the crop filter is the 2nd arg; passing cropId as the
    // userId scoped to no farms and silently returned zero revenue.
    //
    // The date range is applied in memory: HarvestsService is another module's
    // and takes no date filter, and its read is already capped at 500 rows.
    const harvests = (await this.harvestsService.findAll(userId, cropId)).filter(
      (h: any) => inDateRange(h.harvestDate, q),
    );
    const totalRevenue = harvests.reduce(
      (sum, h) => sum + (Number(h.salePriceTotal) || 0),
      0,
    );
    const totalHarvestKg = harvests.reduce(
      (sum, h) => sum + (Number(h.weightKg) || 0),
      0,
    );

    // Break-even: the sale price per kg at which revenue would cover all costs
    // incurred so far (= cost per kg). Null until there is harvested weight.
    const breakEvenPricePerKg =
      totalHarvestKg > 0 ? totalExpenses / totalHarvestKg : null;

    // Round money to 2dp to avoid JS float drift (e.g. 12345.670000000002)
    // surfacing in API responses — matches pnl.service.ts.
    return {
      totalRevenue: round2(totalRevenue),
      totalExpenses: round2(totalExpenses),
      netProfit: round2(totalRevenue - totalExpenses),
      marginPercent:
        totalRevenue > 0
          ? round2(((totalRevenue - totalExpenses) / totalRevenue) * 100)
          : 0,
      totalHarvestKg: round2(totalHarvestKg),
      breakEvenPricePerKg:
        breakEvenPricePerKg === null ? null : round2(breakEvenPricePerKg),
      expensesByCategory,
    };
  }
}

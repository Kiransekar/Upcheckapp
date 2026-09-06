import { Injectable, Logger } from '@nestjs/common';
import { PondsService } from '../ponds/ponds.service';
import { InventoryService } from '../inventory/inventory.service';
import { FeedRecordsService } from '../feed-records/feed-records.service';
import { HarvestsService } from '../harvests/harvests.service';
import { ExpensesService } from '../finances/expenses.service';
import { SamplingService } from '../sampling/sampling.service';
import { CropsService } from '../crops/crops.service';
import { FarmAccessService } from '../farm-access/farm-access.service';
import { PageOptionsDto } from '../common/dto/page-options.dto';
import { toIstDateString } from '../common/ist-date';
import { TransactionsService } from '../transactions/transactions.service';
import {
  FinancialReportQueryDto,
  dateRangeWhere,
} from '../transactions/dto/money-query.dto';

// Farms are hard-capped at 500 ponds (PondNamingService.MAX_PONDS_PER_FARM).
// A page size well above that is effectively "no limit" for pondsService.findAll,
// which otherwise defaults to take=50 and silently truncates large farms.
const ALL_PONDS_PAGE = { skip: 0, take: 10000 } as PageOptionsDto;

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly pondsService: PondsService,
    private readonly inventoryService: InventoryService,
    private readonly feedRecordsService: FeedRecordsService,
    private readonly harvestsService: HarvestsService,
    private readonly expensesService: ExpensesService,
    private readonly samplingService: SamplingService,
    private readonly cropsService: CropsService,
    private readonly farmAccess: FarmAccessService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async getDashboardSummary(userId: string, farmId?: string) {
    if (!farmId) {
      return {
        activePondsCount: 0,
        totalPondsCount: 0,
        lowStockAlerts: 0,
        todayFeedUsage: 0,
      };
    }

    // Prevent cross-tenant reads (and poisoned per-user cache keys): the caller
    // must own or belong to farmId before we query or cache anything for it.
    await this.farmAccess.assertCanAccessFarm(userId, farmId, 'READ');

    // Deliberately NOT cached. This used to sit behind a 300s TTL with no
    // invalidation anywhere, so logging feed left `todayFeedUsage` showing the
    // old number for up to five minutes — a plausible-but-wrong figure, which
    // is worse than a slightly slower one. The four counts below are already
    // parallel and indexed; a shorter TTL would not fix the class of bug.
    const [activePondsCount, totalPondsCount, lowStockAlerts, todayFeedUsage] =
      await Promise.all([
        this.pondsService.countActivePonds(farmId),
        this.pondsService.countTotalPonds(farmId),
        this.inventoryService.countLowStock(farmId),
        this.feedRecordsService.getDailyFeedUsage(farmId, new Date()),
      ]);

    return {
      activePondsCount,
      totalPondsCount,
      lowStockAlerts,
      todayFeedUsage,
    };
  }

  async getCycleAnalysis(cycleId: string, userId: string) {
    // Deliberately the VIEW_FINANCIALS-strict `cropsService.findOne` (owner +
    // manager), NOT `findOneAccessible`. Cycle analysis is a financial report,
    // so it must inherit the same capability the economics path uses. Do not
    // "fix" this to the member-aware variant — that would hand a worker or
    // viewer the farm's cycle economics.
    const crop = await this.cropsService.findOne(cycleId, userId);

    const [samplings, harvests] = await Promise.all([
      this.samplingService.findAll(cycleId),
      this.harvestsService.findAll(cycleId),
    ]);

    let survivalRate = 0;

    // FCR = total feed (kg) / total harvested weight (kg).
    // Feed is tracked per-pond, so we approximate cycle feed with the pond's
    // total feed; this is exact for single-cycle ponds and an upper bound
    // when a pond has hosted multiple cycles.
    const totalFeedKg = Number(
      await this.feedRecordsService.getTotalFeedByPond(crop.pondId),
    );
    const totalHarvestKg = harvests.reduce(
      (sum, h) => sum + Number(h.weightKg || 0),
      0,
    );
    const fcr =
      totalHarvestKg > 0
        ? Number((totalFeedKg / totalHarvestKg).toFixed(2))
        : 0;

    // Growth Chart:
    const growthChart = samplings
      .filter((s) => s.mbwG != null)
      .sort(
        (a, b) =>
          new Date(a.samplingDate).getTime() -
          new Date(b.samplingDate).getTime(),
      )
      .map((s) => ({
        // IST-local day, not UTC — a pre-05:30-IST reading must stay on
        // its own calendar date (DATE-1).
        date: toIstDateString(new Date(s.samplingDate)),
        mbw: Number(s.mbwG),
      }));

    if (samplings.length > 0) {
      // Latest sampling is the first one in the array because findAll returns DESC
      survivalRate = Number(samplings[0].srEstimationPercent || 0);
    }

    return {
      cycleId,
      fcr,
      totalFeedKg,
      totalHarvestKg,
      survivalRate,
      growthChart,
    };
  }

  async getFinancialReport(
    farmId: string,
    userId: string,
    q: Partial<FinancialReportQueryDto> = {},
  ) {
    // Financial report is owner/manager only (VIEW_FINANCIALS).
    await this.farmAccess.assertCanAccessFarm(
      userId,
      farmId,
      'VIEW_FINANCIALS',
    );
    // 400 on an inverted range before any of the fan-out below runs.
    dateRangeWhere(q);

    // D3: archived ponds are INCLUDED by default. `pondsService.findAll`
    // excludes `status = 'archived'` when neither `status` nor
    // `includeArchived` is given, so passing nothing here made archiving a
    // pond erase its whole cost/revenue history from the Money tab. The client
    // colours the archived rows differently rather than losing the money.
    const includeArchived = q.includeArchivedPonds !== false;
    // Find all ponds in the farm — an explicit large page, not the default
    // take=50, or a large farm's report silently drops ponds past #50.
    const pondsPage = await this.pondsService.findAll(
      farmId,
      userId,
      { includeArchived },
      ALL_PONDS_PAGE,
    );

    let totalRevenue = 0;
    let totalExpenses = 0;
    const expensesByCategory: Record<string, number> = {};

    // Aggregate across ALL cycles of every pond — not just the active one —
    // so completed/past cycles still contribute to the farm's finances.
    // Per-pond and per-crop fan-out is parallelized (was a sequential N+1);
    // Promise.all preserves array order, so the summation order below —
    // and therefore the arithmetic result — is unchanged.
    //
    // Resilience is load-bearing, not defensive padding. Every one of these
    // calls used to reject straight out of `Promise.all`, and the Money tab's
    // batching layer catches a failed report by DROPPING THE FARM — so one bad
    // pond or one bad cycle made a whole farm silently vanish from the tab.
    // Degrade the crop, never the farm, and never silently.
    //
    // `findAllAccessible`, not `findByPond`: the latter goes through
    // `verifyOwner`, which is OWNER-ONLY, so a manager holding VIEW_FINANCIALS
    // 403'd here and lost the farm. This is not a loosening — the farm-level
    // VIEW_FINANCIALS assert above already gated this whole method, and
    // `getCycleFinancials` re-asserts VIEW_FINANCIALS per crop below. Only the
    // listing of which cycles exist moved to the member-aware read.
    const perPondCropFinancials = await Promise.all(
      pondsPage.data.map(async (pond) => {
        const crops = await this.cropsService
          .findAllAccessible(pond.id, userId)
          .catch((err) => {
            this.logger.warn(
              `Financial report ${farmId}: skipping pond ${pond.id} — ${err?.message ?? err}`,
            );
            return [] as { id: string }[];
          });
        return Promise.all(
          crops.map((crop) =>
            this.expensesService
              .getCycleFinancials(crop.id, userId, q)
              .catch((err) => {
                this.logger.warn(
                  `Financial report ${farmId}: skipping cycle ${crop.id} — ${err?.message ?? err}`,
                );
                return null;
              }),
          ),
        );
      }),
    );

    // Per-pond rows, in the same order as `pondsPage.data`, each tagged with
    // whether the pond is archived so the client can colour it differently
    // (D3) — and so a farmer can see WHICH money came from a retired pond.
    const ponds: {
      pondId: string;
      name: string | null;
      archived: boolean;
      revenue: number;
      expenses: number;
    }[] = [];

    /**
     * Costs come from the POND, not from the crop loop above.
     *
     * `getCycleFinancials` filters `WHERE cropId = ...`, and `create` leaves
     * `cropId` null whenever the pond has no running cycle (it falls back to
     * `pond.activeCycleId`). Those rows matched no crop and were counted
     * NOWHERE — a farmer between crops could record costs all season and still
     * read ₹0. Summing per pond counts every expense exactly once, cropped or
     * not, and collapses the per-crop fan-out into one query.
     *
     * Revenue still comes from the crop loop: it is harvest-derived and a
     * harvest genuinely belongs to a cycle.
     */
    const expensesByPond = await this.expensesService.totalsByPond(
      pondsPage.data.map((p: any) => p.id),
      q,
    );

    perPondCropFinancials.forEach((cropFinancials, i) => {
      const pond: any = pondsPage.data[i];
      let pondRevenue = 0;
      for (const financials of cropFinancials) {
        if (!financials) continue; // skipped above, already logged
        pondRevenue += financials.totalRevenue;
      }
      const pondCosts = expensesByPond.get(pond?.id);
      const pondExpenses = pondCosts?.total ?? 0;
      for (const [category, amount] of Object.entries(
        pondCosts?.byCategory ?? {},
      )) {
        expensesByCategory[category] =
          (expensesByCategory[category] || 0) + Number(amount);
      }
      totalRevenue += pondRevenue;
      totalExpenses += pondExpenses;
      ponds.push({
        pondId: pond?.id,
        name: pond?.displayName ?? pond?.name ?? null,
        archived: pond?.status === 'archived',
        revenue: pondRevenue,
        expenses: pondExpenses,
      });
    });

    // Farm-level transactions, on top of the per-cycle ledger above.
    //
    // These were missing entirely, and the Money tab's own "Add entry" button
    // is what writes them: a farmer recorded ₹50,000 of feed, came back, and
    // the headline still read ₹0 while the entries they had just typed were
    // listed directly underneath it. The two ledgers are separate tables
    // written by different screens — nothing writes both from one action — so
    // adding them is a sum, not a double count.
    const transactions = await this.transactionsService
      .findAll(userId, {
        farmId,
        startDate: q.startDate,
        endDate: q.endDate,
        includeInventoryPurchases: q.includeInventoryPurchases,
      })
      .catch(() => []);
    // The slice of `totalExpenses` that came from inventory purchases (D2), so
    // the client can show "of which inventory: ₹X" without a second request.
    // Necessarily 0 when `includeInventoryPurchases=false` — those rows are
    // then not in `totalExpenses` either.
    let inventoryExpenses = 0;
    for (const tx of transactions) {
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'income') {
        totalRevenue += amount;
      } else {
        totalExpenses += amount;
        if (tx.inventoryItemId) inventoryExpenses += amount;
        const category = tx.category || 'Other';
        expensesByCategory[category] =
          (expensesByCategory[category] || 0) + amount;
      }
    }

    const expensesByCategoryArray = Object.entries(expensesByCategory).map(
      ([category, amount]) => ({
        category,
        amount,
      }),
    );

    return {
      revenue: totalRevenue,
      totalExpenses,
      profit: totalRevenue - totalExpenses,
      expensesByCategory: expensesByCategoryArray,
      inventoryExpenses,
      ponds,
      includedArchivedPonds: includeArchived,
    };
  }
}

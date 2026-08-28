import { Injectable } from '@nestjs/common';
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

// Farms are hard-capped at 500 ponds (PondNamingService.MAX_PONDS_PER_FARM).
// A page size well above that is effectively "no limit" for pondsService.findAll,
// which otherwise defaults to take=50 and silently truncates large farms.
const ALL_PONDS_PAGE = { skip: 0, take: 10000 } as PageOptionsDto;

@Injectable()
export class ReportsService {
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

  async getFinancialReport(farmId: string, userId: string) {
    // Financial report is owner/manager only (VIEW_FINANCIALS).
    await this.farmAccess.assertCanAccessFarm(
      userId,
      farmId,
      'VIEW_FINANCIALS',
    );
    // Find all ponds in the farm — an explicit large page, not the default
    // take=50, or a large farm's report silently drops ponds past #50.
    const pondsPage = await this.pondsService.findAll(
      farmId,
      userId,
      undefined,
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
    const perPondCropFinancials = await Promise.all(
      pondsPage.data.map(async (pond) => {
        const crops = await this.cropsService.findByPond(pond.id, userId);
        return Promise.all(
          crops.map((crop) =>
            this.expensesService.getCycleFinancials(crop.id, userId),
          ),
        );
      }),
    );

    for (const cropFinancials of perPondCropFinancials) {
      for (const financials of cropFinancials) {
        totalRevenue += financials.totalRevenue;
        totalExpenses += financials.totalExpenses;
        for (const [category, amount] of Object.entries(
          financials.expensesByCategory,
        )) {
          expensesByCategory[category] =
            (expensesByCategory[category] || 0) + Number(amount);
        }
      }
    }

    // Farm-level transactions, on top of the per-cycle ledger above.
    //
    // These were missing entirely, and the Money tab's own "Add entry" button
    // is what writes them: a farmer recorded ₹50,000 of feed, came back, and
    // the headline still read ₹0 while the entries they had just typed were
    // listed directly underneath it. The two ledgers are separate tables
    // written by different screens — nothing writes both from one action — so
    // adding them is a sum, not a double count.
    const transactions = await this.transactionsService
      .findAll(userId, farmId)
      .catch(() => []);
    for (const tx of transactions) {
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'income') {
        totalRevenue += amount;
      } else {
        totalExpenses += amount;
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
    };
  }
}

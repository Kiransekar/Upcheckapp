import { Injectable } from '@nestjs/common';
import { FarmsService } from '../farms/farms.service';
import { ReportsService } from '../reports/reports.service';
import { TransactionsService } from '../transactions/transactions.service';
import { CreditService } from '../credit/credit.service';

/**
 * Everything the Money tab renders, in ONE request.
 *
 * The tab used to assemble itself client-side: the farm list, then one
 * financial report PER FARM, plus transactions and credit — 3 + N requests.
 *
 * Measured from a phone in Chennai, a request to the backend in Oregon costs
 * ~265ms of pure network before the server does anything (`/api/liveness`,
 * which does no work at all, takes that long). Android also caps concurrent
 * connections per host. That network cost dominated everything happening on
 * the server, and the only fix is to stop making the round trips.
 *
 * Same shape as TeamOverviewService, and the same rule: this is a BATCHING
 * layer, not a new data path. It calls the same services the individual
 * endpoints call, so every per-farm capability check still runs — the
 * financial report is VIEW_FINANCIALS-gated and stays that way.
 */
@Injectable()
export class MoneyOverviewService {
  constructor(
    private readonly farms: FarmsService,
    private readonly reports: ReportsService,
    private readonly transactions: TransactionsService,
    private readonly credit: CreditService,
  ) {}

  async forUser(userId: string) {
    const farms = await this.farms.findAll(userId);

    const [reportPairs, allEntries, creditRows] = await Promise.all([
      Promise.all(
        farms.map((farm: { id: string }) =>
          this.reports
            .getFinancialReport(farm.id, userId)
            .then((report) => [farm.id, report] as const)
            // A worker or viewer without VIEW_FINANCIALS gets a 403 here. That
            // is a legitimate outcome, not an error: their Money tab shows the
            // farms they can see and no figures for the ones they cannot,
            // rather than failing whole. Same rule the client applied.
            .catch(() => null),
        ),
      ),
      // No farmId — already scoped to the farms where the caller may view
      // financials, so one call covers every farm.
      this.transactions.findAll(userId).catch(() => []),
      // A separate ledger that simply may not exist for a farmer who buys
      // nothing on account.
      this.credit.list(userId).catch(() => []),
    ]);

    const reports: Record<string, unknown> = {};
    for (const pair of reportPairs) if (pair) reports[pair[0]] = pair[1];

    return { farms, reports, allEntries, credit: creditRows };
  }
}

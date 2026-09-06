import apiClient from './client';
import { farmsApi } from './farms';
import { reportsApi, type FinancialReport } from './reports';
import {
    transactionsApi,
    moneyQueryParams,
    type Transaction,
    type MoneyFilterParams,
} from './transactions';
import { creditApi, type CreditLedger } from './credit';

/**
 * The Money tab in ONE request.
 *
 * It used to assemble itself on the phone: the farm list, then one financial
 * report PER FARM, plus transactions and credit — 3 + N requests.
 *
 * That was the load time. Measured from Chennai, a request to the backend in
 * Oregon costs ~265ms of pure network before the server does anything, and
 * Android caps concurrent connections per host. No amount of backend tuning
 * touches that; the only fix is to stop making the trips.
 *
 * Access is unchanged: `GET /money/overview` calls the same services, so the
 * financial report stays VIEW_FINANCIALS-gated. A farm the caller may not view
 * financials on simply contributes no report, exactly as before.
 */
/**
 * A row in the Money tab's entry list.
 *
 * `source: 'harvest'` marks a READ-ONLY projection of a harvest sale rather
 * than a real transaction. A harvest already moves the headline (the financial
 * report sums every harvest's sale price into revenue) but wrote no row the
 * farmer could point at — so "the profit is not shown in the money tab". The
 * backend merges them in at read time; writing a real transaction on harvest
 * create would double-count the revenue instead.
 *
 * These rows have no transaction behind them, so `id` is prefixed `harvest:`
 * and nothing may offer edit or delete on them.
 */
export type MoneyEntry = Omit<Transaction, 'createdAt'> & {
    createdAt?: string;
    /**
     * `harvest` and `expense` are both READ-ONLY projections of another table,
     * not transactions. Their ids are prefixed accordingly and nothing may
     * offer edit or delete on them.
     */
    source?: 'harvest' | 'expense';
    buyerName?: string;
    weightKg?: number;
    /** Set on pond costs, and on a transaction the farmer attributed to a pond. */
    pondId?: string | null;
    pondName?: string | null;
    /** The pond this row belongs to is archived — marked, never hidden (D3). */
    archived?: boolean;
};

export interface MoneyOverview {
    farms: any[];
    reports: Record<string, FinancialReport>;
    allEntries: MoneyEntry[];
    credit: CreditLedger[];
    /**
     * Inventory-purchase expenses across EVERY farm in the response. The Money
     * screen sums the per-report figure instead, because it has to answer for
     * the farm in scope rather than for all of them.
     */
    inventoryExpenses?: number;
}

/**
 * The app ships as an OTA update and the backend deploys separately, so a
 * phone WILL run this against an API that has never heard of /money/overview.
 * Only a missing ENDPOINT falls back — a 500 is the endpoint existing and
 * failing, and serving the slow path would hide a broken deploy.
 */
const isMissingEndpoint = (err: any): boolean => {
    const status = err?.response?.status;
    return status === 404 || status === 501;
};

export async function fetchMoneyOverview(filters?: MoneyFilterParams): Promise<MoneyOverview> {
    try {
        const { data } = await apiClient.get('/money/overview', {
            params: moneyQueryParams(filters),
        });
        return data;
    } catch (err) {
        if (!isMissingEndpoint(err)) throw err;
        return legacyFanOut(filters);
    }
}

/** The pre-batching path: 3 + N requests. Kept only for old backends. */
async function legacyFanOut(filters?: MoneyFilterParams): Promise<MoneyOverview> {
    const list = (await farmsApi.getAll()).data ?? [];
    const [reportPairs, txRes, creditRes] = await Promise.all([
        Promise.all(
            list.map((farm: any) =>
                reportsApi
                    .getFinancialReport(farm.id, filters)
                    .then((r) => [farm.id, r.data] as const)
                    .catch(() => null),
            ),
        ),
        transactionsApi.getAll(undefined, undefined, filters).catch(() => ({ data: [] as Transaction[] })),
        creditApi.list().catch(() => ({ data: [] as CreditLedger[] })),
    ]);
    const reports: Record<string, FinancialReport> = {};
    for (const pair of reportPairs) if (pair) reports[pair[0]] = pair[1];
    return {
        farms: list,
        reports,
        allEntries: txRes.data ?? [],
        credit: creditRes.data ?? [],
    };
}

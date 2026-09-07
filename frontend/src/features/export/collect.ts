/**
 * API/query data -> ReportData.
 *
 * The one layer that talks to the network and the one layer that knows about
 * language. Everything it emits is a finished string: the renderers below it
 * never call t(), never touch a Date and never format a number.
 *
 * Two rules that are not obvious from the types:
 *
 *  - A section the farmer switched OFF is never fetched. Not fetched-and-
 *    hidden — a farmer on a village 2G link pays for every request, and a cost
 *    breakdown they deliberately excluded from a buyer's copy has no business
 *    leaving the server at all.
 *  - `config.language` is the DOCUMENT's language, not the app's. A farmer who
 *    reads Tamil may need an English report for a buyer. The locale bundle is
 *    lazy (see src/i18n/index.ts), so we await `loadLocale` BEFORE the first
 *    t() — otherwise the document quietly comes out full of `logs.feedTitle`.
 */

import i18n, { loadLocale } from '../../i18n';
import { formatINR } from '../inrFormat';
import { cropsApi, computeDoc, type Crop } from '../../api/crops';
import { pondsApi } from '../../api/ponds';
import { farmsApi } from '../../api/farms';
import { pondContextApi } from '../../api/pondContext';
import { waterQualityApi, type WaterQualityRecord } from '../../api/waterQuality';
import { feedApi, type FeedRecord } from '../../api/feedRecords';
import { samplingApi, type SamplingRecord } from '../../api/sampling';
import { mortalityApi, type MortalityRecord } from '../../api/mortalities';
import { treatmentsApi, type Treatment } from '../../api/treatments';
import { harvestsApi, type Harvest } from '../../api/harvests';
import { expensesApi, type Expense } from '../../api/expenses';
import { transactionsApi, type Transaction } from '../../api/transactions';
import { reportsApi } from '../../api/reports';
import { inventoryApi, isLowStock, type InventoryItem } from '../../api/inventory';
import { attendanceApi, type AttendanceRecord } from '../../api/attendance';
import { tasksApi, type Task } from '../../api/tasks';
import { personName } from '../../utils/personName';
import { toLocalISODate } from '../../utils/localDate';
import type {
    ExportConfig,
    ExportSections,
    ReportData,
    ReportStat,
    ReportTable,
} from './types';

/**
 * App language -> BCP-47. Mirrors src/utils/formatDate.ts, which formats in
 * the APP's language and so cannot answer for a document in another one.
 */
const LOCALE_TAGS: Record<string, string> = {
    en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN', bn: 'bn-IN', or: 'or-IN',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DASH = '—';

type T = (key: string, opts?: Record<string, unknown>) => string;

/** Everything downstream needs to turn a value into a cell, bound to one locale. */
interface Fmt {
    t: T;
    date: (v?: string | number | Date | null) => string;
    time: (v?: string | number | Date | null) => string;
    /**
     * `string` is not defensive typing, it is the truth: every pg `numeric` /
     * `decimal` column (feed kg, dosage, mortality weight, inventory quantity,
     * money amounts) arrives over the wire as a STRING, however the api/*.ts
     * interfaces declare it. See `toNumber`.
     */
    num: (v?: number | string | null, digits?: number) => string;
    money: (v?: number | string | null) => string;
    text: (v?: string | null) => string;
}

/**
 * The one coercion for every figure that reaches this file.
 *
 * TypeORM hands pg `numeric`/`decimal` back as a STRING — `quantity_kg`,
 * `dosage_kg`, `estimated_weight_kg`, `inventory.quantity`, `amount`. The
 * `api/*.ts` interfaces all declare those `number`, so nothing in the type
 * system catches it and the two halves of a table drifted apart silently:
 * `f.num('12.5')` fell through `Number.prototype.toLocaleString` to
 * `String.prototype.toLocaleString`, which ignores its arguments and returns
 * the raw column text, while the Total row underneath went through `sum()`
 * and printed 0. Same numbers, two answers, in one table.
 */
const toNumber = (v: unknown): number | null => {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
};

const makeFmt = (language: string): Fmt => {
    const tag = LOCALE_TAGS[language] ?? 'en-IN';
    const t = i18n.getFixedT(language) as unknown as T;

    const toDate = (v: string | number | Date): Date | null => {
        const d = v instanceof Date ? v : new Date(v);
        return Number.isNaN(d.getTime()) ? null : d;
    };

    return {
        t,
        date: (v) => {
            if (v == null) return DASH;
            const d = toDate(v);
            if (!d) return DASH;
            try {
                return d.toLocaleDateString(tag, { day: 'numeric', month: 'short', year: 'numeric' });
            } catch {
                // Hermes ships incomplete ICU data for some Indian locales; a
                // plainer date beats a thrown RangeError mid-export.
                return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
            }
        },
        time: (v) => {
            if (v == null) return DASH;
            const d = toDate(v);
            if (!d) return DASH;
            const pad = (n: number) => String(n).padStart(2, '0');
            return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        },
        num: (v, digits = 2) => {
            const n = toNumber(v);
            if (n == null) return DASH;
            try {
                return n.toLocaleString(tag, { maximumFractionDigits: digits });
            } catch {
                return String(Math.round(n * 100) / 100);
            }
        },
        // formatINR is the app's one money formatter; grouping stays Indian in
        // every locale because the currency is.
        money: (v) => {
            const n = toNumber(v);
            return n == null ? DASH : formatINR(n);
        },
        text: (v) => (v == null || v === '' ? DASH : String(v)),
    };
};

/**
 * The DEVICE-LOCAL calendar day of a record, which is the only day a farmer
 * has ever meant.
 *
 * `startDate`/`endDate` come from `moneyPeriodRange`, which builds them with
 * `toLocalISODate` — local days. Slicing the first ten characters off a
 * timestamp gives the UTC day instead, and for IST (UTC+5:30) those two differ
 * for everything logged between 00:00 and 05:30 local: a 04:00 feeding on the
 * 7th is stamped `2026-09-06T22:30:00Z`, so "today" excluded from the export
 * the very row the pond's history screen was showing.
 *
 * A bare `YYYY-MM-DD` (a pg `date` column — sampling, treatment, mortality) is
 * already a calendar day and is returned untouched: parsing it would re-read it
 * as UTC midnight and shift it a day BACKWARDS in any timezone west of UTC.
 */
const localDay = (value: string): string => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value.slice(0, 10) : toLocalISODate(d);
};

/** Inclusive YYYY-MM-DD window, for the endpoints that take no date params. */
const inRange = (value: string | null | undefined, start?: string, end?: string): boolean => {
    if (!start && !end) return true;
    if (!value) return false;
    const day = localDay(String(value));
    if (start && day < start) return false;
    if (end && day > end) return false;
    return true;
};

/**
 * Total of a column. Coerces, because the values are pg `numeric` strings
 * (see `toNumber`) — the old `typeof b === 'number'` guard scored every one of
 * them as 0, so every Total row over a numeric column (feed kg, mortality
 * weight, expense and transaction amounts) printed zero underneath rows that
 * plainly did not add up to zero.
 */
const sum = (xs: (number | string | null | undefined)[]): number =>
    xs.reduce<number>((a, b) => a + (toNumber(b) ?? 0), 0);

const byDateDesc = <R>(rows: R[], pick: (r: R) => string | null | undefined): R[] =>
    [...rows].sort((a, b) => String(pick(b) ?? '').localeCompare(String(pick(a) ?? '')));

/** Some list endpoints answer with a bare array, some with a PageDto. */
const listOf = <R>(data: unknown): R[] =>
    Array.isArray(data) ? (data as R[]) : ((data as { data?: R[] } | null)?.data ?? []);

/**
 * A table with no rows is not a table. An empty heading in a document handed
 * to a lender reads as "they lost my records".
 */
const keep = (tables: (ReportTable | null)[]): ReportTable[] =>
    tables.filter((tb): tb is ReportTable => !!tb && tb.rows.length > 0);

// ── shared table builders ────────────────────────────────────────────────────

const waterTable = (f: Fmt, rows: WaterQualityRecord[]): ReportTable => ({
    key: 'waterQuality',
    title: f.t('history.waterQualityTitle'),
    columns: [
        f.t('common.date'),
        f.t('history.waterQualityMetricPh'),
        f.t('history.waterQualityMetricDo'),
        f.t('history.waterQualityMetricTemp'),
        f.t('history.waterQualityMetricSalinity'),
        f.t('history.waterQualityMetricAmmonia'),
        f.t('history.waterQualityMetricNitrite'),
        f.t('history.waterQualityMetricAlkalinity'),
    ],
    numericColumns: [1, 2, 3, 4, 5, 6, 7],
    rows: byDateDesc(rows, (r) => r.recordedAt).map((r) => [
        f.date(r.recordedAt),
        f.num(r.ph), f.num(r.dissolvedOxygen), f.num(r.temperature), f.num(r.salinity),
        f.num(r.ammonia), f.num(r.nitrite), f.num(r.alkalinity),
    ]),
});

const feedTable = (f: Fmt, rows: FeedRecord[]): ReportTable => ({
    key: 'feed',
    title: f.t('history.feedTitle'),
    columns: [
        f.t('common.date'),
        f.t('logs.feedType', { defaultValue: 'Feed type' }),
        f.t('logs.feedBrand', { defaultValue: 'Brand' }),
        f.t('logs.quantityKg', { defaultValue: 'Quantity (kg)' }),
    ],
    numericColumns: [3],
    rows: byDateDesc(rows, (r) => r.recordedAt).map((r) => [
        f.date(r.recordedAt), f.text(r.feedType), f.text(r.feedBrand), f.num(r.quantityKg),
    ]),
    total: ['', '', f.t('common.total', { defaultValue: 'Total' }), f.num(sum(rows.map((r) => r.quantityKg)))],
});

const samplingTable = (f: Fmt, rows: SamplingRecord[]): ReportTable => ({
    key: 'sampling',
    title: f.t('history.samplingTitle'),
    columns: [
        f.t('common.date'),
        f.t('logs.mbwG', { defaultValue: 'MBW (g)' }),
        f.t('history.samplingPillSamples'),
        f.t('history.samplingPillBiomass'),
        f.t('history.samplingPillSr'),
    ],
    numericColumns: [1, 2, 3, 4],
    rows: byDateDesc(rows, (r) => r.samplingDate).map((r) => [
        f.date(r.samplingDate), f.num(r.mbwG), f.num(r.totalSamples, 0),
        f.num(r.biomassEstimationKg), f.num(r.srEstimationPercent, 1),
    ]),
});

const mortalityTable = (f: Fmt, rows: MortalityRecord[]): ReportTable => ({
    key: 'mortality',
    title: f.t('history.mortalityTitle'),
    columns: [
        f.t('common.date'),
        f.t('logs.quantity', { defaultValue: 'Count' }),
        f.t('logs.estWeightKg', { defaultValue: 'Est. weight (kg)' }),
        f.t('common.notes'),
    ],
    numericColumns: [1, 2],
    rows: byDateDesc(rows, (r) => r.recordDate).map((r) => [
        f.date(r.recordDate), f.num(r.quantity, 0), f.num(r.estimatedWeightKg), f.text(r.note),
    ]),
    total: [
        f.t('common.total', { defaultValue: 'Total' }),
        f.num(sum(rows.map((r) => r.quantity)), 0),
        f.num(sum(rows.map((r) => r.estimatedWeightKg))),
        '',
    ],
});

const treatmentTable = (f: Fmt, rows: Treatment[]): ReportTable => ({
    key: 'treatments',
    title: f.t('history.treatmentTitle'),
    columns: [
        f.t('common.date'),
        f.t('logs.description', { defaultValue: 'Description' }),
        f.t('logs.dosageKg', { defaultValue: 'Dosage (kg)' }),
        f.t('common.notes'),
    ],
    numericColumns: [2],
    rows: byDateDesc(rows, (r) => r.treatmentDate).map((r) => [
        f.date(r.treatmentDate),
        f.text(r.description),
        f.num(r.dosageKg),
        // The banned-substance flag is server-evaluated and belongs in an
        // exported record: it is exactly what an auditor came to look for.
        r.bannedSubstanceFlag && r.bannedSubstanceFlag !== 'none'
            ? f.t('history.bannedFlagLabel', { names: (r.bannedSubstanceMatches ?? []).join(', ') })
            : f.text(r.notes),
    ]),
});

const harvestTable = (f: Fmt, rows: Harvest[], withMoney: boolean): ReportTable => ({
    key: 'harvest',
    title: f.t('history.harvestTitle'),
    columns: [
        f.t('common.date'),
        f.t('logs.harvestType', { defaultValue: 'Type' }),
        f.t('history.harvestMetricBiomass'),
        f.t('history.harvestMetricAvgSize'),
        f.t('logs.buyer', { defaultValue: 'Buyer' }),
        ...(withMoney ? [f.t('logs.sale', { defaultValue: 'Sale' })] : []),
    ],
    numericColumns: withMoney ? [2, 3, 5] : [2, 3],
    rows: byDateDesc(rows, (r) => r.harvestDate).map((r) => [
        f.date(r.harvestDate), f.text(r.harvestType), f.num(r.weightKg),
        f.num(r.averageSize), f.text(r.buyerName),
        ...(withMoney ? [f.money(r.salePriceTotal)] : []),
    ]),
    total: [
        f.t('common.total', { defaultValue: 'Total' }), '',
        f.num(sum(rows.map((r) => r.weightKg))), '', '',
        ...(withMoney ? [f.money(sum(rows.map((r) => r.salePriceTotal)))] : []),
    ],
});

const expenseTable = (f: Fmt, rows: Expense[]): ReportTable => ({
    key: 'costs',
    title: f.t('finance.expensesTitle'),
    columns: [
        f.t('common.date'),
        f.t('finance.fieldCategory'),
        f.t('finance.fieldNotes'),
        f.t('finance.fieldAmount'),
    ],
    numericColumns: [3],
    rows: byDateDesc(rows, (r) => r.date).map((r) => [
        f.date(r.date), f.text(r.category), f.text(r.description), f.money(r.amount),
    ]),
    total: ['', '', f.t('finance.totalExpenses'), f.money(sum(rows.map((r) => r.amount)))],
});

const transactionTable = (
    f: Fmt,
    rows: Transaction[],
    key: keyof ExportSections,
    title: string,
    totalLabel: string,
): ReportTable => ({
    key,
    title,
    columns: [
        f.t('common.date'),
        f.t('finance.fieldCategory'),
        f.t('finance.fieldNotes'),
        f.t('finance.fieldAmount'),
    ],
    numericColumns: [3],
    rows: byDateDesc(rows, (r) => r.transactionDate).map((r) => [
        f.date(r.transactionDate), f.text(r.category), f.text(r.description), f.money(r.amount),
    ]),
    total: ['', '', totalLabel, f.money(sum(rows.map((r) => r.amount)))],
});

// ── per-dataset collectors ───────────────────────────────────────────────────

interface Scope {
    farmName?: string;
    pondName?: string;
    cycleLabel?: string;
}

interface Collected {
    scope: Scope;
    stats: ReportStat[];
    tables: ReportTable[];
}

const cropLabel = (crop: Crop): string =>
    crop.cropCode ? `${crop.name} (${crop.cropCode})` : crop.name;

/**
 * Names for the document header. A missing name is not fatal — a report with
 * no farm name is still a report; a report that failed to open is not.
 */
const resolveScope = async (farmId?: string, pondId?: string, crop?: Crop): Promise<Scope> => {
    const [farm, pond] = await Promise.all([
        farmId ? farmsApi.getById(farmId).then((r) => r.data).catch(() => null) : null,
        pondId ? pondsApi.getById(pondId).then((r) => r.data).catch(() => null) : null,
    ]);
    return {
        farmName: farm?.name,
        pondName: pond?.name,
        cycleLabel: crop ? cropLabel(crop) : undefined,
    };
};

const collectCycle = async (config: ExportConfig, f: Fmt): Promise<Collected> => {
    if (!config.cropId) throw new Error('cycle export needs a cropId');
    const s = config.sections;
    const cropId = config.cropId;
    const crop = (await cropsApi.getById(cropId)).data;
    const pondId = crop.pondId;

    const [scope, analysis, water, feed, sampling, mortality, treatments, harvests, expenses, financials] =
        await Promise.all([
            resolveScope(config.farmId ?? crop.farmId, pondId, crop),
            s.summary ? reportsApi.getCycleAnalysis(cropId).then((r) => r.data).catch(() => null) : null,
            s.waterQuality
                ? waterQualityApi.getAll(pondId, { take: 500 }).then((r) => listOf<WaterQualityRecord>(r.data))
                : [],
            s.feed ? feedApi.getByCrop(cropId, { take: 500 }).then((r) => listOf<FeedRecord>(r.data)) : [],
            s.sampling ? samplingApi.getByCrop(cropId).then((r) => listOf<SamplingRecord>(r.data)) : [],
            s.mortality ? mortalityApi.getByCrop(cropId).then((r) => listOf<MortalityRecord>(r.data)) : [],
            s.treatments ? treatmentsApi.getByCrop(cropId).then((r) => listOf<Treatment>(r.data)) : [],
            s.harvest ? harvestsApi.getByCrop(cropId).then((r) => listOf<Harvest>(r.data)) : [],
            s.costs ? expensesApi.findByCycle(cropId).then((r) => listOf<Expense>(r.data)) : [],
            s.costs ? expensesApi.getCycleFinancials(cropId).then((r) => r.data).catch(() => null) : null,
        ]);

    const stats: ReportStat[] = [];
    if (s.summary) {
        const doc = crop.computedDOC ?? computeDoc(crop);
        stats.push(
            { label: f.t('cycles.doc', { defaultValue: 'Day of culture' }), value: f.num(doc, 0) },
            { label: f.t('cycles.stockingDate', { defaultValue: 'Stocking date' }), value: f.date(crop.stockingDate) },
            { label: f.t('cycles.stockingCount', { defaultValue: 'Stocked' }), value: f.num(crop.stockingCount, 0) },
        );
        if (analysis) {
            stats.push(
                { label: f.t('engines.fcr', { defaultValue: 'FCR' }), value: f.num(analysis.fcr) },
                {
                    label: f.t('engines.survivalRate', { defaultValue: 'Survival' }),
                    value: `${f.num(analysis.survivalRate, 1)}%`,
                },
                {
                    label: f.t('history.harvestMetricBiomass'),
                    value: `${f.num(analysis.totalHarvestKg)} kg`,
                    hint: `${f.num(analysis.totalFeedKg)} kg ${f.t('history.feedTitle')}`,
                },
            );
        }
    }
    if (s.costs && financials) {
        stats.push(
            { label: f.t('finance.totalExpenses'), value: f.money(financials.totalExpenses) },
            { label: f.t('finance.totalRevenue'), value: f.money(financials.totalRevenue) },
            {
                label: f.t('finance.netProfit'),
                value: f.money(financials.netProfit),
                hint: `${f.num(financials.marginPercent, 1)}%`,
            },
        );
    }

    return {
        scope,
        stats,
        tables: keep([
            water.length ? waterTable(f, water) : null,
            feed.length ? feedTable(f, feed) : null,
            sampling.length ? samplingTable(f, sampling) : null,
            mortality.length ? mortalityTable(f, mortality) : null,
            treatments.length ? treatmentTable(f, treatments) : null,
            expenses.length ? expenseTable(f, expenses) : null,
            harvests.length ? harvestTable(f, harvests, s.costs) : null,
        ]),
    };
};

const collectPondLogs = async (config: ExportConfig, f: Fmt): Promise<Collected> => {
    if (!config.pondId) throw new Error('pondLogs export needs a pondId');
    const s = config.sections;
    const pondId = config.pondId;

    // The record endpoints below are crop-scoped; pond-context is the one call
    // that says which cycle a pond is on right now.
    const ctx = config.cropId && config.farmId
        ? null
        : await pondContextApi.get(pondId).then((r) => r.data).catch(() => null);
    const cropId = config.cropId ?? ctx?.cropId ?? undefined;

    const [scope, water, feed, sampling, mortality, treatments, harvests] = await Promise.all([
        resolveScope(config.farmId ?? ctx?.farmId, pondId, undefined),
        s.waterQuality
            ? waterQualityApi.getAll(pondId, { take: 500 }).then((r) => listOf<WaterQualityRecord>(r.data))
            : [],
        s.feed ? feedApi.getAll(pondId, { take: 500 }).then((r) => listOf<FeedRecord>(r.data)) : [],
        s.sampling && cropId ? samplingApi.getByCrop(cropId).then((r) => listOf<SamplingRecord>(r.data)) : [],
        s.mortality && cropId ? mortalityApi.getByCrop(cropId).then((r) => listOf<MortalityRecord>(r.data)) : [],
        s.treatments && cropId ? treatmentsApi.getByCrop(cropId).then((r) => listOf<Treatment>(r.data)) : [],
        s.harvest ? harvestsApi.getByPond(pondId).then((r) => listOf<Harvest>(r.data)) : [],
    ]);

    const range = <R>(rows: R[], pick: (r: R) => string | null | undefined) =>
        rows.filter((r) => inRange(pick(r), config.startDate, config.endDate));

    const w = range(water, (r) => r.recordedAt);
    const fe = range(feed, (r) => r.recordedAt);
    const sa = range(sampling, (r) => r.samplingDate);
    const mo = range(mortality, (r) => r.recordDate);
    const tr = range(treatments, (r) => r.treatmentDate);
    const ha = range(harvests, (r) => r.harvestDate);

    return {
        scope,
        stats: s.summary
            ? [
                { label: f.t('history.waterQualityTitle'), value: f.num(w.length, 0) },
                { label: f.t('history.feedTitle'), value: `${f.num(sum(fe.map((r) => r.quantityKg)))} kg` },
                { label: f.t('history.harvestMetricBiomass'), value: `${f.num(sum(ha.map((r) => r.weightKg)))} kg` },
            ]
            : [],
        tables: keep([
            w.length ? waterTable(f, w) : null,
            fe.length ? feedTable(f, fe) : null,
            sa.length ? samplingTable(f, sa) : null,
            mo.length ? mortalityTable(f, mo) : null,
            tr.length ? treatmentTable(f, tr) : null,
            ha.length ? harvestTable(f, ha, s.costs) : null,
        ]),
    };
};

const collectMoney = async (config: ExportConfig, f: Fmt): Promise<Collected> => {
    if (!config.farmId) throw new Error('money export needs a farmId');
    const s = config.sections;
    const farmId = config.farmId;
    // These endpoints filter server-side on exactly these params — the Money
    // screen already relies on it, and re-filtering here could only differ
    // from what the farmer saw on screen.
    const filters = {
        startDate: config.startDate ?? null,
        endDate: config.endDate ?? null,
        includeArchivedPonds: config.includeArchived !== false,
    };

    const [scope, report, expenses, income, spend] = await Promise.all([
        resolveScope(farmId, config.pondId, undefined),
        s.summary ? reportsApi.getFinancialReport(farmId, filters).then((r) => r.data).catch(() => null) : null,
        s.costs
            ? expensesApi
                .list({
                    farmId,
                    pondId: config.pondId,
                    cropId: config.cropId,
                    startDate: config.startDate ?? null,
                    endDate: config.endDate ?? null,
                    includeArchivedPonds: filters.includeArchivedPonds,
                })
                .then((r) => listOf<Expense>(r.data))
            : [],
        // Income rides on the `harvest` section: in a copy going to a buyer the
        // sensitive half is the cost breakdown, and revenue is the half a
        // lender actually asked to see.
        s.harvest ? transactionsApi.getAll(farmId, 'income', filters).then((r) => listOf<Transaction>(r.data)) : [],
        s.costs ? transactionsApi.getAll(farmId, 'expense', filters).then((r) => listOf<Transaction>(r.data)) : [],
    ]);

    const stats: ReportStat[] = [];
    if (report) {
        if (s.harvest) stats.push({ label: f.t('finance.totalIncome'), value: f.money(report.revenue) });
        if (s.costs) stats.push({ label: f.t('finance.totalExpenses'), value: f.money(report.totalExpenses) });
        if (s.harvest && s.costs) stats.push({ label: f.t('finance.netProfit'), value: f.money(report.profit) });
    }

    return {
        scope,
        stats,
        tables: keep([
            income.length
                ? transactionTable(f, income, 'harvest', f.t('finance.filterIncome'), f.t('finance.totalIncome'))
                : null,
            expenses.length ? expenseTable(f, expenses) : null,
            spend.length
                ? transactionTable(f, spend, 'costs', f.t('finance.transactionsTitle'), f.t('finance.totalExpense'))
                : null,
        ]),
    };
};

/**
 * The three list datasets below are not cycle-shaped, so they have no natural
 * home among the eight cycle sections. They ride on `summary`: switching it
 * off is the farmer saying "not this block", and there is only one block.
 */
const collectInventory = async (config: ExportConfig, f: Fmt): Promise<Collected> => {
    const s = config.sections;
    const [scope, items] = await Promise.all([
        resolveScope(config.farmId, undefined, undefined),
        s.summary ? inventoryApi.getAll(config.farmId).then((r) => listOf<InventoryItem>(r.data)) : [],
    ]);

    /**
     * `costs` is a real toggle here, not decoration. The screen offers it for
     * this dataset and drops it for anyone without VIEW_FINANCIALS — and this
     * collector used to ignore it entirely, so unit price and stock value went
     * into every inventory export: into the copy a farmer deliberately stripped
     * of costs before handing it to a buyer, and into a worker's export of a
     * farm whose money they are not allowed to see at all.
     */
    const withMoney = s.costs;

    const table: ReportTable = {
        key: 'summary',
        title: f.t('inventory.title', { defaultValue: 'Inventory' }),
        columns: [
            f.t('inventory.itemName', { defaultValue: 'Item' }),
            f.t('finance.fieldCategory'),
            f.t('inventory.quantity', { defaultValue: 'Quantity' }),
            f.t('inventory.unit', { defaultValue: 'Unit' }),
            f.t('inventory.reorderLevel', { defaultValue: 'Reorder level' }),
            ...(withMoney ? [f.t('inventory.unitPrice', { defaultValue: 'Unit price' })] : []),
            f.t('inventory.supplier', { defaultValue: 'Supplier' }),
            f.t('inventory.expiryDate', { defaultValue: 'Expiry' }),
        ],
        numericColumns: withMoney ? [2, 4, 5] : [2, 4],
        rows: [...items]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((i) => [
                f.text(i.name), f.text(i.category), f.num(i.quantity), f.text(i.unit),
                f.num(i.reorderLevel),
                ...(withMoney ? [f.money(i.unitPrice)] : []),
                f.text(i.supplier), f.date(i.expiryDate),
            ]),
    };

    return {
        scope,
        stats: s.summary
            ? [
                { label: f.t('inventory.title', { defaultValue: 'Inventory' }), value: f.num(items.length, 0) },
                {
                    label: f.t('inventory.lowStock', { defaultValue: 'Low stock' }),
                    value: f.num(items.filter((i) => isLowStock(i)).length, 0),
                },
                ...(withMoney
                    ? [
                        {
                            label: f.t('inventory.stockValue', { defaultValue: 'Stock value' }),
                            value: f.money(
                                sum(items.map((i) => (toNumber(i.unitPrice) ?? 0) * (toNumber(i.quantity) ?? 0))),
                            ),
                        },
                    ]
                    : []),
            ]
            : [],
        tables: keep([table]),
    };
};

const collectAttendance = async (config: ExportConfig, f: Fmt): Promise<Collected> => {
    if (!config.farmId) throw new Error('attendance export needs a farmId');
    const s = config.sections;
    const [scope, records] = await Promise.all([
        resolveScope(config.farmId, undefined, undefined),
        s.summary
            ? attendanceApi
                .getAll(config.farmId, undefined, config.startDate, config.endDate)
                .then((r) => listOf<AttendanceRecord>(r.data))
            : [],
    ]);

    const hours = (r: AttendanceRecord): number | null => {
        if (!r.checkOutAt) return null;
        const ms = new Date(r.checkOutAt).getTime() - new Date(r.checkInAt).getTime();
        return Number.isFinite(ms) && ms > 0 ? ms / 3_600_000 : null;
    };

    const table: ReportTable = {
        key: 'summary',
        title: f.t('attendance.title', { defaultValue: 'Attendance' }),
        columns: [
            f.t('common.date'),
            f.t('members.name', { defaultValue: 'Name' }),
            f.t('attendance.checkIn', { defaultValue: 'Check-in' }),
            f.t('attendance.checkOut', { defaultValue: 'Check-out' }),
            f.t('attendance.hours', { defaultValue: 'Hours' }),
        ],
        numericColumns: [4],
        rows: byDateDesc(records, (r) => r.checkInAt).map((r) => [
            f.date(r.checkInAt),
            f.text(personName(r.user, DASH)),
            f.time(r.checkInAt),
            r.checkOutAt ? f.time(r.checkOutAt) : DASH,
            f.num(hours(r), 1),
        ]),
    };

    return {
        scope,
        stats: s.summary
            ? [
                { label: f.t('attendance.title', { defaultValue: 'Attendance' }), value: f.num(records.length, 0) },
                {
                    label: f.t('attendance.hours', { defaultValue: 'Hours' }),
                    value: f.num(sum(records.map(hours)), 1),
                },
            ]
            : [],
        tables: keep([table]),
    };
};

const collectTasks = async (config: ExportConfig, f: Fmt): Promise<Collected> => {
    if (!config.farmId) throw new Error('tasks export needs a farmId');
    const s = config.sections;
    const [scope, all] = await Promise.all([
        resolveScope(config.farmId, config.pondId, undefined),
        s.summary ? tasksApi.getAll(config.farmId).then((r) => listOf<Task>(r.data)) : [],
    ]);

    // A template mints tasks, it is not one. "Water test — every day" with no
    // date is noise in a printed list.
    const tasks = all
        .filter((tk) => !tk.isTemplate)
        .filter((tk) => (config.pondId ? tk.pondId === config.pondId : true))
        .filter((tk) => inRange(tk.dueDate ?? tk.createdAt, config.startDate, config.endDate));

    const table: ReportTable = {
        key: 'summary',
        title: f.t('tasks.title', { defaultValue: 'Tasks' }),
        columns: [
            f.t('tasks.dueDate', { defaultValue: 'Due date' }),
            f.t('tasks.taskTitle', { defaultValue: 'Task' }),
            f.t('tasks.type', { defaultValue: 'Type' }),
            f.t('common.status'),
            f.t('tasks.priority', { defaultValue: 'Priority' }),
        ],
        rows: byDateDesc(tasks, (tk) => tk.dueDate ?? tk.createdAt).map((tk) => [
            f.date(tk.dueDate), f.text(tk.title), f.text(tk.type), f.text(tk.status), f.text(tk.priority),
        ]),
    };

    return {
        scope,
        stats: s.summary
            ? [
                { label: f.t('tasks.title', { defaultValue: 'Tasks' }), value: f.num(tasks.length, 0) },
                {
                    label: f.t('tasks.statusOpen', { defaultValue: 'Open' }),
                    value: f.num(tasks.filter((tk) => tk.status === 'open' || tk.status === 'in_progress').length, 0),
                },
                {
                    label: f.t('tasks.statusDone', { defaultValue: 'Done' }),
                    value: f.num(tasks.filter((tk) => tk.status === 'done' || tk.status === 'verified').length, 0),
                },
            ]
            : [],
        tables: keep([table]),
    };
};

const DOC_TITLE_KEYS: Record<ExportConfig['dataset'], [string, string]> = {
    cycle: ['cycles.reportTitle', 'Cycle report'],
    pondLogs: ['ponds.reportTitle', 'Pond records'],
    money: ['finance.reportTitle', 'Money report'],
    inventory: ['inventory.reportTitle', 'Inventory report'],
    attendance: ['attendance.reportTitle', 'Attendance report'],
    tasks: ['tasks.reportTitle', 'Task report'],
};

/**
 * Which datasets actually FILTER on `startDate`/`endDate`.
 *
 * The screen offers the period chips for every dataset, and the document
 * header printed the chosen range on every dataset — including the two that
 * ignore it. So a farmer picked "This month", and a cycle report came out
 * covering the whole cycle with "1 Sep – 30 Sep" across the top, and an
 * inventory report came out as a snapshot of stock RIGHT NOW under the same
 * line. The numbers were right; the header was describing a different document.
 *
 * Both are deliberately whole-of-scope and stay that way:
 *  - a cycle report is the cycle. Its summary stats (FCR, survival, totals)
 *    are cycle-wide, so range-filtering the tables underneath them would only
 *    make the tables disagree with the stats above them.
 *  - inventory is stock as it stands; there is no historical quantity to
 *    filter. Its own scope line (farm, cycle) already says what it covers.
 *
 * So the fix is to stop printing the claim, not to start honouring it.
 */
const HONOURS_PERIOD: Record<ExportConfig['dataset'], boolean> = {
    cycle: false,
    pondLogs: true,
    money: true,
    inventory: false,
    attendance: true,
    tasks: true,
};

const COLLECTORS: Record<ExportConfig['dataset'], (c: ExportConfig, f: Fmt) => Promise<Collected>> = {
    cycle: collectCycle,
    pondLogs: collectPondLogs,
    money: collectMoney,
    inventory: collectInventory,
    attendance: collectAttendance,
    tasks: collectTasks,
};

/**
 * Build the finished, translated, formatted document model.
 *
 * `now` is injectable so the generated-at line is testable; nothing else here
 * reads the clock.
 */
export const collectReport = async (config: ExportConfig, now: Date = new Date()): Promise<ReportData> => {
    // Before the first t(). See the file header.
    await loadLocale(config.language);
    const f = makeFmt(config.language);

    const { scope, stats, tables } = await COLLECTORS[config.dataset](config, f);

    const [titleKey, titleDefault] = DOC_TITLE_KEYS[config.dataset];
    const period = HONOURS_PERIOD[config.dataset] && (config.startDate || config.endDate)
        ? `${config.startDate ? f.date(config.startDate) : DASH} – ${config.endDate ? f.date(config.endDate) : DASH}`
        : undefined;

    return {
        meta: {
            documentTitle: f.t(titleKey, { defaultValue: titleDefault }),
            farmName: scope.farmName,
            pondName: scope.pondName,
            cycleLabel: scope.cycleLabel,
            periodLabel: period,
            generatedAt: `${f.date(now)} ${f.time(now)}`,
            attribution: f.t('export.attribution', {
                defaultValue: 'Generated by {{app}}',
                app: f.t('common.appName'),
            }),
        },
        stats,
        tables,
        disclaimer: f.t('export.disclaimer', {
            defaultValue:
                'These figures are a record of what was entered in the app. They are decision support, not a guarantee of any outcome.',
        }),
    };
};

export default collectReport;

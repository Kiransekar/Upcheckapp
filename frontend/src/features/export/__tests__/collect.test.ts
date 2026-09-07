/**
 * collect() is the only export layer that touches the network, so these are
 * the tests that matter: the right tables come back, an excluded section is
 * never REQUESTED (not merely hidden), and the document language wins over the
 * app language even though its locale bundle is lazy-loaded.
 */

import { ALL_SECTIONS, type ExportConfig, type ExportSections } from '../types';

const ok = <T>(data: T) => Promise.resolve({ data } as { data: T });

jest.mock('../../../api/crops', () => ({
    cropsApi: { getById: jest.fn() },
    computeDoc: jest.fn(() => 42),
}));
jest.mock('../../../api/ponds', () => ({ pondsApi: { getById: jest.fn() } }));
jest.mock('../../../api/farms', () => ({ farmsApi: { getById: jest.fn() } }));
jest.mock('../../../api/pondContext', () => ({ pondContextApi: { get: jest.fn() } }));
jest.mock('../../../api/waterQuality', () => ({ waterQualityApi: { getAll: jest.fn() } }));
jest.mock('../../../api/feedRecords', () => ({ feedApi: { getAll: jest.fn(), getByCrop: jest.fn() } }));
jest.mock('../../../api/sampling', () => ({ samplingApi: { getByCrop: jest.fn() } }));
jest.mock('../../../api/mortalities', () => ({ mortalityApi: { getByCrop: jest.fn() } }));
jest.mock('../../../api/treatments', () => ({ treatmentsApi: { getByCrop: jest.fn() } }));
jest.mock('../../../api/harvests', () => ({ harvestsApi: { getByCrop: jest.fn(), getByPond: jest.fn() } }));
jest.mock('../../../api/expenses', () => ({
    expensesApi: { list: jest.fn(), findByCycle: jest.fn(), getCycleFinancials: jest.fn() },
}));
jest.mock('../../../api/transactions', () => ({ transactionsApi: { getAll: jest.fn() } }));
jest.mock('../../../api/reports', () => ({
    reportsApi: { getCycleAnalysis: jest.fn(), getFinancialReport: jest.fn() },
}));
jest.mock('../../../api/inventory', () => ({
    inventoryApi: { getAll: jest.fn() },
    isLowStock: jest.fn(() => false),
}));
jest.mock('../../../api/attendance', () => ({ attendanceApi: { getAll: jest.fn() } }));
jest.mock('../../../api/tasks', () => ({ tasksApi: { getAll: jest.fn() } }));

import { cropsApi } from '../../../api/crops';
import { pondsApi } from '../../../api/ponds';
import { farmsApi } from '../../../api/farms';
import { pondContextApi } from '../../../api/pondContext';
import { waterQualityApi } from '../../../api/waterQuality';
import { feedApi } from '../../../api/feedRecords';
import { samplingApi } from '../../../api/sampling';
import { mortalityApi } from '../../../api/mortalities';
import { treatmentsApi } from '../../../api/treatments';
import { harvestsApi } from '../../../api/harvests';
import { expensesApi } from '../../../api/expenses';
import { transactionsApi } from '../../../api/transactions';
import { reportsApi } from '../../../api/reports';
import { inventoryApi } from '../../../api/inventory';
import { attendanceApi } from '../../../api/attendance';
import { tasksApi } from '../../../api/tasks';
import { collectReport } from '../collect';

const config = (over: Partial<ExportConfig> = {}): ExportConfig => ({
    dataset: 'cycle',
    format: 'csv',
    sections: { ...ALL_SECTIONS },
    language: 'en',
    ...over,
});

const sections = (off: Partial<ExportSections>): ExportSections => ({ ...ALL_SECTIONS, ...off });

beforeEach(() => {
    jest.clearAllMocks();

    (farmsApi.getById as jest.Mock).mockReturnValue(ok({ id: 'f1', name: 'Green Acres' }));
    (pondsApi.getById as jest.Mock).mockReturnValue(ok({ id: 'p1', name: 'Pond 3' }));
    (cropsApi.getById as jest.Mock).mockReturnValue(
        ok({ id: 'c1', pondId: 'p1', farmId: 'f1', name: 'Cycle 7', cropCode: 'C-7', stockingCount: 120000, stockingDate: '2026-06-01', status: 'active' }),
    );
    (pondContextApi.get as jest.Mock).mockReturnValue(ok({ pondId: 'p1', farmId: 'f1', cropId: 'c1' }));
    (reportsApi.getCycleAnalysis as jest.Mock).mockReturnValue(
        ok({ cycleId: 'c1', fcr: 1.42, totalFeedKg: 900, totalHarvestKg: 640, survivalRate: 78.5, growthChart: [] }),
    );
    (reportsApi.getFinancialReport as jest.Mock).mockReturnValue(
        ok({ revenue: 500000, totalExpenses: 300000, profit: 200000, expensesByCategory: [] }),
    );
    (waterQualityApi.getAll as jest.Mock).mockReturnValue(
        ok([{ id: 'w1', pondId: 'p1', ph: 8.1, dissolvedOxygen: 5.2, recordedAt: '2026-08-24T06:00:00.000Z' }]),
    );
    (feedApi.getByCrop as jest.Mock).mockReturnValue(
        ok([{ id: 'fr1', pondId: 'p1', feedType: 'Starter', quantityKg: 12.5, recordedAt: '2026-08-24T06:00:00.000Z' }]),
    );
    (feedApi.getAll as jest.Mock).mockReturnValue(
        ok([{ id: 'fr1', pondId: 'p1', feedType: 'Starter', quantityKg: 12.5, recordedAt: '2026-08-24T06:00:00.000Z' }]),
    );
    (samplingApi.getByCrop as jest.Mock).mockReturnValue(
        ok([{ id: 's1', pondId: 'p1', samplingDate: '2026-08-20', mbwG: 18.4 }]),
    );
    (mortalityApi.getByCrop as jest.Mock).mockReturnValue(
        ok([{ id: 'm1', cropId: 'c1', recordDate: '2026-08-18', quantity: 400 }]),
    );
    (treatmentsApi.getByCrop as jest.Mock).mockReturnValue(
        ok([{ id: 't1', cropId: 'c1', treatmentDate: '2026-08-15', description: 'Probiotic', createdAt: '', updatedAt: '' }]),
    );
    (harvestsApi.getByCrop as jest.Mock).mockReturnValue(
        ok([{ id: 'h1', cropId: 'c1', harvestDate: '2026-09-01', weightKg: 640, salePriceTotal: 500000, harvestType: 'full', status: 'sold', createdAt: '', updatedAt: '' }]),
    );
    (harvestsApi.getByPond as jest.Mock).mockReturnValue(ok([]));
    (expensesApi.findByCycle as jest.Mock).mockReturnValue(
        ok([{ id: 'e1', pondId: 'p1', userId: 'u', date: '2026-07-01', category: 'Feed', amount: 25000, createdAt: '', updatedAt: '' }]),
    );
    (expensesApi.list as jest.Mock).mockReturnValue(
        ok([{ id: 'e1', pondId: 'p1', userId: 'u', date: '2026-07-01', category: 'Feed', amount: 25000, createdAt: '', updatedAt: '' }]),
    );
    (expensesApi.getCycleFinancials as jest.Mock).mockReturnValue(
        ok({ totalRevenue: 500000, totalExpenses: 300000, netProfit: 200000, marginPercent: 40, expensesByCategory: {} }),
    );
    (transactionsApi.getAll as jest.Mock).mockReturnValue(
        ok([{ id: 'tx1', farmId: 'f1', transactionDate: '2026-08-02', type: 'income', category: 'Fish sales', amount: 90000, createdAt: '' }]),
    );
    (inventoryApi.getAll as jest.Mock).mockReturnValue(
        ok([{ id: 'i1', farmId: 'f1', name: 'Starter feed', category: 'feed', quantity: 40, unit: 'kg', unitPrice: 70, createdAt: '', updatedAt: '' }]),
    );
    (attendanceApi.getAll as jest.Mock).mockReturnValue(
        ok([{ id: 'a1', farmId: 'f1', userId: 'u1', checkInAt: '2026-08-24T02:00:00.000Z', checkOutAt: '2026-08-24T10:00:00.000Z', createdAt: '' }]),
    );
    (tasksApi.getAll as jest.Mock).mockReturnValue(
        ok([{ id: 'tk1', farmId: 'f1', title: 'Check aerators', type: 'AERATOR_CHECK', status: 'open', priority: 'high', dueDate: '2026-08-24', createdAt: '2026-08-20', updatedAt: '' }]),
    );
});

const keys = (tables: { key: string }[]) => tables.map((t) => t.key);

describe('collectReport — datasets', () => {
    it('builds every enabled section of a cycle report', async () => {
        const data = await collectReport(config({ cropId: 'c1' }));

        expect(keys(data.tables)).toEqual([
            'waterQuality', 'feed', 'sampling', 'mortality', 'treatments', 'costs', 'harvest',
        ]);
        expect(data.meta.farmName).toBe('Green Acres');
        expect(data.meta.pondName).toBe('Pond 3');
        expect(data.meta.cycleLabel).toBe('Cycle 7 (C-7)');
        // Every cell is a finished string — no renderer downstream formats.
        for (const table of data.tables) {
            for (const row of table.rows) for (const cell of row) expect(typeof cell).toBe('string');
        }
    });

    it('formats money and totals in the cycle cost table', async () => {
        const data = await collectReport(config({ cropId: 'c1' }));
        const costs = data.tables.find((t) => t.key === 'costs')!;
        expect(costs.rows[0][3]).toBe('₹25,000');
        expect(costs.total?.[3]).toBe('₹25,000');
    });

    it('collects pond logs and honours the date range', async () => {
        const data = await collectReport(
            config({ dataset: 'pondLogs', pondId: 'p1', startDate: '2026-08-01', endDate: '2026-08-19' }),
        );
        // The 24 Aug water reading and the 20 Aug sampling are outside it.
        expect(keys(data.tables)).toEqual(['mortality', 'treatments']);
    });

    it('collects money from the server-filtered endpoints', async () => {
        const data = await collectReport(
            config({ dataset: 'money', farmId: 'f1', startDate: '2026-08-01', endDate: '2026-08-31' }),
        );
        expect(expensesApi.list).toHaveBeenCalledWith(
            expect.objectContaining({ farmId: 'f1', startDate: '2026-08-01', endDate: '2026-08-31' }),
        );
        expect(keys(data.tables)).toEqual(['harvest', 'costs', 'costs']);
    });

    it('collects inventory, attendance and tasks', async () => {
        const inventory = await collectReport(config({ dataset: 'inventory', farmId: 'f1' }));
        expect(inventory.tables[0].rows[0][0]).toBe('Starter feed');

        const attendance = await collectReport(config({ dataset: 'attendance', farmId: 'f1' }));
        expect(attendanceApi.getAll).toHaveBeenCalledWith('f1', undefined, undefined, undefined);
        expect(attendance.tables[0].rows[0][4]).toBe('8'); // 02:00 -> 10:00

        const tasks = await collectReport(config({ dataset: 'tasks', farmId: 'f1' }));
        expect(tasks.tables[0].rows[0][1]).toBe('Check aerators');
    });
});

describe('collectReport — excluded sections', () => {
    it('omits the table a farmer switched off', async () => {
        const data = await collectReport(
            config({ cropId: 'c1', sections: sections({ costs: false, treatments: false }) }),
        );
        expect(keys(data.tables)).not.toContain('costs');
        expect(keys(data.tables)).not.toContain('treatments');
    });

    it('does not even FETCH an excluded section', async () => {
        await collectReport(config({ cropId: 'c1', sections: sections({ costs: false, waterQuality: false }) }));

        expect(expensesApi.findByCycle).not.toHaveBeenCalled();
        expect(expensesApi.getCycleFinancials).not.toHaveBeenCalled();
        expect(waterQualityApi.getAll).not.toHaveBeenCalled();
        // …and still fetched the ones that stayed on.
        expect(feedApi.getByCrop).toHaveBeenCalled();
    });

    it('keeps the cost breakdown out of a buyer copy entirely', async () => {
        const data = await collectReport(config({ cropId: 'c1', sections: sections({ costs: false }) }));

        expect(data.stats.map((s) => s.label)).not.toContain('Total Expenses');
        const harvest = data.tables.find((t) => t.key === 'harvest')!;
        expect(harvest.columns).not.toContain('Sale');
        expect(JSON.stringify(data)).not.toContain('500,000');
    });

    it('does not request income when the money report excludes it', async () => {
        await collectReport(config({ dataset: 'money', farmId: 'f1', sections: sections({ harvest: false }) }));
        expect(transactionsApi.getAll).not.toHaveBeenCalledWith('f1', 'income', expect.anything());
    });
});

/**
 * Every pg `numeric`/`decimal` column reaches the app as a STRING, whatever
 * the api/*.ts interface claims: quantity_kg, dosage_kg, estimated_weight_kg,
 * inventory.quantity, and every money `amount`. Both halves of the formatter
 * quietly disagreed about that, in one table:
 *
 *   rows  → f.num('12.5')  fell through Number.prototype.toLocaleString to
 *           String.prototype.toLocaleString, which ignores its arguments and
 *           hands back the raw column text.
 *   total → sum() scored anything failing `typeof b === 'number'` as 0.
 *
 * So a feed table listed 20 kg of feed over a Total row reading 0.
 */
describe('collectReport — pg numeric columns arrive as strings', () => {
    it('totals a feed table whose quantities are numeric strings', async () => {
        (feedApi.getByCrop as jest.Mock).mockReturnValue(
            ok([
                { id: 'fr1', pondId: 'p1', feedType: 'Starter', quantityKg: '12.50', recordedAt: '2026-08-24T06:00:00.000Z' },
                { id: 'fr2', pondId: 'p1', feedType: 'Grower', quantityKg: '7.50', recordedAt: '2026-08-23T06:00:00.000Z' },
            ]),
        );

        const data = await collectReport(config({ cropId: 'c1' }));
        const feed = data.tables.find((t) => t.key === 'feed')!;

        expect(feed.total?.[3]).toBe('20');
        // …and the rows are formatted, not echoed back as the raw column text.
        expect(feed.rows[0][3]).toBe('12.5');
    });

    it('totals money whose amounts are numeric strings', async () => {
        (expensesApi.findByCycle as jest.Mock).mockReturnValue(
            ok([
                { id: 'e1', pondId: 'p1', userId: 'u', date: '2026-07-01', category: 'Feed', amount: '25000.00', createdAt: '', updatedAt: '' },
                { id: 'e2', pondId: 'p1', userId: 'u', date: '2026-07-02', category: 'Fuel', amount: '5000.00', createdAt: '', updatedAt: '' },
            ]),
        );

        const data = await collectReport(config({ cropId: 'c1' }));
        const costs = data.tables.find((t) => t.key === 'costs')!;

        expect(costs.total?.[3]).toBe('₹30,000');
    });

    it('sums a pond-log feed stat that the table below it also shows', async () => {
        (feedApi.getAll as jest.Mock).mockReturnValue(
            ok([{ id: 'fr1', pondId: 'p1', feedType: 'Starter', quantityKg: '12.5', recordedAt: '2026-08-24T06:00:00.000Z' }]),
        );

        const data = await collectReport(config({ dataset: 'pondLogs', pondId: 'p1' }));

        // The summary stat and the table it summarises must not disagree.
        expect(data.stats.find((s) => s.label === 'Feed History')?.value).toBe('12.5 kg');
    });
});

/**
 * `startDate`/`endDate` are DEVICE-LOCAL days (moneyPeriodRange builds them
 * with toLocalISODate). The filter compared them against the first ten
 * characters of an ISO timestamp, which is the UTC day — so for IST (UTC+5:30)
 * everything logged between 00:00 and 05:30 local fell into the previous day
 * and vanished from an export of "today", while the pond's own history screen
 * went on showing it.
 */
describe('collectReport — date ranges bucket by the LOCAL day', () => {
    const realTz = process.env.TZ;
    beforeAll(() => {
        process.env.TZ = 'Asia/Kolkata';
    });
    afterAll(() => {
        process.env.TZ = realTz;
    });

    it('keeps a pre-dawn IST record on its own local day', async () => {
        // 04:00 IST on 24 Aug is 22:30 UTC on the 23rd.
        (feedApi.getAll as jest.Mock).mockReturnValue(
            ok([{ id: 'fr1', pondId: 'p1', feedType: 'Starter', quantityKg: 12.5, recordedAt: '2026-08-23T22:30:00.000Z' }]),
        );
        (waterQualityApi.getAll as jest.Mock).mockReturnValue(ok([]));
        (harvestsApi.getByPond as jest.Mock).mockReturnValue(ok([]));

        const data = await collectReport(
            config({ dataset: 'pondLogs', pondId: 'p1', startDate: '2026-08-24', endDate: '2026-08-24' }),
        );

        expect(keys(data.tables)).toContain('feed');
    });

    it('still excludes a record that is genuinely outside the range', async () => {
        (feedApi.getAll as jest.Mock).mockReturnValue(
            ok([{ id: 'fr1', pondId: 'p1', feedType: 'Starter', quantityKg: 12.5, recordedAt: '2026-08-20T06:00:00.000Z' }]),
        );
        (waterQualityApi.getAll as jest.Mock).mockReturnValue(ok([]));
        (harvestsApi.getByPond as jest.Mock).mockReturnValue(ok([]));

        const data = await collectReport(
            config({ dataset: 'pondLogs', pondId: 'p1', startDate: '2026-08-24', endDate: '2026-08-24' }),
        );

        expect(keys(data.tables)).not.toContain('feed');
    });

    it('leaves a bare YYYY-MM-DD date column alone', async () => {
        // A pg `date` (sampling/treatment/mortality) is already a calendar day.
        // Parsing it would re-read it as UTC midnight and shift it a day back
        // in any zone west of UTC.
        (mortalityApi.getByCrop as jest.Mock).mockReturnValue(
            ok([{ id: 'm1', cropId: 'c1', recordDate: '2026-08-24', quantity: 400 }]),
        );
        (feedApi.getAll as jest.Mock).mockReturnValue(ok([]));
        (waterQualityApi.getAll as jest.Mock).mockReturnValue(ok([]));
        (harvestsApi.getByPond as jest.Mock).mockReturnValue(ok([]));

        const data = await collectReport(
            config({ dataset: 'pondLogs', pondId: 'p1', startDate: '2026-08-24', endDate: '2026-08-24' }),
        );

        expect(keys(data.tables)).toContain('mortality');
    });
});

describe('collectReport — inventory honours the costs toggle', () => {
    // The rendered labels, so the negative assertions below cannot pass by
    // matching a string the document never contained under any setting.
    const UNIT_PRICE = 'Unit price';
    const STOCK_VALUE = 'Stock value';

    const inventoryConfig = (costs: boolean) =>
        config({ dataset: 'inventory', farmId: 'f1', sections: sections({ costs }) });

    it('drops unit price and stock value from a copy with costs switched off', async () => {
        // The screen also switches costs off for anyone without VIEW_FINANCIALS,
        // so this is the same guard that stops a worker exporting what the farm
        // paid for its feed.
        const data = await collectReport(inventoryConfig(false));

        expect(data.tables[0].columns).not.toContain(UNIT_PRICE);
        expect(data.stats.map((s) => s.label)).not.toContain(STOCK_VALUE);
        expect(JSON.stringify(data)).not.toContain('₹');
    });

    it('includes them when costs are switched on', async () => {
        const data = await collectReport(inventoryConfig(true));

        expect(data.tables[0].columns).toContain(UNIT_PRICE);
        expect(data.stats.map((s) => s.label)).toContain(STOCK_VALUE);
        // 40 units at ₹70 — and quantity/unitPrice are pg numeric strings.
        expect(data.stats.find((s) => s.label === STOCK_VALUE)?.value).toBe('₹2,800');
    });
});

/**
 * The screen offers the period chips for every dataset and the header printed
 * the chosen range on every dataset — including the two whose collector never
 * looks at it. A cycle report covering the whole cycle came out stamped
 * "1 Aug – 31 Aug", and an inventory snapshot of stock RIGHT NOW came out under
 * the same line. The numbers were right; the header described another document.
 */
describe('collectReport — the period label only claims a range that was applied', () => {
    const range = { startDate: '2026-08-01', endDate: '2026-08-31' };

    it('omits it from a cycle report, which is always the whole cycle', async () => {
        const data = await collectReport(config({ cropId: 'c1', ...range }));
        expect(data.meta.periodLabel).toBeUndefined();
        // The scope line still says what the document covers.
        expect(data.meta.cycleLabel).toBe('Cycle 7 (C-7)');
    });

    it('omits it from an inventory report, which is a snapshot', async () => {
        const data = await collectReport(config({ dataset: 'inventory', farmId: 'f1', ...range }));
        expect(data.meta.periodLabel).toBeUndefined();
    });

    it('keeps it where the rows really were filtered', async () => {
        const data = await collectReport(config({ dataset: 'pondLogs', pondId: 'p1', ...range }));
        expect(data.meta.periodLabel).toBe('1 Aug 2026 – 31 Aug 2026');
    });
});

describe('collectReport — document language', () => {
    it('renders in the DOCUMENT language, not the app language', async () => {
        // The app is English (setupTests initialises i18n at 'en'); the farmer
        // asked for a Tamil document, whose bundle is lazily loaded.
        const data = await collectReport(config({ cropId: 'c1', language: 'ta' }));

        const water = data.tables.find((t) => t.key === 'waterQuality')!;
        expect(water.title).toBe('நீர் தர வரலாறு');
        expect(water.columns[0]).toBe('தேதி');
        // Never a raw key — that is what a missing lazy bundle looks like.
        expect(JSON.stringify(data)).not.toMatch(/history\.[a-zA-Z]/);
    });

    it('leaves the app language untouched', async () => {
        const i18nModule = require('../../../i18n').default;
        await collectReport(config({ cropId: 'c1', language: 'ta' }));
        expect(i18nModule.language).toBe('en');
    });
});

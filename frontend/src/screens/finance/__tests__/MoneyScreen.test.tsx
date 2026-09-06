// Money opens on EVERY farm combined. The reported symptom was "that money
// screen is showing only for selected farm and not overall all farms" — a
// farmer with three farms had to visit three Money tabs and add them up to
// answer the one question this screen exists for.
jest.mock('../../../api/farms', () => ({
    farmsApi: { getAll: jest.fn() },
}));
jest.mock('../../../api/reports', () => ({
    reportsApi: { getFinancialReport: jest.fn() },
}));
jest.mock('../../../api/transactions', () => ({
    transactionsApi: { getAll: jest.fn() },
}));
jest.mock('../../../api/credit', () => ({
    creditApi: { list: jest.fn() },
}));
// The tab is now ONE request. It used to fan out to 3 + N calls from the phone,
// which at ~265ms of network per request from rural India was the load time
// itself. These tests cover what the SCREEN does with the data, so they drive
// the batched call directly.
jest.mock('../../../api/moneyOverview', () => ({
    fetchMoneyOverview: jest.fn(),
}));
// Pond, cycle and the server-filtered expense list — the money below the farm
// figures. Costs recorded against a CYCLE are not in the transaction list, so
// this is the only path that can answer "what did this pond cost me".
jest.mock('../../../api/ponds', () => ({
    pondsApi: { getAll: jest.fn() },
}));
jest.mock('../../../api/crops', () => ({
    cropsApi: { getAll: jest.fn() },
}));
jest.mock('../../../api/expenses', () => ({
    expensesApi: { list: jest.fn() },
}));
jest.mock('../../../hooks/usePermissions', () => ({
    usePermissions: () => ({ canViewFinancials: true }),
}));
jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useFocusEffect: (effect: () => void) => {
            const React = require('react');
            React.useEffect(effect, []);
        },
    };
});

import React from 'react';
import { StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MoneyScreen, combineReports } from '../MoneyScreen';
import { farmsApi } from '../../../api/farms';
import { reportsApi } from '../../../api/reports';
import { transactionsApi } from '../../../api/transactions';
import { creditApi } from '../../../api/credit';
import { pondsApi } from '../../../api/ponds';
import { cropsApi } from '../../../api/crops';
import { expensesApi } from '../../../api/expenses';
import { fetchMoneyOverview } from '../../../api/moneyOverview';
import { theme } from '../../../theme';
import { queryClient } from '../../../query/client';

const FARMS = [
    { id: 'f1', name: 'North Farm' },
    { id: 'f2', name: 'South Farm' },
];

const REPORTS: Record<string, any> = {
    f1: { revenue: 300000, totalExpenses: 100000, profit: 200000, expensesByCategory: [{ category: 'Feed', amount: 100000 }] },
    f2: { revenue: 50000, totalExpenses: 90000, profit: -40000, expensesByCategory: [{ category: 'Feed', amount: 90000 }] },
};

let reportsInScope: Record<string, any> = {};

const renderScreen = () =>
    render(
        <SafeAreaProvider
            initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
        >
            <MoneyScreen navigation={{ navigate: jest.fn() }} route={{ params: {} }} />
        </SafeAreaProvider>,
    );

let entriesInScope: any[] = [];

beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    // Each test starts from an empty cache: the query key now carries the
    // filters, so a leaked entry from a previous test is a different question's
    // answer served for this one.
    queryClient.clear();
    (pondsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (cropsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (expensesApi.list as jest.Mock).mockResolvedValue({ data: [] });
    (farmsApi.getAll as jest.Mock).mockResolvedValue({ data: FARMS });
    (reportsApi.getFinancialReport as jest.Mock).mockImplementation((id: string) =>
        Promise.resolve({ data: REPORTS[id] }),
    );
    (transactionsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (creditApi.list as jest.Mock).mockResolvedValue({ data: [] });
    reportsInScope = REPORTS;
    entriesInScope = [];
    (fetchMoneyOverview as jest.Mock).mockImplementation(async () => ({
        farms: FARMS,
        reports: reportsInScope,
        allEntries: entriesInScope,
        credit: [],
    }));
});

describe('combineReports', () => {
    it('sums revenue, expenses and profit and merges categories', () => {
        const out = combineReports([REPORTS.f1, REPORTS.f2])!;
        expect(out.revenue).toBe(350000);
        expect(out.totalExpenses).toBe(190000);
        expect(out.profit).toBe(160000);
        expect(out.expensesByCategory).toEqual([{ category: 'Feed', amount: 190000 }]);
    });

    // A farm's own profit definition lives on the backend; recomputing it here
    // as revenue − expenses would make the total silently disagree with the
    // per-farm rows printed directly underneath it.
    it('sums the backend profit rather than recomputing it', () => {
        const out = combineReports([
            { revenue: 100, totalExpenses: 40, profit: 25, expensesByCategory: [] },
        ])!;
        expect(out.profit).toBe(25);
    });

    it('returns null for no farms, so the screen shows a dash not ₹0', () => {
        expect(combineReports([])).toBeNull();
    });
});

describe('MoneyScreen', () => {
    it('defaults to every farm combined', async () => {
        const { getByText, getAllByText } = renderScreen();
        // 300000 + 50000 − 100000 − 90000 = +160000 → "+₹1.6 L"
        await waitFor(() => expect(getByText('+₹1.6 L')).toBeTruthy());
        // Twice on purpose: the header eyebrow says what you are looking at,
        // the chip is how you change it.
        expect(getAllByText('All farms')).toHaveLength(2);
    });

    it('breaks the combined total down per farm', async () => {
        const { getByText } = renderScreen();
        await waitFor(() => expect(getByText('By farm')).toBeTruthy());
        // Worst first — the farm losing money is the one worth opening.
        expect(getByText('−₹40,000')).toBeTruthy();
        expect(getByText('+₹2.0 L')).toBeTruthy();
    });

    it('narrows to one farm when its chip is tapped', async () => {
        const { getByText, getAllByText, queryByText } = renderScreen();
        await waitFor(() => expect(getByText('By farm')).toBeTruthy());

        // [0] is the chip, [1] the by-farm row. Press the ROW — it is the
        // drill-down a farmer reaches for after spotting the losing farm.
        fireEvent.press(getAllByText('South Farm')[1]);

        await waitFor(() => expect(queryByText('By farm')).toBeNull());
        // South Farm's own net, no longer netted against North Farm's profit.
        expect(getByText('−₹40,000')).toBeTruthy();
    });

    // Financials are per-farm capability. A farm we cannot read must be absent
    // from the by-farm list too, or the rows would not add up to the hero.
    it('leaves out a farm whose report is forbidden', async () => {
        // The server omits a farm the caller may not view financials on.
        reportsInScope = { f1: REPORTS.f1 };
        const { getByText, queryByText } = renderScreen();

        await waitFor(() => expect(getByText('+₹2.0 L')).toBeTruthy());
        expect(queryByText('South Farm')).toBeNull();
        // One readable farm needs no chips and no breakdown.
        expect(queryByText('By farm')).toBeNull();
    });

    // A green "+₹0" is a claim about the farm; nothing recorded is the
    // absence of a claim. Those are opposite facts and used to look identical.
    it('says nothing is recorded rather than showing a zero net', async () => {
        const zero = { revenue: 0, totalExpenses: 0, profit: 0, expensesByCategory: [] };
        reportsInScope = { f1: zero, f2: zero };
        const { findByText, queryByText } = renderScreen();

        expect(await findByText('Nothing recorded yet')).toBeTruthy();
        // And no by-farm breakdown either: a column of "+₹0" under
        // "nothing recorded" is the same claim in smaller type.
        expect(queryByText('By farm')).toBeNull();
    });

    it('shows the net once anything has been recorded', async () => {
        const loss = { revenue: 0, totalExpenses: 5000, profit: -5000, expensesByCategory: [] };
        reportsInScope = { f1: loss, f2: loss };
        const { findAllByText, queryByText } = renderScreen();

        // The hero, plus a by-farm row for each of the two farms — both
        // farms are mocked to the same report here.
        expect((await findAllByText('−₹5,000')).length).toBeGreaterThan(0);
        expect(queryByText('Nothing recorded yet')).toBeNull();
    });

    it('shows the empty state when no farm has readable financials', async () => {
        (fetchMoneyOverview as jest.Mock).mockResolvedValue({ farms: [], reports: {}, allEntries: [], credit: [] });
        const { getByText } = renderScreen();
        await waitFor(() => expect(getByText('No farms yet')).toBeTruthy());
    });
});

// ── Period, toggles, archived ponds ────────────────────────────────────────
//
// "There is no this week, today, this month, custom date range in money
// screen… Should show archived ponds money data also but hint with different
// colour… and a toggle to include or exclude." Every one of these filters is a
// REQUEST parameter, not a client-side slice: costs recorded against a cycle
// never reach the phone in `allEntries`, so filtering locally could not have
// answered the question at all.
describe('MoneyScreen filters', () => {
    const lastOverviewCall = () =>
        (fetchMoneyOverview as jest.Mock).mock.calls[
            (fetchMoneyOverview as jest.Mock).mock.calls.length - 1
        ]?.[0];

    it('asks for everything, archived and inventory included, by default', async () => {
        const { getByText } = renderScreen();
        await waitFor(() => expect(getByText('+₹1.6 L')).toBeTruthy());
        expect(lastOverviewCall()).toEqual(
            expect.objectContaining({
                startDate: null,
                endDate: null,
                includeArchivedPonds: true,
                includeInventoryPurchases: true,
            }),
        );
    });

    it('sends a date range when a period is chosen', async () => {
        const { getByText } = renderScreen();
        await waitFor(() => expect(getByText('+₹1.6 L')).toBeTruthy());

        fireEvent.press(getByText('Today'));

        await waitFor(() => {
            const call = lastOverviewCall();
            expect(call.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(call.endDate).toBe(call.startDate);
        });
    });

    // The toggle is the whole point of D3 — it has to reach the server, or the
    // farmer excludes archived ponds and the total does not move.
    it('excludes archived ponds from the REQUEST when the toggle is turned off', async () => {
        const { getByText, getByLabelText } = renderScreen();
        await waitFor(() => expect(getByText('+₹1.6 L')).toBeTruthy());

        fireEvent(getByLabelText('Count archived ponds'), 'valueChange', false);

        await waitFor(() =>
            expect(lastOverviewCall()).toEqual(
                expect.objectContaining({ includeArchivedPonds: false }),
            ),
        );
    });

    it('drops inventory purchases from the REQUEST when that toggle is turned off', async () => {
        const { getByText, getByLabelText } = renderScreen();
        await waitFor(() => expect(getByText('+₹1.6 L')).toBeTruthy());

        fireEvent(getByLabelText('Count inventory purchases'), 'valueChange', false);

        await waitFor(() =>
            expect(lastOverviewCall()).toEqual(
                expect.objectContaining({ includeInventoryPurchases: false }),
            ),
        );
    });

    it('remembers the toggles across a remount', async () => {
        const first = renderScreen();
        await waitFor(() => expect(first.getByText('+₹1.6 L')).toBeTruthy());
        fireEvent(first.getByLabelText('Count archived ponds'), 'valueChange', false);
        await waitFor(() => expect(first.getByLabelText('Count archived ponds').props.value).toBe(false));
        first.unmount();

        const second = renderScreen();
        await waitFor(() =>
            expect(second.getByLabelText('Count archived ponds').props.value).toBe(false),
        );
    });

    // The report's per-pond split is the ONLY thing that knows how much came
    // from a retired pond — a transaction hangs off a farm and has no pond.
    it('says what the archived toggle is worth, from the per-pond split', async () => {
        reportsInScope = {
            f1: {
                ...REPORTS.f1,
                ponds: [
                    { pondId: 'p1', name: 'Pond 1', archived: false, revenue: 200000, expenses: 60000 },
                    { pondId: 'p2', name: 'Pond 2', archived: true, revenue: 30000, expenses: 10000 },
                ],
            },
        };
        const { findByText } = renderScreen();
        // 30000 + 10000 of the figures above came from the retired pond.
        expect(await findByText('₹40,000 of the figures above.')).toBeTruthy();
    });

    // The entry list is farm-level and cannot mark archived rows at all. Its
    // silence must not be readable as "there is no archived money here".
    /**
     * "I added expense inside a pond but it didnt show inside the money screen."
     *
     * Pond costs live in a different table from the entries this list rendered,
     * so the headline moved and nothing on screen explained why. The backend
     * merges them in now; the screen has to render one, say which pond it came
     * from, and mark it when that pond is retired — the one row shape here that
     * genuinely knows.
     */
    it('renders a pond cost, names its pond, and marks an archived one', async () => {
        entriesInScope = [
            {
                id: 'expense:e1',
                source: 'expense',
                farmId: 'f1',
                pondId: 'p2',
                pondName: 'North pond',
                transactionDate: '2026-03-02',
                type: 'expense',
                category: 'Feed',
                amount: 8000,
                description: 'Starter feed',
                archived: true,
            },
        ];
        const { findByText } = renderScreen();

        expect(await findByText('Starter feed')).toBeTruthy();
        expect(await findByText(/North pond/)).toBeTruthy();
        expect(await findByText(/Archived/)).toBeTruthy();
    });

    it('says a farm-level entry has no pond to mark, rather than implying none is archived', async () => {
        reportsInScope = {
            f1: {
                ...REPORTS.f1,
                ponds: [
                    { pondId: 'p2', name: 'Pond 2', archived: true, revenue: 30000, expenses: 10000 },
                ],
            },
        };
        entriesInScope = [
            {
                id: 't1',
                farmId: 'f1',
                transactionDate: '2026-03-01',
                type: 'expense',
                category: 'Feed',
                amount: 500,
                description: 'Feed',
                // What the backend really sends on every transaction.
                archived: false,
            },
        ];
        const { findByText } = renderScreen();
        expect(
            await findByText(/an entry recorded against the farm has no pond to mark/),
        ).toBeTruthy();
    });

    it('stays quiet about archived money when there is none', async () => {
        reportsInScope = {
            f1: {
                ...REPORTS.f1,
                ponds: [
                    { pondId: 'p1', name: 'Pond 1', archived: false, revenue: 300000, expenses: 100000 },
                ],
            },
        };
        const { findByText, queryByText } = renderScreen();
        await findByText('+₹2.0 L');
        expect(queryByText(/Entries are recorded against the farm/)).toBeNull();
        expect(queryByText(/of the figures above/)).toBeNull();
    });

    // `startDate > endDate` is a 400. The farmer must never be able to build
    // that pair, so moving "From" past "To" drags "To" with it.
    it('never lets the custom range end before it starts', async () => {
        await AsyncStorage.setItem(
            'upcheck-money-prefs',
            JSON.stringify({
                period: 'custom',
                customStart: '2026-03-10',
                customEnd: '2026-03-20',
                includeArchivedPonds: true,
                includeInventoryPurchases: true,
            }),
        );
        const { getByText, getByLabelText } = renderScreen();
        await waitFor(() => expect(getByLabelText('From')).toBeTruthy());

        // Open the "From" picker and pick a day AFTER the current end.
        fireEvent.press(getByLabelText('From'));
        fireEvent.press(getByText('25'));

        await waitFor(() => {
            const call = lastOverviewCall();
            expect(call.startDate).toBe('2026-03-25');
            // Dragged forward, not left at 2026-03-20 and 400ing.
            expect(call.endDate).toBe('2026-03-25');
        });
    });
});

describe('MoneyScreen pond and cycle filter', () => {
    const PONDS = [
        { id: 'p1', farmId: 'f1', name: 'Pond 1', status: 'active' },
        { id: 'p2', farmId: 'f1', name: 'Pond 2', status: 'archived' },
    ];

    const openFarm = async () => {
        (pondsApi.getAll as jest.Mock).mockResolvedValue({ data: PONDS });
        const utils = renderScreen();
        await waitFor(() => expect(utils.getByText('By farm')).toBeTruthy());
        fireEvent.press(utils.getAllByText('North Farm')[1]);
        await waitFor(() => expect(utils.getByText('By pond')).toBeTruthy());
        return utils;
    };

    // Archived ponds are IN the picker — a farmer still needs to open the books
    // of a pond they retired — and say so in the label, not only in the colour.
    it('lists archived ponds, labelled', async () => {
        const { getByText } = await openFarm();
        expect(getByText('Pond 1')).toBeTruthy();
        expect(getByText(/Pond 2 · Archived/)).toBeTruthy();
    });

    it('asks the server for that pond\u2019s costs, with the filters attached', async () => {
        const { getByText } = await openFarm();

        fireEvent.press(getByText('Pond 1'));

        await waitFor(() =>
            expect(expensesApi.list).toHaveBeenCalledWith(
                expect.objectContaining({ farmId: 'f1', pondId: 'p1', includeArchivedPonds: true }),
            ),
        );
    });

    // Expense rows DO hang off a pond, so this is the one list that can mark
    // archived money. Colour is not a signal in bright sun or to a screen
    // reader, so the word carries it too.
    it('marks an archived expense row with the slate colour AND the word "Archived"', async () => {
        (expensesApi.list as jest.Mock).mockResolvedValue({
            data: [
                {
                    id: 'e1',
                    pondId: 'p1',
                    date: '2026-03-01',
                    category: 'Feed',
                    amount: 500,
                    description: 'Feed for the retired pond',
                    archived: true,
                },
            ],
        });
        const { getByText, findByText } = await openFarm();
        fireEvent.press(getByText('Pond 1'));

        const title = await findByText('Feed for the retired pond');
        expect(StyleSheet.flatten(title.props.style).color).toBe(theme.roles.light.staleText);
        // Not only the pond chip's own label — the ROW says it.
        expect(getByText(/Feed · Archived/)).toBeTruthy();
    });

    it('leaves a live expense row in the normal colour', async () => {
        (expensesApi.list as jest.Mock).mockResolvedValue({
            data: [
                {
                    id: 'e2',
                    pondId: 'p1',
                    date: '2026-03-01',
                    category: 'Feed',
                    amount: 500,
                    description: 'Feed for the live pond',
                },
            ],
        });
        const { getByText, findByText, queryByText } = await openFarm();
        fireEvent.press(getByText('Pond 1'));

        const title = await findByText('Feed for the live pond');
        expect(StyleSheet.flatten(title.props.style).color).not.toBe(theme.roles.light.staleText);
        expect(queryByText(/Feed · Archived/)).toBeNull();
    });

    it('narrows to one cycle when a cycle chip is tapped', async () => {
        (cropsApi.getAll as jest.Mock).mockResolvedValue({
            data: [{ id: 'c1', pondId: 'p1', name: 'Cycle 1', status: 'active' }],
        });
        const { getByText } = await openFarm();

        fireEvent.press(getByText('Pond 1'));
        await waitFor(() => expect(getByText('Cycle 1')).toBeTruthy());
        fireEvent.press(getByText('Cycle 1'));

        await waitFor(() =>
            expect(expensesApi.list).toHaveBeenCalledWith(
                expect.objectContaining({ pondId: 'p1', cropId: 'c1' }),
            ),
        );
    });
});

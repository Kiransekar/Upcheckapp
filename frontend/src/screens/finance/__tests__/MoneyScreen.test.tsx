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
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MoneyScreen, combineReports } from '../MoneyScreen';
import { farmsApi } from '../../../api/farms';
import { reportsApi } from '../../../api/reports';
import { transactionsApi } from '../../../api/transactions';
import { creditApi } from '../../../api/credit';

const FARMS = [
    { id: 'f1', name: 'North Farm' },
    { id: 'f2', name: 'South Farm' },
];

const REPORTS: Record<string, any> = {
    f1: { revenue: 300000, totalExpenses: 100000, profit: 200000, expensesByCategory: [{ category: 'Feed', amount: 100000 }] },
    f2: { revenue: 50000, totalExpenses: 90000, profit: -40000, expensesByCategory: [{ category: 'Feed', amount: 90000 }] },
};

const renderScreen = () =>
    render(
        <SafeAreaProvider
            initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
        >
            <MoneyScreen navigation={{ navigate: jest.fn() }} route={{ params: {} }} />
        </SafeAreaProvider>,
    );

beforeEach(() => {
    jest.clearAllMocks();
    (farmsApi.getAll as jest.Mock).mockResolvedValue({ data: FARMS });
    (reportsApi.getFinancialReport as jest.Mock).mockImplementation((id: string) =>
        Promise.resolve({ data: REPORTS[id] }),
    );
    (transactionsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (creditApi.list as jest.Mock).mockResolvedValue({ data: [] });
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
        (reportsApi.getFinancialReport as jest.Mock).mockImplementation((id: string) =>
            id === 'f2' ? Promise.reject(new Error('403')) : Promise.resolve({ data: REPORTS.f1 }),
        );
        const { getByText, queryByText } = renderScreen();

        await waitFor(() => expect(getByText('+₹2.0 L')).toBeTruthy());
        expect(queryByText('South Farm')).toBeNull();
        // One readable farm needs no chips and no breakdown.
        expect(queryByText('By farm')).toBeNull();
    });

    it('shows the empty state when no farm has readable financials', async () => {
        (farmsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
        const { getByText } = renderScreen();
        await waitFor(() => expect(getByText('No farms yet')).toBeTruthy());
    });
});

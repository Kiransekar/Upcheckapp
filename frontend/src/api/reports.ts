import apiClient from './client';
import { moneyQueryParams, type MoneyFilterParams } from './transactions';

export interface DashboardSummary {
    activePondsCount: number;
    totalPondsCount: number;
    lowStockAlerts: number;
    todayFeedUsage: number;
}

export interface FinancialReport {
    revenue: number;
    totalExpenses: number;
    profit: number;
    expensesByCategory: Array<{ category: string; amount: number }>;
    /**
     * The slice of `totalExpenses` that came from inventory purchases. Shown
     * next to the "count inventory purchases" toggle so the farmer can see what
     * the toggle is worth before flipping it.
     *
     * Necessarily 0 when `includeInventoryPurchases=false` — those rows are
     * then not in `totalExpenses` either. Absent on older backends.
     */
    inventoryExpenses?: number;
    /**
     * Per-pond split, each row tagged with whether the pond is ARCHIVED.
     *
     * This is the ONLY honest source of "how much of this came from a retired
     * pond": a transaction hangs off a farm and has no pond at all, so the
     * entry list below cannot answer the question for its own rows.
     */
    ponds?: Array<{
        pondId: string;
        name: string | null;
        archived: boolean;
        revenue: number;
        expenses: number;
    }>;
    /** Whether the figures above actually include archived ponds. */
    includedArchivedPonds?: boolean;
}

export interface CycleAnalysis {
    cycleId: string;
    fcr: number;
    totalFeedKg: number;
    totalHarvestKg: number;
    survivalRate: number;
    growthChart: Array<{ date: string; mbw: number }>;
}

export const reportsApi = {
    getDashboardSummary: (farmId?: string) =>
        apiClient.get<DashboardSummary>('/reports/dashboard', { params: farmId ? { farmId } : {} }),

    getFinancialReport: (farmId: string, filters?: MoneyFilterParams) =>
        apiClient.get<FinancialReport>('/reports/financials', {
            params: { farmId, ...moneyQueryParams(filters) },
        }),

    getCycleAnalysis: (cycleId: string) =>
        apiClient.get<CycleAnalysis>(`/reports/cycle/${cycleId}/analysis`),
};
import apiClient from './client';
import { moneyQueryParams } from './transactions';

export enum ExpenseCategory {
    FEED = 'Feed',
    PROBIOTICS = 'Chemicals/Probiotics',
    SEED = 'Seed (Fry)',
    LABOR = 'Labor',
    ENERGY = 'Energy (Fuel/Electricity)',
    MAINTENANCE = 'Maintenance',
    OTHER = 'Other',
}

export interface Expense {
    id: string;
    cropId?: string | null;
    pondId: string;
    userId: string;
    date: string;
    category: ExpenseCategory;
    amount: number;
    description?: string | null;
    createdAt: string;
    updatedAt: string;
    /** The pond this expense belongs to has been archived. Marked, not hidden. */
    archived?: boolean;
    /** Came from an inventory purchase rather than a typed expense. */
    inventoryPurchase?: boolean;
    /**
     * Which money table this row actually came from.
     *
     * Absent for a real `expenses` row. `'transaction'` means it was typed on
     * the farm Money screen and tagged to this pond — the backend projects it
     * into the cycle list at read time so the pond's Expenses tab and its
     * totals stop disagreeing with what the farmer entered.
     *
     * Such a row is READ-ONLY here: its `id` is prefixed `transaction:` and no
     * `/expenses` endpoint owns it, so it must never be offered for edit or
     * delete on this tab.
     */
    source?: 'transaction';
}

/**
 * `GET /expenses` — pond- and cycle-scoped costs, filtered on the SERVER.
 *
 * The Money tab used to fetch everything and narrow it on the phone, which
 * cannot answer "what did this pond cost me last week" at all: cycle costs are
 * not in the transaction list. Every filter here is a query param.
 */
export interface ExpenseQuery {
    farmId?: string;
    pondId?: string;
    cropId?: string;
    /** Inclusive `YYYY-MM-DD`. */
    startDate?: string | null;
    endDate?: string | null;
    category?: ExpenseCategory | string;
    includeArchivedPonds?: boolean;
    includeInventoryPurchases?: boolean;
}

export interface CreateExpenseDto {
    cropId?: string | null;
    pondId: string;
    date: string;
    category: ExpenseCategory;
    amount: number;
    description?: string;
}

export interface CycleFinancials {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    marginPercent: number;
    /** Total harvested biomass (kg) across the cycle's harvests. */
    totalHarvestKg?: number;
    /** Sale price per kg at which the cycle breaks even; null until harvested. */
    breakEvenPricePerKg?: number | null;
    // Backend returns a category->amount map, not an array.
    expensesByCategory: Record<string, number>;
}

export const expensesApi = {
    /** Server-side filtered list. The cycle endpoint below still works. */
    list: (query: ExpenseQuery) => {
        const params: Record<string, string> = { ...moneyQueryParams(query) };
        if (query.farmId) params.farmId = query.farmId;
        if (query.pondId) params.pondId = query.pondId;
        if (query.cropId) params.cropId = query.cropId;
        if (query.category) params.category = query.category;
        return apiClient.get<Expense[]>('/expenses', { params });
    },

    findByCycle: (cropId: string) =>
        apiClient.get<Expense[]>(`/expenses/cycle/${cropId}`),

    create: (data: CreateExpenseDto) =>
        apiClient.post<Expense>('/expenses', data),

    getCycleFinancials: (cropId: string) =>
        apiClient.get<CycleFinancials>(`/expenses/cycle/${cropId}/financials`),
};

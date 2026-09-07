import apiClient from './client';

export interface Transaction {
    id: string;
    farmId: string;
    transactionDate: string;
    type: 'income' | 'expense';
    category: string;
    amount: number;
    description?: string;
    paymentMethod?: string;
    referenceNumber?: string;
    createdAt: string;
    /**
     * The pond this money is attributed to is archived. Real now — the read
     * joins the pond — but only meaningful when the row names one: a
     * farm-level transaction belongs to no pond and always reports `false`.
     *
     * So a `false` still does not mean "no archived money on this farm". The
     * financial report's `ponds[]` is the only thing that answers that.
     */
    archived?: boolean;
    /** The pond's display name, when the row names a pond. */
    pondName?: string | null;
    /** The row came from an inventory purchase rather than a typed entry. */
    inventoryPurchase?: boolean;
    /**
     * The pond this money belongs to, if the farmer named one. Null means the
     * cost is the whole farm's — a licence, a shared generator — which is what
     * every row written before the field existed is.
     */
    pondId?: string | null;
}

export interface CreateTransactionDto {
    farmId: string;
    transactionDate: string;
    type: 'income' | 'expense';
    category: string;
    amount: number;
    description?: string;
    paymentMethod?: string;
    referenceNumber?: string;
    /** Optional: the pond this money belongs to. Omitted means "whole farm". */
    pondId?: string;
}

export interface UpdateTransactionDto {
    transactionDate?: string;
    type?: 'income' | 'expense';
    category?: string;
    amount?: number;
    description?: string;
    paymentMethod?: string;
    referenceNumber?: string;
    pondId?: string | null;
}

export interface TransactionSummary {
    totalIncome: number;
    totalExpense: number;
    netProfit: number;
    /**
     * The slice of `totalExpense` that came from inventory purchases — what the
     * "count inventory purchases" toggle is worth, in rupees. 0 when the toggle
     * is off, because those rows are then out of `totalExpense` too.
     */
    inventoryExpense?: number;
}

/**
 * The Money-tab filters, as the API takes them.
 *
 * Dates are inclusive `YYYY-MM-DD`. Both `include*` flags default to TRUE on
 * the server, so only `false` is ever worth sending — see `moneyQueryParams`.
 */
export interface MoneyFilterParams {
    startDate?: string | null;
    endDate?: string | null;
    includeArchivedPonds?: boolean;
    includeInventoryPurchases?: boolean;
}

/** Drop the nulls and the server's own defaults; axios omits `undefined`. */
export const moneyQueryParams = (f: MoneyFilterParams = {}): Record<string, string> => {
    const p: Record<string, string> = {};
    if (f.startDate) p.startDate = f.startDate;
    if (f.endDate) p.endDate = f.endDate;
    if (f.includeArchivedPonds === false) p.includeArchivedPonds = 'false';
    if (f.includeInventoryPurchases === false) p.includeInventoryPurchases = 'false';
    return p;
};

export const transactionsApi = {
    getAll: (farmId?: string, type?: 'income' | 'expense', filters?: MoneyFilterParams) => {
        const params: Record<string, string> = moneyQueryParams(filters);
        if (farmId) params.farmId = farmId;
        if (type) params.type = type;
        return apiClient.get<Transaction[]>('/transactions', { params });
    },

    getSummary: (farmId: string, filters?: MoneyFilterParams) =>
        apiClient.get<TransactionSummary>(`/transactions/farm/${farmId}/summary`, {
            params: moneyQueryParams(filters),
        }),

    getById: (id: string) =>
        apiClient.get<Transaction>(`/transactions/${id}`),

    create: (data: CreateTransactionDto) =>
        apiClient.post<Transaction>('/transactions', data),

    update: (id: string, data: UpdateTransactionDto) =>
        apiClient.patch<Transaction>(`/transactions/${id}`, data),

    remove: (id: string) =>
        apiClient.delete<void>(`/transactions/${id}`),
};

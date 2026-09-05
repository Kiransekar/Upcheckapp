import apiClient from './client';

/**
 * Mirror of backend/src/inventory/inventory.constants.ts. FIVE categories —
 * `medicine` included (D12) — and the unit list the dropdown offers. The server
 * `@IsIn`s both, so anything not here is a 400.
 */
export const INVENTORY_CATEGORIES = ['feed', 'chemical', 'equipment', 'medicine', 'other'] as const;
export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

export const INVENTORY_UNITS = ['kg', 'g', 'L', 'mL', 'bag', 'pcs', 'bottle', 'box'] as const;
export type InventoryUnit = (typeof INVENTORY_UNITS)[number];

/**
 * THE category→icon map (D5). There used to be two that disagreed — the filter
 * tabs called `equipment` a wrench, the rows called it a box — so an item
 * changed shape between the list and the row inside it.
 */
export const CATEGORY_ICON: Record<string, string> = {
    feed: 'corn',
    chemical: 'flask',
    equipment: 'tools',
    medicine: 'pill',
    other: 'package-variant',
};

/** i18n key per category — shared by the tabs, the rows and the detail screen. */
export const CATEGORY_LABEL_KEY: Record<string, string> = {
    feed: 'inventory.catFeed',
    chemical: 'inventory.catChemicals',
    equipment: 'inventory.catEquipment',
    medicine: 'inventory.catMedicine',
    other: 'inventory.catOther',
};

/** The item's own picked glyph, else its category's, else a plain box. */
export const itemIcon = (item: { icon?: string | null; category?: string }): string =>
    item.icon || CATEGORY_ICON[item.category ?? ''] || 'package-variant';

/**
 * THE low-stock rule (D1), identical to `isLowStock` in the backend constants:
 * an item with no threshold is low only once it hits zero. The frontend used to
 * read a NULL threshold as 0 *and* compare with `<=`, which flagged every
 * un-thresholded item the moment it was created.
 *
 * `numeric` columns arrive from pg as strings, hence the Number() coercions.
 */
export const isLowStock = (item: { quantity: number | string; reorderLevel?: number | string | null }): boolean =>
    Number(item.quantity ?? 0) <= Number(item.reorderLevel ?? 0);

/**
 * Fill fraction (0..1) for the detail screen's stock bar (D6). The old
 * expression was `quantity / (reorderLevel * 2)`, which is NaN with no
 * threshold and Infinity with a threshold of 0 — either way React Native got
 * `width: "NaN%"` and drew nothing.
 *
 * With no usable threshold there is no scale to draw against, so a stocked item
 * simply reads full.
 */
export const stockFraction = (
    quantity: number | string,
    reorderLevel?: number | string | null,
): number => {
    const q = Number(quantity);
    if (!Number.isFinite(q) || q <= 0) return 0;
    const threshold = Number(reorderLevel ?? 0);
    const full = Number.isFinite(threshold) && threshold > 0 ? threshold * 2 : q;
    return Math.min(1, q / full);
};

/** Stepper increment for a unit: whole things step by 1, kg/L by a half, g/mL by ten. */
export const unitStep = (unit?: string | null): number => {
    if (unit === 'g' || unit === 'mL') return 10;
    if (unit === 'kg' || unit === 'L') return 0.5;
    return 1;
};

export interface InventoryItem {
    id: string;
    /** The single-farm fast path; null when the item is paired to several farms or none. */
    farmId: string | null;
    /** Every farm the item is paired to. Only populated on `getById` (D-Task8). Empty = unpaired. */
    farmIds?: string[];
    name: string;
    category: string;
    /** MCI glyph name chosen in the icon picker; null = derive from category. */
    icon?: string | null;
    unit?: string;
    quantity: number;
    reorderLevel?: number;
    unitPrice?: number;
    supplier?: string;
    expiryDate?: string;
    notes?: string;
    /** Reason given for the most recent adjustment (there is no movement table). */
    lastAdjustmentReason?: string | null;
    createdAt: string;
    updatedAt: string;
}

/**
 * One row of the append-only `inventory_movements` ledger (Task 7). Negative
 * `delta` is a deduction (e.g. a feed log), positive a credit (a purchase or
 * a compensating credit). `reason`/`createdById`/`feedRecordId` are all
 * nullable — an old feed-log movement has no reason, a deleted user's
 * movements still exist, a manual adjustment has no feed record.
 */
export interface InventoryMovement {
    id: string;
    inventoryId: string;
    delta: number;
    reason: string | null;
    createdById: string | null;
    feedRecordId: string | null;
    createdAt: string;
    /**
     * The pond a consumption went to, joined server-side through
     * `feedRecordId`. Null on a purchase, a manual correction, or once the
     * feed record itself is gone — the movement outlives it.
     */
    pondId?: string | null;
    pondName?: string | null;
}

/**
 * The money row a purchase wrote — the other end of the inventory↔money link.
 * Only returned for farms the caller may VIEW_FINANCIALS on, so an empty list
 * means either "no purchases" or "not your business"; the UI treats both the
 * same and hides the section.
 */
export interface InventoryPurchase {
    id: string;
    farmId: string;
    transactionDate: string;
    amount: number;
    category: string;
    description?: string | null;
}

export interface CreateInventoryItemDto {
    /** Kept for backward compatibility; the multi-farm client sends `farmIds` instead. */
    farmId?: string;
    /** The farms to pair this item to. Empty/absent means deliberately unpaired. */
    farmIds?: string[];
    name: string;
    category: string;
    icon?: string;
    unit?: string;
    quantity?: number;
    reorderLevel?: number;
    unitPrice?: number;
    supplier?: string;
    expiryDate?: string;
    notes?: string;
}

/** `farmId` is deliberately absent — an item cannot change farms (D14). */
export interface UpdateInventoryItemDto {
    name?: string;
    category?: string;
    icon?: string;
    unit?: string;
    quantity?: number;
    reorderLevel?: number;
    unitPrice?: number;
    supplier?: string;
    expiryDate?: string;
    notes?: string;
}

export const inventoryApi = {
    /**
     * Omit `farmId` to get every farm the caller may VIEW_INVENTORY on (D7) —
     * members used to get `[]` because the server scoped to owned farms.
     */
    getAll: (farmId?: string, category?: string) =>
        apiClient.get<InventoryItem[]>('/inventory', {
            params: { ...(farmId ? { farmId } : {}), ...(category ? { category } : {}) },
        }),

    getById: (id: string) =>
        apiClient.get<InventoryItem>(`/inventory/${id}`),

    create: (data: CreateInventoryItemDto) =>
        apiClient.post<InventoryItem>('/inventory', data),

    update: (id: string, data: UpdateInventoryItemDto) =>
        apiClient.patch<InventoryItem>(`/inventory/${id}`, data),

    /** Replaces the item's farm pairing. Empty array is legal — it unpairs the item. */
    setPairing: (id: string, farmIds: string[]) =>
        apiClient.patch(`/inventory/${id}/farms`, { farmIds }),

    delete: (id: string) =>
        apiClient.delete(`/inventory/${id}`),

    /**
     * `amount` present ⇒ this addition is a PURCHASE and the server writes one
     * linked expense (D2). It is only legal on a positive adjustment, and
     * `billToFarmId` is required once the item is stocked for more than one
     * farm — the server refuses to guess which farm's money was spent.
     *
     * `idempotencyKey` is minted once per attempt by the caller and reused on
     * every retry, so a flaky connection cannot buy the same feed twice (F1).
     */
    adjustStock: (
        id: string,
        adjustment: number,
        reason?: string,
        opts?: { amount?: number; billToFarmId?: string; idempotencyKey?: string },
    ) =>
        apiClient.patch(`/inventory/${id}/adjust`, { adjustment, reason, ...opts }),

    getLowStock: (farmId: string) =>
        apiClient.get<InventoryItem[]>(`/inventory/low-stock/${farmId}`),

    /** Newest-first, capped at 100 rows server-side (Task 7). */
    listMovements: (id: string) =>
        apiClient.get<InventoryMovement[]>(`/inventory/${id}/movements`),

    /** The expenses this item's purchases wrote. Empty unless the caller may see financials. */
    listPurchases: (id: string) =>
        apiClient.get<InventoryPurchase[]>(`/inventory/${id}/purchases`),
};

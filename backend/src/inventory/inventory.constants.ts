/**
 * The inventory vocabulary, in one place, because it was previously in three
 * that disagreed (D9, D12): the entity comment advertised `medicine`, the DTO
 * validated nothing at all, and the list screen offered `other` instead.
 *
 * One truth, chosen here: FIVE categories. `medicine` stays because rows in
 * production already carry it and an @IsIn without it would make those rows
 * unpatchable; `other` stays because the UI offers it. The frontend must render
 * all five chips — on create AND on edit (D4) — from this same list.
 */
export const INVENTORY_CATEGORIES = [
  'feed',
  'chemical',
  'equipment',
  'medicine',
  'other',
] as const;

/** Units the unit dropdown offers (spec §4.7). */
export const INVENTORY_UNITS = [
  'kg',
  'g',
  'L',
  'mL',
  'bag',
  'pcs',
  'bottle',
  'box',
] as const;

/**
 * THE low-stock definition (D1). Backend used `quantity <= reorder_level`,
 * which SQL-excludes a NULL threshold; the frontend read NULL as 0. Both are
 * now this: an item with no threshold is low only once it hits zero.
 *
 * `LOW_STOCK_SQL` is the query-builder form; `isLowStock` is the in-memory form
 * used for the alert. They must stay the same rule.
 */
export const LOW_STOCK_SQL = 'item.quantity <= COALESCE(item.reorderLevel, 0)';

export const isLowStock = (item: {
  quantity: number | string;
  reorderLevel?: number | string | null;
}): boolean => Number(item.quantity) <= Number(item.reorderLevel ?? 0);

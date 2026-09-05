/**
 * The farmer's Money-tab choices — persisted locally.
 *
 * Three things survive a restart: which period the tab opens on, whether
 * archived ponds count, and whether inventory purchases count as expenses.
 * Re-picking "this week" and re-ticking two toggles on every visit is the kind
 * of small tax that makes a screen feel broken.
 *
 * Stored as plain JSON under one AsyncStorage key, exactly like
 * `reminderTimes.ts`. A farmer who has never chosen gets the defaults, and so
 * does a farmer whose stored value is corrupt or partial — showing everything
 * is never wrong, it is only broader than they asked for.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { toLocalISODate } from '../utils/localDate';

const KEY = 'upcheck-money-prefs';

export type MoneyPeriod = 'all' | 'today' | 'week' | 'month' | 'custom';

export const MONEY_PERIODS: MoneyPeriod[] = ['all', 'today', 'week', 'month', 'custom'];

export interface MoneyPrefs {
    period: MoneyPeriod;
    /** Only meaningful when `period` is 'custom'. `YYYY-MM-DD`. */
    customStart: string | null;
    customEnd: string | null;
    /** D3: archived ponds are IN by default — their money was still real money. */
    includeArchivedPonds: boolean;
    /** D2: a stock purchase is an expense unless the farmer says otherwise. */
    includeInventoryPurchases: boolean;
}

export const DEFAULT_MONEY_PREFS: MoneyPrefs = {
    period: 'all',
    customStart: null,
    customEnd: null,
    includeArchivedPonds: true,
    includeInventoryPurchases: true,
};

const isISODate = (v: any): v is string | null =>
    v === null || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v));

const isMoneyPrefs = (v: any): v is MoneyPrefs =>
    !!v &&
    MONEY_PERIODS.includes(v.period) &&
    isISODate(v.customStart) &&
    isISODate(v.customEnd) &&
    // `startDate > endDate` is a 400 from the server. The pickers cannot make
    // that pair, but a value that predates them (or was hand-edited) could —
    // and it would 400 on every load with no way for the farmer to see why.
    !(v.customStart && v.customEnd && v.customStart > v.customEnd) &&
    typeof v.includeArchivedPonds === 'boolean' &&
    typeof v.includeInventoryPurchases === 'boolean';

export async function loadMoneyPrefs(): Promise<MoneyPrefs> {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        if (!raw) return DEFAULT_MONEY_PREFS;
        const parsed = JSON.parse(raw);
        return isMoneyPrefs(parsed) ? parsed : DEFAULT_MONEY_PREFS;
    } catch {
        return DEFAULT_MONEY_PREFS;
    }
}

export async function saveMoneyPrefs(prefs: MoneyPrefs): Promise<void> {
    await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
}

export interface DateRange {
    /** Inclusive `YYYY-MM-DD`, or null for "no lower bound". */
    startDate: string | null;
    /** Inclusive `YYYY-MM-DD`, or null for "no upper bound". */
    endDate: string | null;
}

/**
 * A period → inclusive `YYYY-MM-DD` bounds, in the DEVICE's timezone.
 *
 * The farmer's day, not UTC: `toISOString()` on an IST phone between midnight
 * and 05:30 names yesterday, which would make "today" show the previous day's
 * spending. Every bound here comes from the local getters in `localDate.ts`.
 *
 * The week starts on SUNDAY, matching the month grid in `CalendarPicker`,
 * which is the only week-start convention this app has.
 *
 * "This week" and "this month" run from the start of the period to TODAY, not
 * to a future Saturday or month-end — the hero above them reads "Net so far".
 */
export function moneyPeriodRange(prefs: MoneyPrefs, now: Date = new Date()): DateRange {
    const today = toLocalISODate(now);
    switch (prefs.period) {
        case 'today':
            return { startDate: today, endDate: today };
        case 'week': {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
            return { startDate: toLocalISODate(start), endDate: today };
        }
        case 'month': {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            return { startDate: toLocalISODate(start), endDate: today };
        }
        case 'custom':
            return { startDate: prefs.customStart, endDate: prefs.customEnd };
        default:
            return { startDate: null, endDate: null };
    }
}

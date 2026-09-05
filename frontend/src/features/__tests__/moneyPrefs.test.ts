// The Money tab's persisted choices, and the period → date-range arithmetic
// the whole filter rests on. Both are money paths: a wrong bound is a wrong
// number in a farmer's books, not a cosmetic glitch.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    DEFAULT_MONEY_PREFS,
    loadMoneyPrefs,
    moneyPeriodRange,
    saveMoneyPrefs,
    type MoneyPrefs,
} from '../moneyPrefs';

const KEY = 'upcheck-money-prefs';

const prefsWith = (patch: Partial<MoneyPrefs>): MoneyPrefs => ({
    ...DEFAULT_MONEY_PREFS,
    ...patch,
});

beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
});

describe('moneyPrefs storage', () => {
    it('round-trips a full set of choices', async () => {
        const prefs = prefsWith({
            period: 'custom',
            customStart: '2026-01-01',
            customEnd: '2026-01-31',
            includeArchivedPonds: false,
            includeInventoryPurchases: false,
        });
        await saveMoneyPrefs(prefs);
        expect(await loadMoneyPrefs()).toEqual(prefs);
    });

    // Nothing stored is the normal first run, not an error.
    it('returns the defaults when nothing has been stored', async () => {
        expect(await loadMoneyPrefs()).toEqual(DEFAULT_MONEY_PREFS);
    });

    it('defaults to counting archived ponds and inventory purchases', () => {
        expect(DEFAULT_MONEY_PREFS.includeArchivedPonds).toBe(true);
        expect(DEFAULT_MONEY_PREFS.includeInventoryPurchases).toBe(true);
    });

    it('returns the defaults on unparseable JSON', async () => {
        await AsyncStorage.setItem(KEY, '{not json');
        expect(await loadMoneyPrefs()).toEqual(DEFAULT_MONEY_PREFS);
    });

    // A half-written or older shape must not leave `includeArchivedPonds`
    // undefined — that would read as "exclude" at the first `!prefs.x`.
    it('returns the defaults on a partial or wrong-shaped value', async () => {
        await AsyncStorage.setItem(KEY, JSON.stringify({ period: 'week' }));
        expect(await loadMoneyPrefs()).toEqual(DEFAULT_MONEY_PREFS);

        await AsyncStorage.setItem(
            KEY,
            JSON.stringify(prefsWith({ period: 'fortnight' as any })),
        );
        expect(await loadMoneyPrefs()).toEqual(DEFAULT_MONEY_PREFS);

        await AsyncStorage.setItem(KEY, JSON.stringify(prefsWith({ customStart: '01/02/2026' as any })));
        expect(await loadMoneyPrefs()).toEqual(DEFAULT_MONEY_PREFS);
    });

    it('returns the defaults when storage itself throws', async () => {
        jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'));
        expect(await loadMoneyPrefs()).toEqual(DEFAULT_MONEY_PREFS);
    });
});

describe('moneyPeriodRange', () => {
    // Local constructor, not `new Date('...Z')` — every bound is meant to be
    // the farmer's calendar day in the device's own timezone.
    const at = (y: number, m: number, d: number, h = 12, min = 0) =>
        new Date(y, m - 1, d, h, min);

    it('gives no bounds for "all time"', () => {
        expect(moneyPeriodRange(prefsWith({ period: 'all' }), at(2026, 3, 18))).toEqual({
            startDate: null,
            endDate: null,
        });
    });

    it('bounds "today" to the single local day, inclusive', () => {
        expect(moneyPeriodRange(prefsWith({ period: 'today' }), at(2026, 3, 18))).toEqual({
            startDate: '2026-03-18',
            endDate: '2026-03-18',
        });
    });

    // 00:05 IST is still today. Using UTC here would name 17 March and show
    // the previous day's spending under the heading "Today".
    it('is still today just after local midnight', () => {
        expect(moneyPeriodRange(prefsWith({ period: 'today' }), at(2026, 3, 18, 0, 5))).toEqual({
            startDate: '2026-03-18',
            endDate: '2026-03-18',
        });
    });

    it('is still today just before local midnight', () => {
        expect(moneyPeriodRange(prefsWith({ period: 'today' }), at(2026, 3, 18, 23, 59))).toEqual({
            startDate: '2026-03-18',
            endDate: '2026-03-18',
        });
    });

    // Sunday-start, matching the CalendarPicker grid. 18 Mar 2026 is a
    // Wednesday, so the week began on Sunday the 15th.
    it('starts the week on Sunday and ends it today', () => {
        expect(moneyPeriodRange(prefsWith({ period: 'week' }), at(2026, 3, 18))).toEqual({
            startDate: '2026-03-15',
            endDate: '2026-03-18',
        });
    });

    it('keeps Sunday itself a one-day week so far', () => {
        // 15 Mar 2026 is a Sunday.
        expect(moneyPeriodRange(prefsWith({ period: 'week' }), at(2026, 3, 15))).toEqual({
            startDate: '2026-03-15',
            endDate: '2026-03-15',
        });
    });

    // The bug this catches: a week reaching back into the previous month, or
    // the previous year. 1 Apr 2026 is a Wednesday → the week began 29 March.
    it('reaches back across a month boundary', () => {
        expect(moneyPeriodRange(prefsWith({ period: 'week' }), at(2026, 4, 1))).toEqual({
            startDate: '2026-03-29',
            endDate: '2026-04-01',
        });
    });

    it('reaches back across a year boundary', () => {
        // 1 Jan 2027 is a Friday → the week began Sunday 27 Dec 2026.
        expect(moneyPeriodRange(prefsWith({ period: 'week' }), at(2027, 1, 1))).toEqual({
            startDate: '2026-12-27',
            endDate: '2027-01-01',
        });
    });

    it('starts the month on the 1st and ends it today', () => {
        expect(moneyPeriodRange(prefsWith({ period: 'month' }), at(2026, 3, 18))).toEqual({
            startDate: '2026-03-01',
            endDate: '2026-03-18',
        });
    });

    it('is a single day on the first of the month', () => {
        expect(moneyPeriodRange(prefsWith({ period: 'month' }), at(2026, 4, 1))).toEqual({
            startDate: '2026-04-01',
            endDate: '2026-04-01',
        });
    });

    it('handles a leap-year February end to end', () => {
        expect(moneyPeriodRange(prefsWith({ period: 'month' }), at(2028, 2, 29))).toEqual({
            startDate: '2028-02-01',
            endDate: '2028-02-29',
        });
    });

    it('passes the custom range through as chosen', () => {
        const prefs = prefsWith({
            period: 'custom',
            customStart: '2025-12-01',
            customEnd: '2026-01-15',
        });
        expect(moneyPeriodRange(prefs, at(2026, 3, 18))).toEqual({
            startDate: '2025-12-01',
            endDate: '2026-01-15',
        });
    });

    // A custom period with only one end chosen is an open-ended range, not an
    // error — the missing side simply has no bound.
    it('leaves an unset custom end open', () => {
        const prefs = prefsWith({ period: 'custom', customStart: '2026-01-01' });
        expect(moneyPeriodRange(prefs, at(2026, 3, 18))).toEqual({
            startDate: '2026-01-01',
            endDate: null,
        });
    });
});

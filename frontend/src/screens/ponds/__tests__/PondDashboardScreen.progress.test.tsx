/**
 * The three complaints this covers, at the level each of them actually lives:
 *
 *  1. The tick on a log tile must be `features/logProgress`' answer and nobody
 *     else's — including at the slot boundary, which is where a second
 *     definition of "done" would first disagree.
 *  2. "Today" is the calendar day the farmer is standing in, not "recent".
 *  3. A pond with no active cycle still reaches its history. That was the dead
 *     end: after a full harvest closed the cycle, the record of what just
 *     happened had no route to it.
 */
jest.mock('../../../api/ponds', () => ({ pondsApi: { getById: jest.fn() } }));
jest.mock('../../../api/pondContext', () => ({ pondContextApi: { get: jest.fn(), forFarm: jest.fn() } }));
jest.mock('../../../api/crops', () => ({ cropsApi: { getById: jest.fn() } }));
jest.mock('../../../api/alertCenter', () => ({ alertCenterApi: { briefing: jest.fn(), liveBriefing: jest.fn() } }));
jest.mock('../../../api/pnl', () => ({ pnlApi: { cropPnl: jest.fn() } }));
jest.mock('../../../api/waterQuality', () => ({ waterQualityApi: { getAll: jest.fn() } }));
jest.mock('../../../api/feedRecords', () => ({ feedApi: { getAll: jest.fn() } }));
// Spied, not replaced: the tests below assert the screen ASKS this module
// rather than keeping its own copy of the rule.
jest.mock('../../../features/cycleRequirement', () => ({
    requiresActiveCycle: jest.fn(
        jest.requireActual('../../../features/cycleRequirement').requiresActiveCycle,
    ),
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
import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PondDashboardScreen, tileDone, todayEntries } from '../PondDashboardScreen';
import { pondsApi } from '../../../api/ponds';
import { pondContextApi } from '../../../api/pondContext';
import { cropsApi } from '../../../api/crops';
import { alertCenterApi } from '../../../api/alertCenter';
import { pnlApi } from '../../../api/pnl';
import { waterQualityApi } from '../../../api/waterQuality';
import { feedApi } from '../../../api/feedRecords';
import { useSyncStore } from '../../../store/syncStore';
import { useMembershipStore } from '../../../store/membershipStore';
import { pondSlotDone, pondFedThisSession, chemistryDone, slotAt } from '../../../features/logProgress';
import { requiresActiveCycle } from '../../../features/cycleRequirement';

const realRequiresActiveCycle = jest.requireActual(
    '../../../features/cycleRequirement',
).requiresActiveCycle;

/** A local wall-clock ISO, so the slot windows mean what they say on the device. */
const at = (day: number, hour: number, minute = 0): string =>
    new Date(2026, 8, day, hour, minute, 0, 0).toISOString();

const ctxWith = (over: any = {}): any => ({
    pondId: 'p9',
    farmId: 'f1',
    waterQuality: null,
    lastFeedAt: null,
    ...over,
});

describe('tileDone answers with logProgress, never its own rule', () => {
    const now = new Date(2026, 8, 3, 11, 0);

    it('water follows pondSlotDone for the current slot', () => {
        const ctx = ctxWith({ waterQuality: { recordedAt: at(3, 6) } });
        expect(tileDone(ctx, 'actionWaterQuality', now)).toBe(true);
        expect(tileDone(ctx, 'actionWaterQuality', now)).toBe(pondSlotDone(ctx, slotAt(now), now));
    });

    it('does not carry a morning reading into the afternoon slot', () => {
        // 11:00 is morning, 12:00 is the first minute of afternoon. A reading
        // taken at 11:59 satisfies the morning slot and nothing after it.
        const ctx = ctxWith({ waterQuality: { recordedAt: at(3, 11, 59) } });
        expect(tileDone(ctx, 'actionWaterQuality', new Date(2026, 8, 3, 11, 59))).toBe(true);
        expect(tileDone(ctx, 'actionWaterQuality', new Date(2026, 8, 3, 12, 0))).toBe(false);
    });

    it('counts a reading taken exactly on the slot boundary as that slot', () => {
        const ctx = ctxWith({ waterQuality: { recordedAt: at(3, 12, 0) } });
        const afternoon = new Date(2026, 8, 3, 13, 0);
        expect(tileDone(ctx, 'actionWaterQuality', afternoon)).toBe(true);
        expect(tileDone(ctx, 'actionWaterQuality', new Date(2026, 8, 3, 11, 0))).toBe(false);
    });

    it('does not count yesterday', () => {
        const ctx = ctxWith({ waterQuality: { recordedAt: at(2, 6) } });
        expect(tileDone(ctx, 'actionWaterQuality', now)).toBe(false);
    });

    it('feed follows pondFedThisSession', () => {
        const ctx = ctxWith({ lastFeedAt: at(3, 7) });
        expect(tileDone(ctx, 'actionFeed', now)).toBe(true);
        expect(tileDone(ctx, 'actionFeed', now)).toBe(pondFedThisSession(ctx, slotAt(now), now));
        expect(tileDone(ctxWith({ lastFeedAt: at(3, 18) }), 'actionFeed', now)).toBe(false);
    });

    it('weekly chemistry follows chemistryDone — a week, not a slot', () => {
        const six = ctxWith({ waterQuality: { chemistryAsOf: at(-3, 9) } }); // 6 days back
        const eight = ctxWith({ waterQuality: { chemistryAsOf: at(-5, 9) } }); // 8 days back
        expect(tileDone(six, 'actionWeeklyChem', now)).toBe(true);
        expect(tileDone(six, 'actionWeeklyChem', now)).toBe(chemistryDone(six, now));
        expect(tileDone(eight, 'actionWeeklyChem', now)).toBe(false);
    });

    it('gives no answer where "done" has no meaning, rather than a false empty tick', () => {
        const ctx = ctxWith({ waterQuality: { recordedAt: at(3, 6) } });
        for (const key of ['actionMortality', 'actionSampling', 'actionHarvest', 'actionAdvisor']) {
            expect(tileDone(ctx, key, now)).toBeUndefined();
        }
    });

    it('gives no answer with no context at all', () => {
        expect(tileDone(null, 'actionWaterQuality', now)).toBeUndefined();
        expect(tileDone(undefined, 'actionFeed', now)).toBeUndefined();
    });
});

describe("today's entries are today's, newest first", () => {
    const now = new Date(2026, 8, 3, 16, 0);

    const water = [
        { id: 'w1', pondId: 'p9', recordedAt: at(3, 6), dissolvedOxygen: 5.2, ph: 7.8 },
        { id: 'w2', pondId: 'p9', recordedAt: at(2, 6), dissolvedOxygen: 4.1 }, // yesterday
        { id: 'w3', pondId: 'p9', recordedAt: at(3, 14), temperature: 29 },
    ] as any;
    const feed = [
        { id: 'f1', pondId: 'p9', feedType: 'starter', quantityKg: '12.5', recordedAt: at(3, 9) },
        { id: 'f2', pondId: 'p9', feedType: 'starter', quantityKg: 8, recordedAt: at(1, 9) }, // two days back
        { id: 'f3', pondId: 'p9', feedType: 'starter', quantityKg: 10, recordedAt: null },
    ] as any;

    it('keeps only the current calendar day and orders newest first', () => {
        const out = todayEntries(water, feed, now);
        expect(out.map((e) => e.id)).toEqual(['wq-w3', 'fd-f1', 'wq-w1']);
    });

    it('says what was recorded, not just that something was', () => {
        const out = todayEntries(water, feed, now);
        expect(out.find((e) => e.id === 'wq-w1')!.value).toBe('DO 5.2 · pH 7.8');
        // Postgres numerics arrive as strings — a "12.5 kg" that reads "NaN kg"
        // is the whole reason this is coerced.
        expect(out.find((e) => e.id === 'fd-f1')!.value).toBe('12.5 kg');
    });

    it('is empty rather than wrong when nothing was logged today', () => {
        expect(todayEntries(water, feed, new Date(2026, 8, 5, 10, 0))).toEqual([]);
    });
});

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe('a pond with no active cycle can still reach its history', () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };

    beforeEach(() => {
        jest.clearAllMocks();
        (requiresActiveCycle as jest.Mock).mockImplementation(realRequiresActiveCycle);
        useSyncStore.getState().clearQueue();
        useSyncStore.getState().setConnected(true);
        useMembershipStore.setState({ memberships: [], loaded: true, loading: false } as any);
        (pondsApi.getById as jest.Mock).mockResolvedValue({
            data: { id: 'p9', farmId: 'f1', name: 'Pond 9', status: 'fallow', activeCycleId: null },
        });
        (pondContextApi.get as jest.Mock).mockResolvedValue({ data: null });
        (cropsApi.getById as jest.Mock).mockResolvedValue({ data: null });
        (alertCenterApi.briefing as jest.Mock).mockResolvedValue({ data: [] });
        (pnlApi.cropPnl as jest.Mock).mockResolvedValue({ data: null });
        (waterQualityApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
        (feedApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    });

    const renderIdle = () =>
        render(
            <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
                <PondDashboardScreen
                    navigation={navigation}
                    route={{ params: { pondId: 'p9', pondName: 'Pond 9' } }}
                />
            </SafeAreaProvider>,
        );

    it('still shows the log grid, harvest included, without expanding anything', async () => {
        const { findByTestId, getByText } = renderIdle();

        // The dead end used to be here: only "Start New Cycle".
        await findByTestId('pond-tile-actionHarvest');
        getByText('Pond is Idle');
    });

    it('reaches every history from a pond with no cycle', async () => {
        const { findByTestId, getByText } = renderIdle();
        await findByTestId('pond-tile-actionHarvest');
        fireEvent.press(getByText('View History'));
        fireEvent.press(await findByTestId('pond-tile-actionHarvest'));
        expect(navigation.navigate).toHaveBeenCalledWith(
            'HarvestHistory',
            expect.objectContaining({ pondId: 'p9' }),
        );
    });

    /**
     * The correction: water quality is POND-level (`water_quality_records` has
     * no crop column), so gating it would remove a real capability — pond
     * chemistry between cycles is what says whether the pond is fit to stock.
     */
    it('leaves the water-quality tile open for logging with no cycle', async () => {
        const { findByTestId } = renderIdle();
        const tile = await findByTestId('pond-tile-actionWaterQuality');
        expect(tile.props.accessibilityLabel).not.toMatch(/Needs a cycle/);

        fireEvent.press(tile);
        expect(navigation.navigate).toHaveBeenCalledWith(
            'WaterQualityLog',
            expect.objectContaining({ pondId: 'p9' }),
        );
    });

    it('locks the crop-keyed tiles and sends them to start a cycle, not nowhere', async () => {
        const { findByTestId, getAllByText } = renderIdle();
        for (const key of ['actionFeed', 'actionSampling', 'actionMeasurements']) {
            const tile = await findByTestId(`pond-tile-${key}`);
            expect(tile.props.accessibilityLabel).toMatch(/Needs a cycle/);
        }
        // The reason is on screen, not only in the label.
        expect(getAllByText('Needs a cycle').length).toBeGreaterThan(0);

        fireEvent.press(await findByTestId('pond-tile-actionFeed'));
        expect(navigation.navigate).toHaveBeenCalledWith('CreateCycle', { pondId: 'p9' });
        expect(navigation.navigate).not.toHaveBeenCalledWith('FeedLog', expect.anything());
    });

    /**
     * The gate must BE `requiresActiveCycle`, not a second list on this screen
     * that can drift from QuickLog's. Flip the shared module's answer and the
     * tiles must flip with it.
     */
    it('takes its answer from requiresActiveCycle, not a local list', async () => {
        (requiresActiveCycle as jest.Mock).mockImplementation(
            (route: string) => route === 'WaterQualityLog',
        );

        const { findByTestId } = renderIdle();
        expect((await findByTestId('pond-tile-actionWaterQuality')).props.accessibilityLabel).toMatch(/Needs a cycle/);
        expect((await findByTestId('pond-tile-actionFeed')).props.accessibilityLabel).not.toMatch(/Needs a cycle/);
        expect(requiresActiveCycle).toHaveBeenCalledWith('WaterQualityLog');
    });
});

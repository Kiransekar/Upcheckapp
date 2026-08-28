/**
 * The two rules the offline work turns on, checked where a farmer would see
 * them: on the pond screen.
 *
 *  1. A record saved with no signal is VISIBLE, and never folded into a
 *     server-derived figure. Biomass, survival and FCR come from the server;
 *     a queued mortality moving them would be a plausible-looking wrong number
 *     in front of someone about to act on it.
 *  2. A failed read is not an empty pond. With a cached copy the screen renders
 *     it and marks the age; only with nothing at all does it show an error.
 */
jest.mock('../../../api/ponds', () => ({ pondsApi: { getById: jest.fn() } }));
jest.mock('../../../api/pondContext', () => ({ pondContextApi: { get: jest.fn(), forFarm: jest.fn() } }));
jest.mock('../../../api/crops', () => ({ cropsApi: { getById: jest.fn() } }));
jest.mock('../../../api/alertCenter', () => ({ alertCenterApi: { briefing: jest.fn(), liveBriefing: jest.fn() } }));
jest.mock('../../../api/pnl', () => ({ pnlApi: { cropPnl: jest.fn() } }));
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
import { render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PondDashboardScreen } from '../PondDashboardScreen';
import { pondsApi } from '../../../api/ponds';
import { pondContextApi } from '../../../api/pondContext';
import { cropsApi } from '../../../api/crops';
import { alertCenterApi } from '../../../api/alertCenter';
import { pnlApi } from '../../../api/pnl';
import { useSyncStore } from '../../../store/syncStore';
import { useMembershipStore } from '../../../store/membershipStore';
import { queryClient } from '../../../query/client';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <PondDashboardScreen
                navigation={navigation}
                route={{ params: { pondId: 'p1', pondName: 'Pond 1' } }}
            />
        </SafeAreaProvider>,
    );

/** The server's snapshot: 100,000 alive, 1,250 kg standing biomass. */
const SERVER_CONTEXT = {
    pondId: 'p1',
    cropId: 'c1',
    species: null,
    areaM2: 4000,
    installedAeratorHp: 8,
    doc: 60,
    waterQuality: null,
    freeAmmoniaMgL: null,
    abwG: 12.5,
    livePopulation: 100_000,
    biomassKg: 1_250,
    crop: {
        stockingCount: 120_000,
        carryingCapacityKgM2: null,
        feedPriceRpPerKg: null,
        targetSrPercent: null,
        targetSize: null,
        targetCultivationDays: null,
    },
    cumulativeFeedKg: 1_500,
    runningFcr: 1.2,
    latestTrayResidue: null,
    lastFeedAt: null,
    lastTrayAt: null,
    samplingAt: null,
    confidence: { score: 80, band: 'high', missing: [], stale: [] },
};

const queueMortality = (quantity: number) =>
    useSyncStore.getState().enqueue({
        type: 'CREATE',
        entity: 'mortality',
        endpoint: '/mortality',
        method: 'POST',
        payload: { id: 'local-1', pondId: 'p1', quantity },
    } as any);

beforeEach(() => {
    jest.clearAllMocks();
    useSyncStore.getState().clearQueue();
    useSyncStore.getState().setConnected(true);
    useMembershipStore.setState({ memberships: [], loaded: true, loading: false } as any);
    (pondsApi.getById as jest.Mock).mockResolvedValue({
        data: { id: 'p1', farmId: 'f1', name: 'Pond 1', status: 'active', activeCycleId: 'c1' },
    });
    (pondContextApi.get as jest.Mock).mockResolvedValue({ data: SERVER_CONTEXT });
    (cropsApi.getById as jest.Mock).mockResolvedValue({ data: { id: 'c1', name: 'Cycle 1' } });
    (alertCenterApi.briefing as jest.Mock).mockResolvedValue({ data: [] });
    (pnlApi.cropPnl as jest.Mock).mockResolvedValue({ data: null });
});

describe('a pending record never reaches an aggregate', () => {
    it('lists the queued mortality but leaves biomass and survival at the SERVER figures', async () => {
        queueMortality(5_000);
        const { getByText, findByText } = renderScreen();

        // The record is visible — this is the whole "saved, will sync, then
        // vanishes" complaint.
        await findByText('Mortality');

        // Survival is livePopulation / stockingCount = 100,000 / 120,000 = 83%.
        // If the queued 5,000 were folded in it would read 79% — a number the
        // server would disagree with, on a screen a farmer acts from.
        expect(getByText('83')).toBeTruthy();
        // Standing biomass, unchanged.
        expect(getByText('1,250')).toBeTruthy();
    });
});

describe('a failed read is not an empty pond', () => {
    it('shows an error only when there is nothing cached', async () => {
        (pondsApi.getById as jest.Mock).mockRejectedValue({ message: 'Network Error' });

        const { findByText } = renderScreen();

        await findByText('No Internet Connection');
    });

    it('renders the cached copy, with its age, when a refetch fails', async () => {
        const first = renderScreen();
        await first.findByText('1,250');
        first.unmount();

        // Signal drops; the cache still holds the previous answer. Marking it
        // stale is what a return to the screen (or the farmer's own write) does.
        (pondsApi.getById as jest.Mock).mockRejectedValue({ message: 'Network Error' });
        queryClient.invalidateQueries({ queryKey: ['pond'] });
        const second = renderScreen();

        // Still the pond, not an error page…
        expect(second.getByText('1,250')).toBeTruthy();
        // …and honestly labelled as a saved copy.
        await waitFor(() => expect(second.getByText(/Showing saved data/)).toBeTruthy());
    });
});

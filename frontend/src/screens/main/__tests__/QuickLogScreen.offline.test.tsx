/**
 * L1 — the daily loop's front door must open offline.
 *
 * QuickLog was the only major screen not using the read cache: it held ponds in
 * `useState` and called `pondsApi.getMine()` directly. So standing at a pond
 * with no signal, the centre "+" tab button — the primary entrance to the
 * entire daily logging loop — hit `error && ponds.length === 0` and rendered a
 * retry screen. The farmer never reached a form, and `saveRecord` behind it
 * would have queued the reading perfectly.
 *
 * An offline-first write queue behind an online-only door.
 *
 * `qk.ponds()` is already in PERSISTED_ROOTS and HomeScreen already warms
 * exactly this key, so the data was on disk the whole time.
 */
jest.mock('../../../api/ponds', () => ({
    pondsApi: { getMine: jest.fn() },
}));
jest.mock('../../../components/ui/PondPicker', () => ({
    // The real picker fetches farms of its own; this test is about the screen.
    PondPicker: () => null,
}));
// useFocusEffect needs a NavigationContainer the plain wrapper below does not
// provide — same shim the Home and Team tests use.
jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useFocusEffect: (effect: () => void) => {
            const React = require('react');
            React.useEffect(effect, [effect]);
        },
    };
});

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QuickLogScreen } from '../QuickLogScreen';
import { pondsApi } from '../../../api/ponds';
import { qk, queryClient } from '../../../query/client';

const mockedGetMine = pondsApi.getMine as jest.Mock;

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

const POND = { id: 'p1', farmId: 'f1', name: 'P1', displayName: 'North pond', activeCycleId: 'c1' };
const POND_2 = { id: 'p2', farmId: 'f1', name: 'P2', displayName: 'South pond', activeCycleId: null };

/**
 * Warm the app's OWN query client the way HomeScreen leaves it. `useAppQuery`
 * is bound to that singleton, not to a provider, so seeding a fresh
 * QueryClient in a wrapper would have no effect at all.
 */
const withCache = (ponds: unknown[]) => {
    queryClient.clear();
    if (ponds.length) queryClient.setQueryData(qk.ponds(), ponds);
};

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <QuickLogScreen navigation={navigation} />
        </SafeAreaProvider>,
    );

beforeEach(() => jest.clearAllMocks());

describe('QuickLogScreen — offline at the pond', () => {
    it('shows the cached ponds and routes to a log form with the network down', async () => {
        mockedGetMine.mockRejectedValue(new Error('Network Error'));

        const { findByText, getByText } = (withCache([POND]), renderScreen());

        // The form is reachable — this is the whole point.
        expect(await findByText('Water Quality')).toBeTruthy();
        fireEvent.press(getByText('Water Quality'));

        await waitFor(() =>
            expect(navigation.navigate).toHaveBeenCalledWith(
                'WaterQualityLog',
                expect.objectContaining({ pondId: 'p1' }),
            ),
        );
    });

    /**
     * The three-way render is deliberate and must survive: a request that
     * FAILED with nothing cached is not the same as "you have no ponds", which
     * would tell an owner with twelve ponds to go and create a farm.
     */
    it('still offers a retry when it fails with nothing cached at all', async () => {
        mockedGetMine.mockRejectedValue(new Error('Network Error'));

        const { findByText, queryByText } = (withCache([]), renderScreen());

        expect(await findByText('Retry')).toBeTruthy();
        expect(queryByText('Create a farm')).toBeNull();
    });
});

describe('QuickLogScreen — the two intents (L3 / D5)', () => {
    it('offers the all-ponds round when there is more than one pond', async () => {
        mockedGetMine.mockResolvedValue({ data: [POND, POND_2] });

        const { findByTestId, getByTestId } = (withCache([POND, POND_2]), renderScreen());

        fireEvent.press(await findByTestId('quicklog-morning-rounds'));
        expect(getByTestId('quicklog-morning-rounds')).toBeTruthy();
        expect(navigation.navigate).toHaveBeenCalledWith('MorningRounds');
    });

    it('hides it for a single-pond farmer, who sees exactly the old screen', async () => {
        mockedGetMine.mockResolvedValue({ data: [POND] });

        const { findByText, queryByTestId } = (withCache([POND]), renderScreen());
        await findByText('Water Quality');

        // With one pond a "grid" is one row: the section would be pure noise.
        expect(queryByTestId('quicklog-morning-rounds')).toBeNull();
    });

    /**
     * L5 — mortality was reachable only by drilling into the pond dashboard,
     * yet it is a daily observation AND the input to live population → biomass
     * → running FCR → feed advice. Off the fast path, the whole engine chain
     * quietly degrades.
     */
    it('offers mortality on the fast path', async () => {
        mockedGetMine.mockResolvedValue({ data: [POND] });

        const { findByText } = (withCache([POND]), renderScreen());

        expect(await findByText('Mortality')).toBeTruthy();
    });
});

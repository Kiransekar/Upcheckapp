/**
 * "after giving a harvest with some 'x' profit, that profit is not shown in
 * ... that pond's tab."
 *
 * Two defects behind that sentence, both checked here:
 *
 *  1. The screen fetched the whole crop P&L and rendered ONE field of it —
 *     total cost. The pond page told a farmer what they spent and never what
 *     they earned.
 *  2. A FULL harvest closes the cycle, which nulls `pond.activeCycleId`. The
 *     money block was inside the `cycle ?` branch and its fetch was gated on
 *     that id, so logging the harvest that realised the profit is exactly what
 *     made the money disappear.
 */
jest.mock('../../../api/ponds', () => ({ pondsApi: { getById: jest.fn() } }));
jest.mock('../../../api/pondContext', () => ({ pondContextApi: { get: jest.fn(), forFarm: jest.fn() } }));
jest.mock('../../../api/crops', () => ({ cropsApi: { getById: jest.fn(), getAll: jest.fn() } }));
jest.mock('../../../api/alertCenter', () => ({ alertCenterApi: { briefing: jest.fn(), liveBriefing: jest.fn() } }));
jest.mock('../../../api/pnl', () => ({ pnlApi: { cropPnl: jest.fn() } }));
jest.mock('../../../api/waterQuality', () => ({ waterQualityApi: { getAll: jest.fn() } }));
jest.mock('../../../api/feedRecords', () => ({ feedApi: { getAll: jest.fn() } }));
jest.mock('../../../hooks/usePermissions', () => ({ usePermissions: jest.fn() }));
jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        // Keyed on the callback, not `[]`: the real useFocusEffect re-runs
        // when the memoized callback changes, and the money effect only
        // resolves a cycle once `pond` has loaded. An `[]` mock would freeze it
        // on the first render, when there is no pond yet.
        useFocusEffect: (effect: () => void | (() => void)) => {
            const React = require('react');
            React.useEffect(effect, [effect]);
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
import { waterQualityApi } from '../../../api/waterQuality';
import { feedApi } from '../../../api/feedRecords';
import { usePermissions } from '../../../hooks/usePermissions';
import { useSyncStore } from '../../../store/syncStore';
import { useMembershipStore } from '../../../store/membershipStore';
import { queryClient } from '../../../query/client';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

const setPerms = (canViewFinancials: boolean) =>
    (usePermissions as jest.Mock).mockReturnValue({
        canViewFinancials,
        canRecordData: true,
        canManageOperations: true,
        canStartCycle: true,
        can: () => true,
    });

/** 4.2 lakh in, 3.0 lakh out — 1.2 lakh made, 28% margin. */
const PROFITABLE = {
    cropId: 'c1',
    totalCost: 300_000,
    costBreakdown: {},
    revenue: 420_000,
    harvestBiomassKg: 2_100,
    coPerKg: 142.86,
    breakEvenCount: null,
    profit: 120_000,
    marginPct: 28.57,
    roiPct: 40,
    productivityTPerHa: null,
    harvestComplete: true,
};

const renderPond = (pondId: string) =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <PondDashboardScreen
                navigation={navigation}
                route={{ params: { pondId, pondName: 'Pond 1' } }}
            />
        </SafeAreaProvider>,
    );

beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    useSyncStore.getState().clearQueue();
    useSyncStore.getState().setConnected(true);
    useMembershipStore.setState({ memberships: [], loaded: true, loading: false } as any);
    setPerms(true);
    (pondContextApi.get as jest.Mock).mockResolvedValue({ data: null });
    (cropsApi.getById as jest.Mock).mockResolvedValue({ data: { id: 'c1', name: 'Cycle 1' } });
    (cropsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (alertCenterApi.briefing as jest.Mock).mockResolvedValue({ data: [] });
    (pnlApi.cropPnl as jest.Mock).mockResolvedValue({ data: PROFITABLE });
    (waterQualityApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (feedApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
});

const stocked = (id: string) =>
    (pondsApi.getById as jest.Mock).mockResolvedValue({
        data: { id, farmId: 'f1', name: 'Pond 1', status: 'active', activeCycleId: 'c1' },
    });

/** What a full harvest leaves behind: no active cycle, pond fallow. */
const closed = (id: string) =>
    (pondsApi.getById as jest.Mock).mockResolvedValue({
        data: { id, farmId: 'f1', name: 'Pond 1', status: 'fallow', activeCycleId: null },
    });

it('shows what the pond EARNED, not only what it cost', async () => {
    stocked('pm1');
    const { findByText, getByText } = renderPond('pm1');

    await findByText('₹4.20L'); // revenue
    getByText('₹1.20L'); // profit
    getByText('Revenue');
    getByText('Profit');
    getByText(/^29\s*%?$/); // margin, rounded from 28.57
    getByText('Margin');
    // The cost line the screen already had is still there.
    getByText('₹3.00L this cycle');
});

it('reads a loss as a loss — in the word and the sign, not the colour', async () => {
    stocked('pm2');
    (pnlApi.cropPnl as jest.Mock).mockResolvedValue({
        data: { ...PROFITABLE, revenue: 180_000, profit: -120_000, marginPct: -66.67 },
    });

    const { findByText, queryByText } = renderPond('pm2');

    await findByText('Loss');
    // The minus is in the characters, so it survives a greyscale screen.
    expect(await findByText('−₹1.20L')).toBeTruthy();
    expect(queryByText('Profit')).toBeNull();
});

it('still shows the money after a full harvest closes the cycle', async () => {
    closed('pm3');
    (cropsApi.getAll as jest.Mock).mockResolvedValue({
        data: [
            // Newest first, as GET /crops?pondId= returns them.
            { id: 'c9', pondId: 'pm3', name: 'Cycle 9', status: 'completed' },
            { id: 'c8', pondId: 'pm3', name: 'Cycle 8', status: 'completed' },
        ],
    });

    const { findByText, getByText } = renderPond('pm3');

    // This is the report: the pond used to go blank here.
    await findByText('₹1.20L');
    getByText('Money — finished cycle');
    // The most recent closed cycle, named, so it is not mistaken for a live one.
    getByText('Cycle 9');
    await waitFor(() => expect(pnlApi.cropPnl).toHaveBeenCalledWith('c9'));
});

it('does not ask for a P&L at all when the pond has never had a cycle', async () => {
    closed('pm4');
    (cropsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });

    const { findByText, queryByText } = renderPond('pm4');

    await findByText('Pond is Idle');
    expect(pnlApi.cropPnl).not.toHaveBeenCalled();
    expect(queryByText('Revenue')).toBeNull();
});

it('shows a worker none of it, and never fetches it', async () => {
    stocked('pm5');
    setPerms(false);

    const { findByText, queryByText } = renderPond('pm5');

    await findByText('Today on this pond');
    for (const label of ['Revenue', 'Profit', 'Margin', 'Expenses']) {
        expect(queryByText(label)).toBeNull();
    }
    expect(pnlApi.cropPnl).not.toHaveBeenCalled();
    expect(cropsApi.getAll).not.toHaveBeenCalled();
});

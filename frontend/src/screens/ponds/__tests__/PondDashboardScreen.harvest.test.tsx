/**
 * "Worker can just click harvest" (#4).
 *
 * Harvest used to ride WRITE_OPERATIONAL — the same key as a pH reading — so
 * anyone who could log the daily round could also book revenue and close the
 * cycle. It is its own capability now, owner and manager by default, and an
 * owner turns it on for a worker per role or per person.
 *
 * `usePermissions` is deliberately NOT mocked here: the membership payload →
 * roleCan → button path is the thing under test.
 */
jest.mock('../../../api/ponds', () => ({ pondsApi: { getById: jest.fn() } }));
jest.mock('../../../api/pondContext', () => ({ pondContextApi: { get: jest.fn(), forFarm: jest.fn() } }));
jest.mock('../../../api/crops', () => ({ cropsApi: { getById: jest.fn(), getAll: jest.fn() } }));
jest.mock('../../../api/alertCenter', () => ({ alertCenterApi: { briefing: jest.fn(), liveBriefing: jest.fn() } }));
jest.mock('../../../api/pnl', () => ({ pnlApi: { cropPnl: jest.fn() } }));
jest.mock('../../../api/waterQuality', () => ({ waterQualityApi: { getAll: jest.fn() } }));
jest.mock('../../../api/feedRecords', () => ({ feedApi: { getAll: jest.fn() } }));
jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useFocusEffect: (effect: () => void | (() => void)) => {
            const React = require('react');
            React.useEffect(effect, [effect]);
        },
    };
});

import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PondDashboardScreen } from '../PondDashboardScreen';
import { pondsApi } from '../../../api/ponds';
import { pondContextApi } from '../../../api/pondContext';
import { cropsApi } from '../../../api/crops';
import { alertCenterApi } from '../../../api/alertCenter';
import { pnlApi } from '../../../api/pnl';
import { waterQualityApi } from '../../../api/waterQuality';
import { feedApi } from '../../../api/feedRecords';
import { useSyncStore } from '../../../store/syncStore';
import { useMembershipStore } from '../../../store/membershipStore';
import type { CapabilityOverrides, RolePolicy } from '../../../permissions/capabilities';
import { queryClient } from '../../../query/client';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

const asWorker = (overrides: CapabilityOverrides | null, policy: RolePolicy | null = null) =>
    useMembershipStore.setState({
        memberships: [
            {
                farmId: 'f1',
                role: 'worker',
                status: 'active',
                capabilityOverrides: overrides,
                rolePolicy: policy,
                farm: { id: 'f1', name: 'Farm A' },
            },
        ],
        loaded: true,
        loading: false,
    } as any);

const renderPond = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <PondDashboardScreen
                navigation={navigation}
                route={{ params: { pondId: 'p1', pondName: 'Stale name' } }}
            />
        </SafeAreaProvider>,
    );

beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    useSyncStore.getState().clearQueue();
    useSyncStore.getState().setConnected(true);
    (pondsApi.getById as jest.Mock).mockResolvedValue({
        data: { id: 'p1', farmId: 'f1', name: 'P-01', displayName: 'North pond', status: 'active', activeCycleId: 'c1' },
    });
    (pondContextApi.get as jest.Mock).mockResolvedValue({ data: null });
    (cropsApi.getById as jest.Mock).mockResolvedValue({ data: { id: 'c1', name: 'Cycle 1' } });
    (cropsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (alertCenterApi.briefing as jest.Mock).mockResolvedValue({ data: [] });
    (pnlApi.cropPnl as jest.Mock).mockResolvedValue({ data: null });
    (waterQualityApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (feedApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
});

it('shows a worker with no grant nowhere to record a harvest', async () => {
    asWorker(null);
    const { findByText, queryAllByText } = renderPond();

    await findByText('Cycle 1');
    expect(queryAllByText('Harvest')).toHaveLength(0);
});

it('shows it once the owner grants RECORD_HARVEST to that member', async () => {
    asWorker({ RECORD_HARVEST: true });
    const { findByText, queryAllByText } = renderPond();

    await findByText('Cycle 1');
    // The cycle-row button and the log tile.
    expect(queryAllByText('Harvest').length).toBeGreaterThan(0);
});

it('shows it when the farm policy grants it to the worker ROLE', async () => {
    asWorker(null, { worker: { RECORD_HARVEST: true } });
    const { findByText, queryAllByText } = renderPond();

    await findByText('Cycle 1');
    expect(queryAllByText('Harvest').length).toBeGreaterThan(0);
});

it("titles the screen with the pond's own label, not the route param", async () => {
    asWorker(null);
    const { findByText, queryByText } = renderPond();

    await findByText('North pond');
    expect(queryByText('Stale name')).toBeNull();
});

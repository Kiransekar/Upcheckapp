/**
 * A pH-only log must not make yesterday's DO reading look current. Each
 * water-quality figure carries its OWN age, and the data-confidence chip
 * (already used on the six engine screens) surfaces alongside the pond's
 * headline numbers so the farmer sees the same trust signal here.
 */
jest.mock('../../../api/ponds', () => ({ pondsApi: { getById: jest.fn() } }));
jest.mock('../../../api/pondContext', () => ({ pondContextApi: { get: jest.fn(), forFarm: jest.fn() } }));
jest.mock('../../../api/crops', () => ({ cropsApi: { getById: jest.fn(), getAll: jest.fn() } }));
jest.mock('../../../api/alertCenter', () => ({ alertCenterApi: { briefing: jest.fn(), liveBriefing: jest.fn() } }));
jest.mock('../../../api/pnl', () => ({ pnlApi: { cropPnl: jest.fn() } }));
jest.mock('../../../api/activity', () => {
    const actual = jest.requireActual('../../../api/activity');
    return { ...actual, activityApi: { list: jest.fn() } };
});
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
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PondDashboardScreen } from '../PondDashboardScreen';
import { pondsApi } from '../../../api/ponds';
import { pondContextApi } from '../../../api/pondContext';
import { cropsApi } from '../../../api/crops';
import { alertCenterApi } from '../../../api/alertCenter';
import { pnlApi } from '../../../api/pnl';
import { activityApi } from '../../../api/activity';
import { useSyncStore } from '../../../store/syncStore';
import { useMembershipStore } from '../../../store/membershipStore';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { navigate: jest.fn(), goBack: jest.fn() };
const route = { params: { pondId: 'p1', pondName: 'Pond 1' } };

/** Wires the pond + context fetches an active cycle needs, so the
 * water-quality tile (nested under `cycle ?`) actually renders. */
const mockContext = ({ waterQuality, confidence }: { waterQuality: any; confidence: any }) => {
    jest.clearAllMocks();
    useSyncStore.getState().clearQueue();
    useSyncStore.getState().setConnected(true);
    useMembershipStore.setState({
        memberships: [
            {
                farmId: 'f1',
                role: 'owner',
                status: 'active',
                capabilityOverrides: null,
                rolePolicy: null,
                farm: { id: 'f1', name: 'Farm A' },
            },
        ],
        loaded: true,
        loading: false,
    } as any);
    (pondsApi.getById as jest.Mock).mockResolvedValue({
        data: { id: 'p1', farmId: 'f1', name: 'Pond 1', status: 'active', activeCycleId: 'c1' },
    });
    (cropsApi.getById as jest.Mock).mockResolvedValue({
        data: { id: 'c1', name: 'Cycle 1', status: 'active', stockingDate: null },
    });
    (cropsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (alertCenterApi.briefing as jest.Mock).mockResolvedValue({ data: [] });
    (pnlApi.cropPnl as jest.Mock).mockResolvedValue({ data: null });
    (activityApi.list as jest.Mock).mockResolvedValue({ data: { items: [], nextCursor: null } });
    (pondContextApi.get as jest.Mock).mockResolvedValue({
        data: {
            pondId: 'p1',
            farmId: 'f1',
            cropId: 'c1',
            species: null,
            areaM2: null,
            installedAeratorHp: null,
            doc: 5,
            waterQuality,
            freeAmmoniaMgL: null,
            abwG: null,
            livePopulation: null,
            biomassKg: null,
            crop: null,
            cumulativeFeedKg: null,
            runningFcr: null,
            latestTrayResidue: null,
            lastFeedAt: null,
            lastTrayAt: null,
            samplingAt: null,
            confidence,
        },
    });
};

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <PondDashboardScreen route={route} navigation={navigation} />
        </SafeAreaProvider>,
    );

describe('pond dashboard: per-reading freshness', () => {
    it('captions each water-quality reading with its own age', async () => {
        // A pH-only log must not make yesterday's DO reading look current.
        mockContext({
            waterQuality: {
                dissolvedOxygen: 5.2,
                ph: 7.9,
                temperature: null,
                salinity: null,
                ammonia: null,
                nitrite: null,
                nitrate: null,
                alkalinity: null,
                recordedAt: new Date(Date.now() - 3600_000).toISOString(),
                phAsOf: new Date(Date.now() - 3600_000).toISOString(),
                dissolvedOxygenAsOf: new Date(Date.now() - 3 * 86400_000).toISOString(),
                temperatureAsOf: null,
                salinityAsOf: null,
                chemistryAsOf: null,
                alkalinityAsOf: null,
            },
            confidence: { score: 40, band: 'low', missing: [], stale: ['DO'] },
        });

        const { findByText } = renderScreen();
        expect(await findByText('3 d')).toBeTruthy();
        expect(await findByText(/low/i)).toBeTruthy();
    });
});

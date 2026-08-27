// Morning Briefing / Daily Routine overlap fix (onboarding-plan Phase 2 /
// docs/UI_UX_AUDIT.md Tier 1 #2): previously, on a normal day with zero
// alerts, this screen just said "All clear" and stopped — the actual daily
// checklist lived on a completely different, previously-unreachable screen
// (DailyRoutineScreen). Now the "good day" path shows each active pond's
// routine checklist instead of a dead end.
jest.mock('../../../api/alertCenter', () => ({
    alertCenterApi: { liveBriefing: jest.fn(), briefing: jest.fn() },
}));
jest.mock('../../../api/ponds', () => ({
    pondsApi: { getMine: jest.fn() },
}));
jest.mock('../../../api/pondContext', () => ({
    pondContextApi: { get: jest.fn() },
}));
// See src/screens/inventory/__tests__/InventoryListScreen.test.tsx for why:
// the screen now reloads on FOCUS rather than on mount, and useFocusEffect
// needs a NavigationContainer the plain SafeAreaProvider wrapper below does
// not provide.
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
import { MorningBriefingScreen } from '../MorningBriefingScreen';
import { alertCenterApi } from '../../../api/alertCenter';
import { pondsApi } from '../../../api/ponds';
import { pondContextApi } from '../../../api/pondContext';

const mockedLive = alertCenterApi.liveBriefing as jest.Mock;
const mockedPersisted = alertCenterApi.briefing as jest.Mock;
const mockedGetMine = pondsApi.getMine as jest.Mock;
const mockedPondContext = pondContextApi.get as jest.Mock;

// See src/screens/inventory/__tests__/InventoryListScreen.test.tsx for why:
// react-native-safe-area-context's initialWindowMetrics is statically null
// outside a native runtime, so SafeAreaProvider needs explicit fake metrics.
const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const navigation = { navigate: jest.fn() };
const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <MorningBriefingScreen navigation={navigation} />
        </SafeAreaProvider>,
    );

const emptyCtx = {
    doc: 12, waterQuality: null, freeAmmoniaMgL: null, abwG: null, livePopulation: null,
    biomassKg: null, crop: null, cumulativeFeedKg: null, runningFcr: null, latestTrayResidue: null,
    lastFeedAt: null, lastTrayAt: null, samplingAt: null,
    confidence: { score: 0, band: 'low', missing: [], stale: [] },
};

describe('MorningBriefingScreen — alerts vs. good-day routine view', () => {
    beforeEach(() => jest.clearAllMocks());

    it('shows the alert feed when there are real alerts (unchanged behavior)', async () => {
        mockedLive.mockResolvedValue({ data: [] });
        mockedPersisted.mockResolvedValue({
            data: [{ pondId: 'p1', source: 'disease', topSeverity: 'critical', topTitle: 'Check for WSSV signs', steps: ['Isolate pond'], alertCount: 1 }],
        });

        const { findByText, queryByText } = renderScreen();

        expect(await findByText('Check for WSSV signs')).toBeTruthy();
        expect(queryByText("Today's routine")).toBeNull();
    });

    it('shows a routine checklist per active pond when there are zero alerts, not just "all clear"', async () => {
        mockedLive.mockResolvedValue({ data: [] });
        mockedPersisted.mockResolvedValue({ data: [] });
        mockedGetMine.mockResolvedValue({
            data: [{ id: 'p1', farmId: 'farm-1', name: 'Pond 1', displayName: 'Pond 1', activeCycleId: 'crop-1' }],
        });
        mockedPondContext.mockResolvedValue({
            data: { ...emptyCtx, lastFeedAt: new Date().toISOString() }, // feed done today, water/tray not
        });

        const { findByText, getByText } = renderScreen();

        expect(await findByText('All clear — no priority actions today')).toBeTruthy();
        expect(await findByText("Today's routine")).toBeTruthy();
        expect(getByText('Pond 1 · DOC 12')).toBeTruthy();
        expect(getByText('1/3')).toBeTruthy(); // only the feed step is done today
    });

    it('tapping a pond\'s routine card navigates into DailyRoutine for that pond', async () => {
        mockedLive.mockResolvedValue({ data: [] });
        mockedPersisted.mockResolvedValue({ data: [] });
        mockedGetMine.mockResolvedValue({
            data: [{ id: 'p1', farmId: 'farm-1', name: 'Pond 1', displayName: 'Pond 1', activeCycleId: 'crop-1' }],
        });
        mockedPondContext.mockResolvedValue({ data: emptyCtx });

        const { findByText } = renderScreen();
        fireEvent.press(await findByText('Pond 1 · DOC 12'));

        expect(navigation.navigate).toHaveBeenCalledWith('DailyRoutine', { pondId: 'p1', pondName: 'Pond 1' });
    });

    it('shows a "no active ponds" empty state (not an infinite spinner) when the farmer has no active cycles yet', async () => {
        mockedLive.mockResolvedValue({ data: [] });
        mockedPersisted.mockResolvedValue({ data: [] });
        mockedGetMine.mockResolvedValue({ data: [] });

        const { findByText } = renderScreen();

        expect(await findByText('No active ponds yet')).toBeTruthy();
    });
});

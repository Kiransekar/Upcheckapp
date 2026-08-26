// Getting Started checklist (onboarding-plan Phase 2) + worker first-run
// interstitial (Phase 1). The checklist replaces the earlier pond-count-only
// nudge with real activation milestones (ponds set up / logged something /
// invited a worker) and disappears entirely once all are done — unlike a
// reminder, a finished checklist has nothing left to say. The worker
// interstitial closes the "workers get zero onboarding" gap found in
// docs/ONBOARDING_MODULE_PLAN.md §1.2.
jest.mock('../../../api/farms', () => ({
    farmsApi: { getAll: jest.fn(), getById: jest.fn() },
}));
jest.mock('../../../api/ponds', () => ({
    pondsApi: { getMine: jest.fn() },
}));
jest.mock('../../../api/reports', () => ({
    reportsApi: { getDashboardSummary: jest.fn() },
}));
jest.mock('../../../api/pondContext', () => ({
    // forFarm backs artboard 1b's biomass figure — one batched call per farm.
    pondContextApi: { get: jest.fn(), forFarm: jest.fn().mockResolvedValue({ data: [] }) },
}));
jest.mock('../../../api/attendance', () => ({
    // "On duty" in the 1b stat band.
    attendanceApi: { getAll: jest.fn().mockResolvedValue({ data: [] }) },
}));
jest.mock('../../../api/farmMembers', () => ({
    farmMembersApi: { listMembers: jest.fn() },
}));
jest.mock('../../../api/alertCenter', () => ({
    alertCenterApi: { liveBriefing: jest.fn(), briefing: jest.fn() },
}));
jest.mock('../../../api/waterQuality', () => ({
    waterQualityApi: { getAll: jest.fn() },
}));
jest.mock('../../../api/tasks', () => ({
    tasksApi: { getAll: jest.fn() },
}));
// See src/screens/inventory/__tests__/InventoryListScreen.test.tsx for why:
// useFocusEffect needs a NavigationContainer the plain SafeAreaProvider
// wrapper below doesn't provide.
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
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen, WORKER_WELCOME_FLAG } from '../HomeScreen';
import { farmsApi } from '../../../api/farms';
import { pondsApi } from '../../../api/ponds';
import { reportsApi } from '../../../api/reports';
import { pondContextApi } from '../../../api/pondContext';
import { farmMembersApi } from '../../../api/farmMembers';
import { alertCenterApi } from '../../../api/alertCenter';
import { waterQualityApi } from '../../../api/waterQuality';
import { tasksApi } from '../../../api/tasks';
import { useActiveFarmStore } from '../../../store/activeFarmStore';
import { useMembershipStore } from '../../../store/membershipStore';
import { useAuthStore } from '../../../store/authStore';

const mockedGetAll = farmsApi.getAll as jest.Mock;
const mockedGetById = farmsApi.getById as jest.Mock;
const mockedGetMine = pondsApi.getMine as jest.Mock;
const mockedDashboard = reportsApi.getDashboardSummary as jest.Mock;
const mockedPondContext = pondContextApi.get as jest.Mock;
const mockedListMembers = farmMembersApi.listMembers as jest.Mock;
const mockedLiveBriefing = alertCenterApi.liveBriefing as jest.Mock;
const mockedBriefing = alertCenterApi.briefing as jest.Mock;
const mockedWqGetAll = waterQualityApi.getAll as jest.Mock;
const mockedTasksGetAll = tasksApi.getAll as jest.Mock;

// See src/screens/inventory/__tests__/InventoryListScreen.test.tsx for why:
// react-native-safe-area-context's initialWindowMetrics is statically null
// outside a native runtime, so SafeAreaProvider needs explicit fake metrics.
const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { navigate: jest.fn(), getParent: () => undefined };
const FARM = { id: 'farm-1', name: "Ravi's Farm" };
const POND = { id: 'p1', farmId: 'farm-1', name: 'Pond 1', displayName: 'Pond 1' };

const emptyPondContext = {
    doc: null, waterQuality: null, freeAmmoniaMgL: null, abwG: null, livePopulation: null,
    biomassKg: null, crop: null, cumulativeFeedKg: null, runningFcr: null, latestTrayResidue: null,
    lastFeedAt: null, lastTrayAt: null, samplingAt: null,
    confidence: { score: 0, band: 'low', missing: [], stale: [] },
};

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <HomeScreen navigation={navigation} />
        </SafeAreaProvider>,
    );

describe('HomeScreen — Getting Started checklist', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        await AsyncStorage.clear();
        useActiveFarmStore.setState({ selectedFarm: FARM } as any);
        // Getting Started is gated behind canManageOperations (owner/manager) —
        // a plain membership-less state no longer shows it at all.
        useMembershipStore.setState({
            memberships: [{ farmId: 'farm-1', role: 'owner', farm: FARM }],
            loaded: true, loading: false,
        } as any);
        mockedGetAll.mockResolvedValue({ data: [FARM] });
        mockedDashboard.mockResolvedValue({
            data: { activePondsCount: 1, totalPondsCount: 1, lowStockAlerts: 0, todayFeedUsage: 0 },
        });
        mockedPondContext.mockResolvedValue({ data: emptyPondContext });
        mockedListMembers.mockResolvedValue({ data: [{ id: 'owner-1' }] }); // just the owner
        mockedLiveBriefing.mockResolvedValue({ data: [] });
        mockedBriefing.mockResolvedValue({ data: [] });
        mockedWqGetAll.mockResolvedValue({ data: [] });
    });

    it('shows the checklist with pond setup unfinished and everything else undone', async () => {
        mockedGetById.mockResolvedValue({ data: { ...FARM, plannedPondCount: 3 } });
        mockedGetMine.mockResolvedValue({ data: [POND] }); // 1 of 3 ponds

        const { findByText } = renderScreen();

        expect(await findByText('Getting started')).toBeTruthy();
        expect(await findByText('0/3')).toBeTruthy();
        expect(await findByText('Set up your ponds')).toBeTruthy();
        expect(await findByText('Log your first reading')).toBeTruthy();
        expect(await findByText('Invite your team')).toBeTruthy();
    });

    it('marks items done as their real milestones are met, without hiding the card until all are done', async () => {
        mockedGetById.mockResolvedValue({ data: { ...FARM, plannedPondCount: 1 } }); // ponds: done
        mockedGetMine.mockResolvedValue({ data: [POND] });
        mockedPondContext.mockResolvedValue({ data: { ...emptyPondContext, lastFeedAt: '2026-07-01T00:00:00.000Z' } }); // log: done
        mockedListMembers.mockResolvedValue({ data: [{ id: 'owner-1' }] }); // invite: still not done

        const { findByText } = renderScreen();

        expect(await findByText('2/3')).toBeTruthy();
    });

    it('disappears entirely once every milestone is complete', async () => {
        mockedGetById.mockResolvedValue({ data: { ...FARM, plannedPondCount: 1 } });
        mockedGetMine.mockResolvedValue({ data: [POND] });
        mockedPondContext.mockResolvedValue({ data: { ...emptyPondContext, lastFeedAt: '2026-07-01T00:00:00.000Z' } });
        mockedListMembers.mockResolvedValue({ data: [{ id: 'owner-1' }, { id: 'worker-1' }] });

        const { queryByText, findByText } = renderScreen();
        await findByText('Active Ponds'); // wait for the dashboard to settle

        // Home now also fires the alerts + daily-progress fetches on focus,
        // lengthening the promise chain before hasLoggedSomething/hasInvitedWorker
        // settle — the default 1s waitFor window was occasionally too tight.
        await waitFor(() => expect(queryByText('Getting started')).toBeNull(), { timeout: 3000 });
    });

    it('dismisses for this visit without navigating anywhere', async () => {
        mockedGetById.mockResolvedValue({ data: { ...FARM, plannedPondCount: 3 } });
        mockedGetMine.mockResolvedValue({ data: [POND] });

        const { findByText, findByLabelText, queryByText } = renderScreen();
        await findByText('Getting started');

        fireEvent.press(await findByLabelText('Dismiss'));

        await waitFor(() => expect(queryByText('Getting started')).toBeNull());
        expect(navigation.navigate).not.toHaveBeenCalled();
    });

    it('tapping the unfinished ponds item navigates to PondSetup with only the remaining count', async () => {
        mockedGetById.mockResolvedValue({ data: { ...FARM, plannedPondCount: 3 } });
        mockedGetMine.mockResolvedValue({ data: [POND] });

        const { findByText } = renderScreen();
        fireEvent.press(await findByText('Set up your ponds'));

        expect(navigation.navigate).toHaveBeenCalledWith('PondSetup', { farmId: 'farm-1', totalPonds: 2 });
    });

    it('tapping the unfinished log item navigates to QuickLog', async () => {
        mockedGetById.mockResolvedValue({ data: { ...FARM, plannedPondCount: 3 } });
        mockedGetMine.mockResolvedValue({ data: [POND] });

        const { findByText } = renderScreen();
        fireEvent.press(await findByText('Log your first reading'));

        expect(navigation.navigate).toHaveBeenCalledWith('QuickLog', undefined);
    });

    it('tapping the unfinished invite item navigates to AddWorker with the farm id', async () => {
        mockedGetById.mockResolvedValue({ data: { ...FARM, plannedPondCount: 3 } });
        mockedGetMine.mockResolvedValue({ data: [POND] });

        const { findByText } = renderScreen();
        fireEvent.press(await findByText('Invite your team'));

        expect(navigation.navigate).toHaveBeenCalledWith('AddWorker', { farmId: 'farm-1' });
    });
});

describe('HomeScreen — worker first-run interstitial', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        await AsyncStorage.clear();
        useActiveFarmStore.setState({ selectedFarm: FARM } as any);
        mockedGetAll.mockResolvedValue({ data: [FARM] });
        mockedDashboard.mockResolvedValue({
            data: { activePondsCount: 1, totalPondsCount: 1, lowStockAlerts: 0, todayFeedUsage: 0 },
        });
        mockedGetMine.mockResolvedValue({ data: [POND] });
        mockedGetById.mockResolvedValue({ data: { ...FARM, plannedPondCount: 1 } });
        mockedPondContext.mockResolvedValue({ data: emptyPondContext });
        mockedListMembers.mockResolvedValue({ data: [{ id: 'owner-1' }] });
        mockedLiveBriefing.mockResolvedValue({ data: [] });
        mockedBriefing.mockResolvedValue({ data: [] });
        mockedWqGetAll.mockResolvedValue({ data: [] });
    });

    it("shows the worker's farm name and role on first login", async () => {
        useMembershipStore.setState({
            memberships: [{ farmId: 'farm-1', role: 'worker', farm: { id: 'farm-1', name: "Ravi's Farm" } }],
            loaded: true, loading: false,
        } as any);

        const { findByText } = renderScreen();

        expect(await findByText("You're part of Ravi's Farm's team as a Worker")).toBeTruthy();
    });

    it('never shows again once dismissed', async () => {
        useMembershipStore.setState({
            memberships: [{ farmId: 'farm-1', role: 'worker', farm: { id: 'farm-1', name: "Ravi's Farm" } }],
            loaded: true, loading: false,
        } as any);
        await AsyncStorage.setItem(WORKER_WELCOME_FLAG, '1');

        const { queryByText, findByText } = renderScreen();
        await findByText('Active Ponds'); // wait for the dashboard to settle

        expect(queryByText(/You're part of/)).toBeNull();
    });

    it('does not show for an owner', async () => {
        useMembershipStore.setState({
            memberships: [{ farmId: 'farm-1', role: 'owner', farm: { id: 'farm-1', name: "Ravi's Farm" } }],
            loaded: true, loading: false,
        } as any);

        const { queryByText, findByText } = renderScreen();
        await findByText('Active Ponds');

        expect(queryByText(/You're part of/)).toBeNull();
    });
});

describe('HomeScreen — worker dashboard v1 (#48)', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        await AsyncStorage.clear();
        useActiveFarmStore.setState({ selectedFarm: FARM } as any);
        useAuthStore.setState({ user: { id: 'worker-1', email: 'w@pond.in' } } as any);
        useMembershipStore.setState({
            memberships: [{ farmId: 'farm-1', role: 'worker', farm: FARM }],
            loaded: true, loading: false,
        } as any);
        mockedGetAll.mockResolvedValue({ data: [FARM] });
        mockedDashboard.mockResolvedValue({
            data: { activePondsCount: 1, totalPondsCount: 1, lowStockAlerts: 0, todayFeedUsage: 0 },
        });
        mockedGetMine.mockResolvedValue({ data: [POND] });
        mockedGetById.mockResolvedValue({ data: { ...FARM, plannedPondCount: 1 } });
        mockedPondContext.mockResolvedValue({ data: emptyPondContext });
        mockedListMembers.mockResolvedValue({ data: [{ id: 'owner-1' }, { id: 'worker-1' }] });
        mockedLiveBriefing.mockResolvedValue({ data: [] });
        mockedBriefing.mockResolvedValue({ data: [] });
        mockedWqGetAll.mockResolvedValue({ data: [] });
        await AsyncStorage.setItem(WORKER_WELCOME_FLAG, '1'); // interstitial already seen
    });

    it("shows the worker's open/in-progress assigned task count", async () => {
        mockedTasksGetAll.mockResolvedValue({
            data: [
                { id: 't1', status: 'open' },
                { id: 't2', status: 'in_progress' },
                { id: 't3', status: 'done' },
            ],
        });

        const { findByText } = renderScreen();

        expect(await findByText('2 open')).toBeTruthy();
        expect(mockedTasksGetAll).toHaveBeenCalledWith('farm-1', { assignedToId: 'worker-1' });
    });

    it('tapping "My tasks" navigates to TaskList filtered to this worker', async () => {
        mockedTasksGetAll.mockResolvedValue({ data: [] });

        const { findByText } = renderScreen();
        fireEvent.press(await findByText('My tasks'));

        expect(navigation.navigate).toHaveBeenCalledWith('TaskList', {
            farmId: 'farm-1', farmName: "Ravi's Farm", assignedToId: 'worker-1',
        });
    });

    it('shows real, interactive attendance and leave entry points', async () => {
        mockedTasksGetAll.mockResolvedValue({ data: [] });

        const { getAllByText } = renderScreen();

        expect(getAllByText('Attendance').length).toBeGreaterThan(0);
        expect(getAllByText('Leave').length).toBeGreaterThan(0);
    });

    it('navigates to Attendance when the attendance tile is tapped', async () => {
        mockedTasksGetAll.mockResolvedValue({ data: [] });

        const { findByText } = renderScreen();
        fireEvent.press(await findByText('Attendance'));

        expect(navigation.navigate).toHaveBeenCalledWith('Attendance', {
            farmId: 'farm-1', farmName: "Ravi's Farm",
        });
    });

    it('navigates to LeaveRequests when the leave tile is tapped', async () => {
        mockedTasksGetAll.mockResolvedValue({ data: [] });

        const { findByText } = renderScreen();
        fireEvent.press(await findByText('Leave'));

        expect(navigation.navigate).toHaveBeenCalledWith('LeaveRequests', {
            farmId: 'farm-1', farmName: "Ravi's Farm",
        });
    });
});

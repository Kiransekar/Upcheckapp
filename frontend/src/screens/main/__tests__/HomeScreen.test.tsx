// Today — artboard 1b (frontend/design/today-page.png).
//
// The screen is: header (date · farms · ponds / "All farms" / Filter) → the
// "Do this first" hero → "Then" → "My tasks" → the stat band. Nothing else.
// Everything that used to live below the band — the stat grid, farm-at-a-
// glance, the pond carousel, moon phase, quick actions, the worker tiles and
// the attendance/leave cards — is gone; the tab bar and Settings carry those.
//
// The two behaviours worth pinning down here are the ones that were wrong:
// Today opens on EVERY farm combined, and Filter narrows it.
jest.mock('../../../api/farms', () => ({
    farmsApi: { getAll: jest.fn(), getById: jest.fn() },
}));
jest.mock('../../../api/ponds', () => ({
    pondsApi: { getMine: jest.fn() },
}));
jest.mock('../../../api/pondContext', () => ({
    // forFarm backs the biomass and logs-today figures — one batched call per farm.
    pondContextApi: { get: jest.fn(), forFarm: jest.fn() },
}));
jest.mock('../../../api/attendance', () => ({
    attendanceApi: { getAll: jest.fn() },
}));
jest.mock('../../../api/farmMembers', () => ({
    farmMembersApi: { listMembers: jest.fn() },
}));
jest.mock('../../../api/alertCenter', () => ({
    alertCenterApi: { liveBriefing: jest.fn(), briefing: jest.fn() },
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
            React.useEffect(effect, [effect]);
        },
    };
});

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeScreen, WORKER_WELCOME_FLAG, CHECKLIST_HIDDEN_FLAG } from '../HomeScreen';
import { farmsApi } from '../../../api/farms';
import { pondsApi } from '../../../api/ponds';
import { pondContextApi } from '../../../api/pondContext';
import { attendanceApi } from '../../../api/attendance';
import { farmMembersApi } from '../../../api/farmMembers';
import { alertCenterApi } from '../../../api/alertCenter';
import { tasksApi } from '../../../api/tasks';
import { useActiveFarmStore } from '../../../store/activeFarmStore';
import { useMembershipStore } from '../../../store/membershipStore';
import { useAuthStore } from '../../../store/authStore';

const mockedGetAll = farmsApi.getAll as jest.Mock;
const mockedGetById = farmsApi.getById as jest.Mock;
const mockedGetMine = pondsApi.getMine as jest.Mock;
const mockedPondContext = pondContextApi.get as jest.Mock;
const mockedForFarm = pondContextApi.forFarm as jest.Mock;
const mockedAttendance = attendanceApi.getAll as jest.Mock;
const mockedListMembers = farmMembersApi.listMembers as jest.Mock;
const mockedLiveBriefing = alertCenterApi.liveBriefing as jest.Mock;
const mockedBriefing = alertCenterApi.briefing as jest.Mock;
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
const FARM_2 = { id: 'farm-2', name: 'Kakinada East' };
const POND = { id: 'p1', farmId: 'farm-1', name: 'Pond 1', displayName: 'Pond 1' };
const POND_2 = { id: 'p2', farmId: 'farm-2', name: 'Pond 2', displayName: 'Pond 2' };

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

/** Everything quiet: no farms, no ponds, no alerts, no tasks. */
const resetMocks = async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    // Retired by default so it does not collide with assertions about the
    // sections above it; its own describe block clears the flag.
    await AsyncStorage.setItem(CHECKLIST_HIDDEN_FLAG, '1');
    useActiveFarmStore.setState({ selectedFarm: null } as any);
    useAuthStore.setState({ user: { id: 'owner-1', email: 'o@pond.in' } } as any);
    useMembershipStore.setState({
        memberships: [
            { farmId: 'farm-1', role: 'owner', farm: FARM },
            { farmId: 'farm-2', role: 'owner', farm: FARM_2 },
        ],
        loaded: true, loading: false,
    } as any);
    mockedGetAll.mockResolvedValue({ data: [FARM] });
    mockedGetById.mockResolvedValue({ data: { ...FARM, plannedPondCount: 1 } });
    mockedGetMine.mockResolvedValue({ data: [POND] });
    mockedPondContext.mockResolvedValue({ data: emptyPondContext });
    mockedForFarm.mockResolvedValue({ data: [] });
    mockedAttendance.mockResolvedValue({ data: [] });
    mockedListMembers.mockResolvedValue({ data: [{ id: 'owner-1' }] });
    mockedLiveBriefing.mockResolvedValue({ data: [] });
    mockedBriefing.mockResolvedValue({ data: [] });
    mockedTasksGetAll.mockResolvedValue({ data: [] });
};

describe('HomeScreen — farm scope', () => {
    beforeEach(async () => {
        await resetMocks();
        mockedGetAll.mockResolvedValue({ data: [FARM, FARM_2] });
        mockedGetMine.mockResolvedValue({ data: [POND, POND_2] });
        // The active farm is already set app-wide — Today must NOT inherit it
        // as a filter. That inheritance was the reported bug.
        useActiveFarmStore.setState({ selectedFarm: FARM } as any);
        mockedForFarm.mockImplementation((farmId: string) =>
            Promise.resolve({
                data: [{ ...emptyPondContext, cropId: 'c1', biomassKg: farmId === 'farm-1' ? 400 : 600 }],
            }),
        );
    });

    it('opens on every farm combined, whatever the app-wide active farm is', async () => {
        const { findByText } = renderScreen();

        expect(await findByText('All farms')).toBeTruthy();
        // 400 + 600 — both farms, not just the active one.
        expect(await findByText('1,000')).toBeTruthy();
        expect(mockedForFarm).toHaveBeenCalledWith('farm-1');
        expect(mockedForFarm).toHaveBeenCalledWith('farm-2');
    });

    it('narrows to one farm when it is picked from the Filter', async () => {
        const { findByText, getByText, queryByText } = renderScreen();
        await findByText('All farms');

        fireEvent.press(getByText('Filter'));
        fireEvent.press(await findByText('Kakinada East'));

        // The title is the scope, so the picked farm replaces "All farms".
        await waitFor(() => expect(queryByText('All farms')).toBeNull());
        expect(await findByText('600')).toBeTruthy();
    });

    it('keeps another farm\'s emergency out of the hero once narrowed', async () => {
        mockedLiveBriefing.mockResolvedValue({
            data: [{
                pondId: 'p1', source: 'wq', topTitle: 'Start the aerators', topSeverity: 'critical',
                alertCount: 1, steps: ['Oxygen has fallen to 2.8 mg/L.'],
            }],
        });

        const { findByText, getByText, queryByText } = renderScreen();
        expect(await findByText('Start the aerators')).toBeTruthy();

        fireEvent.press(getByText('Filter'));
        fireEvent.press(await findByText('Kakinada East'));

        // p1 belongs to farm-1. Leaving it in the hero of farm-2 would tell a
        // farmer the wrong pond is dying.
        await waitFor(() => expect(queryByText('Start the aerators')).toBeNull());
    });

    it('counts only what is in scope in the header', async () => {
        const { findByText, getByText, queryByText } = renderScreen();
        expect(await findByText(/2 farms · 2 ponds/)).toBeTruthy();

        fireEvent.press(getByText('Filter'));
        fireEvent.press(await findByText('Kakinada East'));

        // One farm in scope: saying "2 farms" would contradict the title above it.
        await waitFor(() => expect(queryByText(/2 farms/)).toBeNull());
        expect(await findByText(/1 pond/)).toBeTruthy();
    });

    it('offers no Filter at all with a single farm', async () => {
        mockedGetAll.mockResolvedValue({ data: [FARM] });
        const { findByText, queryByText } = renderScreen();
        await findByText('All farms');
        expect(queryByText('Filter')).toBeNull();
    });
});

// A farm whose contexts fail to load contributed [] to the totals, so a sum
// missing one farm of two was printed as complete under a header that says
// "All farms". Worse for logs-today, which the hero reads: every farm failing
// left total 0, indistinguishable from "nothing is stocked", which would send
// an owner with stocked ponds off to start their first cycle.
describe('HomeScreen — a farm that fails to load', () => {
    beforeEach(async () => {
        await resetMocks();
        mockedGetAll.mockResolvedValue({ data: [FARM, FARM_2] });
        mockedGetMine.mockResolvedValue({ data: [POND, POND_2] });
    });

    it('shows no band at all rather than a total short by one farm', async () => {
        mockedForFarm.mockImplementation((farmId: string) =>
            farmId === 'farm-1'
                ? Promise.resolve({ data: [{ ...emptyPondContext, cropId: 'c1', biomassKg: 400 }] })
                : Promise.reject(new Error('timeout')),
        );

        const { findByText, queryByText } = renderScreen();
        await findByText('All farms');

        // 400 is farm-1 alone. Printing it as the all-farms total is the lie.
        await waitFor(() => expect(queryByText('400')).toBeNull());
    });

    it('does not tell an owner with stocked ponds to start their first cycle', async () => {
        mockedForFarm.mockRejectedValue(new Error('offline'));

        const { findByText, queryByText } = renderScreen();
        await findByText('All farms');

        await waitFor(() => expect(queryByText('Start here')).toBeNull());
        expect(queryByText(/Stock a cycle/)).toBeNull();
    });
});

describe('HomeScreen — the stat band', () => {
    beforeEach(async () => {
        await resetMocks();
        mockedForFarm.mockResolvedValue({
            data: [
                // Logged today.
                { ...emptyPondContext, cropId: 'c1', biomassKg: 9180, lastFeedAt: new Date().toISOString() },
                // Stocked but nothing recorded.
                { ...emptyPondContext, cropId: 'c2', biomassKg: null },
                // Not stocked — no round to miss, so out of the denominator.
                { ...emptyPondContext, cropId: null },
            ],
        });
        mockedListMembers.mockResolvedValue({ data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
        mockedAttendance.mockResolvedValue({ data: [{ userId: 'a' }, { userId: 'a' }, { userId: 'b' }] });
    });

    it('shows biomass, logs today and on duty', async () => {
        const { findByText } = renderScreen();

        expect(await findByText('9,180')).toBeTruthy();
        // 1 of the 2 STOCKED ponds has been logged; the fallow one is excluded.
        expect(await findByText(' / 2')).toBeTruthy();
        // Two distinct people checked in out of three on the roster — the same
        // person twice in a day is one person on duty.
        expect(await findByText(' / 3')).toBeTruthy();
    });
});

describe('HomeScreen — Getting Started checklist', () => {
    beforeEach(async () => {
        await resetMocks();
        await AsyncStorage.removeItem(CHECKLIST_HIDDEN_FLAG);
        useActiveFarmStore.setState({ selectedFarm: FARM } as any);
    });

    it('shows the checklist with pond setup unfinished and everything else undone', async () => {
        mockedGetById.mockResolvedValue({ data: { ...FARM, plannedPondCount: 3 } });

        const { findByText } = renderScreen();

        expect(await findByText('Getting started')).toBeTruthy();
        expect(await findByText('0/3')).toBeTruthy();
        expect(await findByText('Set up your ponds')).toBeTruthy();
        expect(await findByText('Log your first reading')).toBeTruthy();
        expect(await findByText('Invite your team')).toBeTruthy();
    });

    it('marks items done as their real milestones are met, without hiding until all are', async () => {
        mockedGetById.mockResolvedValue({ data: { ...FARM, plannedPondCount: 1 } }); // ponds: done
        mockedPondContext.mockResolvedValue({ data: { ...emptyPondContext, lastFeedAt: '2026-07-01T00:00:00.000Z' } });
        mockedListMembers.mockResolvedValue({ data: [{ id: 'owner-1' }] }); // invite: not done

        const { findByText } = renderScreen();

        expect(await findByText('2/3')).toBeTruthy();
    });

    it('disappears entirely once every milestone is complete', async () => {
        mockedGetById.mockResolvedValue({ data: { ...FARM, plannedPondCount: 1 } });
        mockedPondContext.mockResolvedValue({ data: { ...emptyPondContext, lastFeedAt: '2026-07-01T00:00:00.000Z' } });
        mockedListMembers.mockResolvedValue({ data: [{ id: 'owner-1' }, { id: 'worker-1' }] });

        const { queryByText, findByText } = renderScreen();
        await findByText('All farms'); // wait for the screen to settle

        await waitFor(() => expect(queryByText('Getting started')).toBeNull(), { timeout: 3000 });
    });

    it('tapping the unfinished ponds item navigates to PondSetup with only the remaining count', async () => {
        mockedGetById.mockResolvedValue({ data: { ...FARM, plannedPondCount: 3 } });

        const { findByText } = renderScreen();
        fireEvent.press(await findByText('Set up your ponds'));

        expect(navigation.navigate).toHaveBeenCalledWith('PondSetup', { farmId: 'farm-1', totalPonds: 2 });
    });

    it('tapping the unfinished log item navigates to QuickLog', async () => {
        mockedGetById.mockResolvedValue({ data: { ...FARM, plannedPondCount: 3 } });

        const { findByText } = renderScreen();
        fireEvent.press(await findByText('Log your first reading'));

        expect(navigation.navigate).toHaveBeenCalledWith('QuickLog', undefined);
    });

    it('tapping the unfinished invite item navigates to AddWorker with the farm id', async () => {
        mockedGetById.mockResolvedValue({ data: { ...FARM, plannedPondCount: 3 } });

        const { findByText } = renderScreen();
        fireEvent.press(await findByText('Invite your team'));

        expect(navigation.navigate).toHaveBeenCalledWith('AddWorker', { farmId: 'farm-1' });
    });

    // Hiding is permanent, so it asks first — and a farmer who taps Hide by
    // mistake and then cancels must keep their checklist.
    it('asks before hiding, and keeps the list if the farmer cancels', async () => {
        mockedGetById.mockResolvedValue({ data: { ...FARM, plannedPondCount: 3 } });
        const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

        const { findByText, queryByText } = renderScreen();
        fireEvent.press(await findByText('Hide'));

        expect(alert).toHaveBeenCalled();
        expect(alert.mock.calls[0][0]).toBe('Hide the setup list?');
        expect(queryByText('Getting started')).toBeTruthy();
        expect(await AsyncStorage.getItem(CHECKLIST_HIDDEN_FLAG)).toBeNull();
        alert.mockRestore();
    });

    it('never comes back once the farmer confirms', async () => {
        mockedGetById.mockResolvedValue({ data: { ...FARM, plannedPondCount: 3 } });
        // Take the confirm button the screen offered and press it.
        const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
            const confirm = (buttons ?? []).find((b) => b.text === 'Hide for good');
            confirm?.onPress?.();
        });

        const { findByText, queryByText } = renderScreen();
        fireEvent.press(await findByText('Hide'));

        await waitFor(() => expect(queryByText('Getting started')).toBeNull());
        await waitFor(async () =>
            expect(await AsyncStorage.getItem(CHECKLIST_HIDDEN_FLAG)).toBe('1'),
        );
        alert.mockRestore();

        // And it stays gone on the next visit.
        const second = renderScreen();
        await second.findByText('All farms');
        expect(second.queryByText('Getting started')).toBeNull();
    });
});

describe('HomeScreen — worker first-run interstitial', () => {
    beforeEach(async () => {
        await resetMocks();
        useActiveFarmStore.setState({ selectedFarm: FARM } as any);
        useAuthStore.setState({ user: { id: 'worker-1', email: 'w@pond.in' } } as any);
    });

    it("shows the worker's farm name and role on first login", async () => {
        useMembershipStore.setState({
            memberships: [{ farmId: 'farm-1', role: 'worker', farm: FARM }],
            loaded: true, loading: false,
        } as any);

        const { findByText } = renderScreen();

        expect(await findByText("You're part of Ravi's Farm's team as a Worker")).toBeTruthy();
    });

    it('never shows again once dismissed', async () => {
        useMembershipStore.setState({
            memberships: [{ farmId: 'farm-1', role: 'worker', farm: FARM }],
            loaded: true, loading: false,
        } as any);
        await AsyncStorage.setItem(WORKER_WELCOME_FLAG, '1');

        const { queryByText, findByText } = renderScreen();
        await findByText('All farms');

        expect(queryByText(/You're part of/)).toBeNull();
    });

    it('does not show for an owner', async () => {
        useMembershipStore.setState({
            memberships: [{ farmId: 'farm-1', role: 'owner', farm: FARM }],
            loaded: true, loading: false,
        } as any);

        const { queryByText, findByText } = renderScreen();
        await findByText('All farms');

        expect(queryByText(/You're part of/)).toBeNull();
    });
});

describe('HomeScreen — my tasks', () => {
    beforeEach(async () => {
        await resetMocks();
        useAuthStore.setState({ user: { id: 'worker-1', email: 'w@pond.in' } } as any);
        await AsyncStorage.setItem(WORKER_WELCOME_FLAG, '1');
    });

    // "N open" counts what still needs DOING. A task already finished and
    // handed on for verification is not open work for the person who did it,
    // even though it stays in the list with a Verify button for whoever checks.
    it('counts only work still to do', async () => {
        mockedTasksGetAll.mockResolvedValue({
            data: [
                { id: 't1', status: 'open', title: 'Check trays' },
                { id: 't2', status: 'in_progress', title: 'Top up lime' },
                { id: 't3', status: 'done', title: 'Sampling' },
            ],
        });

        const { findByText } = renderScreen();

        expect(await findByText('2 open')).toBeTruthy();
        expect(mockedTasksGetAll).toHaveBeenCalledWith('farm-1', { assignedToId: 'worker-1' });
    });

    it('opens the task list filtered to this person, not the whole farm', async () => {
        mockedTasksGetAll.mockResolvedValue({
            // farmId comes back on every task; the row carries it through so
            // the list opens the right farm.
            data: [{ id: 't1', farmId: 'farm-1', status: 'open', title: 'Check trays' }],
        });

        const { findByText } = renderScreen();
        fireEvent.press(await findByText('Open'));

        expect(navigation.navigate).toHaveBeenCalledWith('TaskList', {
            farmId: 'farm-1', farmName: "Ravi's Farm", assignedToId: 'worker-1',
        });
    });
});

// A new account has no alerts, so the hero stood empty and "All clear" took
// its place — telling a farmer nothing had gone wrong on a farm nothing was
// watching yet. The hero now carries the setup step blocking everything else.
describe('HomeScreen — the hero before there is any data', () => {
    beforeEach(async () => {
        await resetMocks();
        useActiveFarmStore.setState({ selectedFarm: FARM } as any);
    });

    it('asks for ponds when the farm has none', async () => {
        mockedGetMine.mockResolvedValue({ data: [] });
        mockedForFarm.mockResolvedValue({ data: [] });

        const { findByText, queryByText } = renderScreen();

        expect(await findByText('Add your ponds')).toBeTruthy();
        expect(await findByText('Start here')).toBeTruthy();
        expect(queryByText('All clear')).toBeNull();
    });

    it('asks for a cycle when the ponds are all empty', async () => {
        mockedForFarm.mockResolvedValue({ data: [{ ...emptyPondContext, cropId: null }] });

        const { findByText } = renderScreen();

        expect(await findByText('Stock a cycle in Pond 1')).toBeTruthy();
    });

    it('sends the farmer to start a cycle on that exact pond', async () => {
        mockedForFarm.mockResolvedValue({ data: [{ ...emptyPondContext, cropId: null }] });

        const { findByText } = renderScreen();
        fireEvent.press(await findByText('Start a cycle'));

        expect(navigation.navigate).toHaveBeenCalledWith('CreateCycle', { pondId: 'p1' });
    });

    it('asks for today\'s readings once a pond is stocked but unlogged', async () => {
        mockedForFarm.mockResolvedValue({ data: [{ ...emptyPondContext, cropId: 'c1' }] });

        const { findByText } = renderScreen();

        expect(await findByText('Log today’s readings')).toBeTruthy();
    });

    it('falls back to All clear once the day is logged and nothing is wrong', async () => {
        mockedForFarm.mockResolvedValue({
            data: [{ ...emptyPondContext, cropId: 'c1', lastFeedAt: new Date().toISOString() }],
        });

        const { findByText, queryByText } = renderScreen();

        expect(await findByText('All clear')).toBeTruthy();
        expect(queryByText('Start here')).toBeNull();
    });

    // A real alert always outranks a setup step: something is actually wrong
    // in a pond, which is not a thing to show behind "add your ponds".
    it('yields to a real alert', async () => {
        mockedGetMine.mockResolvedValue({ data: [] });
        mockedForFarm.mockResolvedValue({ data: [] });
        mockedLiveBriefing.mockResolvedValue({
            data: [{
                pondId: 'p1', source: 'wq', topTitle: 'Start the aerators', topSeverity: 'critical',
                alertCount: 1, steps: ['Oxygen has fallen to 2.8 mg/L.'],
            }],
        });

        const { findByText, queryByText } = renderScreen();

        expect(await findByText('Start the aerators')).toBeTruthy();
        expect(queryByText('Add your ponds')).toBeNull();
    });

    // Ponds and cycles are owner/manager work. Telling a worker to do them is
    // worse than telling them nothing.
    it('shows a worker no setup step they cannot act on', async () => {
        useMembershipStore.setState({
            memberships: [{ farmId: 'farm-1', role: 'worker', farm: FARM }],
            loaded: true, loading: false,
        } as any);
        await AsyncStorage.setItem(WORKER_WELCOME_FLAG, '1');
        mockedGetMine.mockResolvedValue({ data: [] });
        mockedForFarm.mockResolvedValue({ data: [] });

        const { findByText, queryByText } = renderScreen();
        await findByText('All farms');

        expect(queryByText('Add your ponds')).toBeNull();
    });
});

describe('HomeScreen — first run', () => {
    beforeEach(resetMocks);

    it('offers both create-a-farm and join-a-farm when there are none', async () => {
        mockedGetAll.mockResolvedValue({ data: [] });
        mockedGetMine.mockResolvedValue({ data: [] });

        const { findByText } = renderScreen();

        expect(await findByText('Create a farm')).toBeTruthy();
        expect(await findByText('Join with a code')).toBeTruthy();
    });

    // A failed request is not an empty account. Falling through to the
    // create-a-farm screen would tell an owner who is merely offline to
    // re-create the farm they already have.
    it('offers a retry instead of the create-a-farm screen when the load fails', async () => {
        mockedGetAll.mockRejectedValue(new Error('offline'));

        const { findByText, queryByText } = renderScreen();

        expect(await findByText("Couldn't load your dashboard")).toBeTruthy();
        expect(queryByText('Create a farm')).toBeNull();
    });
});

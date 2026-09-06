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
    farmMembersApi: { listMembers: jest.fn(), listMyPending: jest.fn() },
}));
jest.mock('../../../api/alertCenter', () => ({
    alertCenterApi: { today: jest.fn(), liveBriefing: jest.fn(), briefing: jest.fn() },
}));
// Only the HTTP surface is faked. `splitTasks` and the due/repeat helpers next
// to it are pure rules about what the farmer sees — stubbing those would test
// the stub.
jest.mock('../../../api/tasks', () => ({
    ...jest.requireActual('../../../api/tasks'),
    tasksApi: { getAll: jest.fn() },
}));
// The roster and "my tasks" used to fan out per farm — attendance + members +
// tasks, three calls each. Today now takes all three from ONE batched request.
jest.mock('../../../api/teamOverview', () => ({
    fetchTeamOverview: jest.fn(),
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
import { fetchTeamOverview } from '../../../api/teamOverview';
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
const mockedListMyPending = farmMembersApi.listMyPending as jest.Mock;
const mockedToday = alertCenterApi.today as jest.Mock;
const mockedLiveBriefing = alertCenterApi.liveBriefing as jest.Mock;
const mockedBriefing = alertCenterApi.briefing as jest.Mock;
const mockedTasksGetAll = tasksApi.getAll as jest.Mock;
const mockedTeamOverview = fetchTeamOverview as jest.Mock;

/** Drive the batched call the way the server would answer it. */
const teamOverview = (over: any = {}) => ({
    farms: [], myAttendance: null, allAttendance: [], pendingLeave: [],
    tasks: [], members: [], ...over,
});

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
    pondId: 'p1',
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
    // Default: nobody is waiting on an approval.
    mockedListMyPending.mockResolvedValue({ data: [] });
    mockedListMembers.mockResolvedValue({ data: [{ id: 'owner-1' }] });
    mockedLiveBriefing.mockResolvedValue({ data: [] });
    mockedBriefing.mockResolvedValue({ data: [] });
    mockedTasksGetAll.mockResolvedValue({ data: [] });
    mockedTeamOverview.mockResolvedValue(teamOverview());
    // GET /alert-center/today is what the screen actually calls now. Compose it
    // from the same forFarm/liveBriefing fixtures every test already sets, so
    // the switch to one request did not mean rewriting thirty tests — and so a
    // fixture change still flows through to whichever path is exercised.
    mockedToday.mockImplementation(async () => {
        const farms = (await mockedGetAll()).data ?? [];
        const perFarm = await Promise.all(farms.map((f: any) => mockedForFarm(f.id)));
        return {
            data: {
                contexts: perFarm.flatMap((r: any) => r.data ?? []),
                briefing: (await mockedLiveBriefing()).data ?? [],
            },
        };
    });
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
                data: [{
                    ...emptyPondContext,
                    pondId: farmId === 'farm-1' ? 'p1' : 'p2',
                    cropId: 'c1',
                    biomassKg: farmId === 'farm-1' ? 400 : 600,
                }],
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
        const { findByText, findAllByText, getByText, queryByText } = renderScreen();
        await findByText('All farms');

        fireEvent.press(getByText('Filter'));
        fireEvent.press((await findAllByText('Kakinada East'))[0]);

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

        const { findByText, findAllByText, getByText, queryByText } = renderScreen();
        expect(await findByText('Start the aerators')).toBeTruthy();

        fireEvent.press(getByText('Filter'));
        fireEvent.press((await findAllByText('Kakinada East'))[0]);

        // p1 belongs to farm-1. Leaving it in the hero of farm-2 would tell a
        // farmer the wrong pond is dying.
        await waitFor(() => expect(queryByText('Start the aerators')).toBeNull());
    });

    it('counts only what is in scope in the header', async () => {
        const { findByText, findAllByText, getByText, queryByText } = renderScreen();
        expect(await findByText(/2 farms · 2 ponds/)).toBeTruthy();

        fireEvent.press(getByText('Filter'));
        fireEvent.press((await findAllByText('Kakinada East'))[0]);

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
        // Two distinct people checked in out of three on the roster — the same
        // person twice in a day is one person on duty. Deduped by userId.
        mockedTeamOverview.mockResolvedValue(
            teamOverview({
                members: [{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }],
                allAttendance: [
                    { userId: 'a', checkInAt: new Date().toISOString() },
                    { userId: 'a', checkInAt: new Date().toISOString() },
                    { userId: 'b', checkInAt: new Date().toISOString() },
                ],
            }),
        );
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

/**
 * The "Getting Started checklist" tests LIVED HERE and are deliberately gone
 * with the component (W6).
 *
 * Home rendered two activation guides with different sequences and different
 * finish lines: the hero (ponds -> cycle -> first log -> invite) and this
 * checklist (ponds -> log -> invite). The checklist could be completed 100%
 * WITHOUT EVER STOCKING A CYCLE, because water-quality logging correctly works
 * on an unstocked pond — so a farmer could tick every box while FCR, ABW,
 * growth, feed advice, disease risk and P&L all stayed empty. Its finish line
 * was not the value moment, and it was the easier of the two to finish.
 *
 * The hero tests below now cover the single guide, including the invite step
 * this checklist used to own.
 */
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
        mockedTeamOverview.mockResolvedValue(
            teamOverview({
                tasks: [
                    { id: 't1', status: 'open', title: 'Check trays', assignedToId: 'worker-1' },
                    { id: 't2', status: 'in_progress', title: 'Top up lime', assignedToId: 'worker-1' },
                    { id: 't3', status: 'done', title: 'Sampling', assignedToId: 'worker-1' },
                    // Someone else's work must not be counted as this farmer's.
                    { id: 't4', status: 'open', title: 'Not mine', assignedToId: 'other' },
                ],
            }),
        );

        const { findByText } = renderScreen();

        expect(await findByText('2 open')).toBeTruthy();

    });

    it('opens the task list filtered to this person, not the whole farm', async () => {
        mockedTeamOverview.mockResolvedValue(
            teamOverview({
                // farmId comes back on every task; the row carries it through
                // so the list opens the right farm.
                tasks: [{ id: 't1', farmId: 'farm-1', status: 'open', title: 'Check trays', assignedToId: 'worker-1' }],
            }),
        );

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

    /**
     * Stocked-ness is read from the POND's own `activeCycleId` now, not from a
     * proxy (W6). It used to be `logsToday.total === 0`, where `logsToday`
     * counts stocked ponds — true for one pond, wrong for four: a farmer who
     * stocked one of four had `total > 0`, so the cycle step vanished for the
     * other three even though they held nothing the app could compute on.
     */
    const STOCKED_POND = { ...POND, activeCycleId: 'c1' };

    it('asks for today\'s readings once a pond is stocked but unlogged', async () => {
        mockedGetMine.mockResolvedValue({ data: [STOCKED_POND] });
        mockedForFarm.mockResolvedValue({ data: [{ ...emptyPondContext, cropId: 'c1' }] });

        const { findByText } = renderScreen();

        expect(await findByText('Log today’s readings')).toBeTruthy();
    });

    it('still asks for a cycle on the ponds that have none, when only one is stocked', async () => {
        mockedGetMine.mockResolvedValue({
            data: [STOCKED_POND, { ...POND_2, farmId: 'farm-1', activeCycleId: null }],
        });
        mockedForFarm.mockResolvedValue({ data: [{ ...emptyPondContext, cropId: 'c1' }] });

        const { findByText } = renderScreen();

        // The unstocked one, named — not silence because the other is stocked.
        expect(await findByText('Stock a cycle in Pond 2')).toBeTruthy();
    });

    it('falls back to All clear once the day is logged and nothing is wrong', async () => {
        mockedGetMine.mockResolvedValue({ data: [STOCKED_POND] });
        mockedForFarm.mockResolvedValue({
            data: [{ ...emptyPondContext, cropId: 'c1', lastFeedAt: new Date().toISOString() }],
        });
        // A team is already in place, so the invite step — the last one in the
        // single guide (W6) — does not claim the hero.
        mockedTeamOverview.mockResolvedValue(
            teamOverview({ members: [{ userId: 'owner-1' }, { userId: 'u2' }] }),
        );

        const { findByText, queryByText } = renderScreen();

        expect(await findByText('All clear')).toBeTruthy();
        expect(queryByText('Start here')).toBeNull();
    });

    /**
     * The last step of the single guide, inherited from the checklist it
     * replaced. The checklist's finish line was "invite your team" and it was
     * reachable without ever stocking a cycle; here it comes AFTER the cycle
     * and the first log, which is the order that ends at a real number.
     */
    it('asks a lone owner to invite their team once the farm is running', async () => {
        mockedGetMine.mockResolvedValue({ data: [STOCKED_POND] });
        mockedForFarm.mockResolvedValue({
            data: [{ ...emptyPondContext, cropId: 'c1', lastFeedAt: new Date().toISOString() }],
        });
        mockedTeamOverview.mockResolvedValue(
            teamOverview({ members: [{ userId: 'owner-1' }] }),
        );

        const { findByText } = renderScreen();

        expect(await findByText('Add the people who work with you')).toBeTruthy();
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

    /**
     * W1 — the third empty state.
     *
     * `getAccessibleFarmIds` filters on `status: 'active'`, correctly: a
     * pending membership grants nothing. But that gave a worker who had just
     * redeemed a valid code ZERO farms, so Home showed them the brand-new-user
     * state — "No farms yet: create a farm or join with a code" — moments
     * after they had joined one. They re-entered the code, were told it was
     * wrong, and asked for another. The loop only ended when an owner happened
     * to open the app.
     *
     * A waiting worker is not a new user with a decision to make, and nothing
     * in this state may offer them one.
     */
    it('tells a worker awaiting approval that they are waiting, not that they have no farms', async () => {
        mockedGetAll.mockResolvedValue({ data: [] });
        mockedGetMine.mockResolvedValue({ data: [] });
        mockedListMyPending.mockResolvedValue({
            data: [
                {
                    farmId: 'farm-9',
                    farmName: 'Kakinada East',
                    requestedRole: 'worker',
                    requestedAt: '2026-09-06T04:00:00.000Z',
                },
            ],
        });

        const { findByText, queryByText } = renderScreen();

        expect(await findByText(/Waiting for Kakinada East to let you in/)).toBeTruthy();
        // The two offers that sent them round in circles.
        expect(queryByText('Create a farm')).toBeNull();
        expect(queryByText('Join with a code')).toBeNull();
    });

    it('still offers create-or-join to someone genuinely new', async () => {
        mockedGetAll.mockResolvedValue({ data: [] });
        mockedGetMine.mockResolvedValue({ data: [] });
        mockedListMyPending.mockResolvedValue({ data: [] });

        const { findByText } = renderScreen();

        expect(await findByText('Create a farm')).toBeTruthy();
        expect(await findByText('Join with a code')).toBeTruthy();
    });
});

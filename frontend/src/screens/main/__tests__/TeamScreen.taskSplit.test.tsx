/**
 * The Team tab's task section, split in two.
 *
 * "Your tasks" is not just what is assigned to you — it also has to catch a
 * farm-wide task with no named assignee (everyone means you) and your own
 * personal note, neither of which this board ever showed anybody. "Others'
 * tasks" is the rest, and it must never contain a personal task: that is
 * someone's private list.
 */
jest.mock('../../../api/farms', () => ({ farmsApi: { getAll: jest.fn() } }));
jest.mock('../../../api/attendance', () => ({
    attendanceApi: { mine: jest.fn(), getAll: jest.fn(), checkOut: jest.fn() },
}));
jest.mock('../../../api/leaveRequests', () => ({ leaveRequestsApi: { getAll: jest.fn() } }));
jest.mock('../../../api/farmMembers', () => ({ farmMembersApi: { listMembers: jest.fn() } }));
jest.mock('../../../api/teamOverview', () => ({ fetchTeamOverview: jest.fn() }));
jest.mock('../../../sync/recordSync', () => ({
    saveRecord: jest.fn(),
    drainRecordQueue: jest.fn().mockResolvedValue(undefined),
}));
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

import { TeamScreen } from '../TeamScreen';
import { fetchTeamOverview } from '../../../api/teamOverview';
import { useActiveFarmStore } from '../../../store/activeFarmStore';
import { useAuthStore } from '../../../store/authStore';
import { useMembershipStore } from '../../../store/membershipStore';
import { queryClient } from '../../../query/client';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const FARM = { id: 'farm-1', name: "Ravi's Farm" };
const ME = 'owner-1';
const RAVI = 'u-ravi';

const navigation = { navigate: jest.fn() };

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <TeamScreen navigation={navigation} />
        </SafeAreaProvider>,
    );

const task = (over: any) => ({
    id: 'x', farmId: 'farm-1', title: 'Task', status: 'open', priority: 'medium',
    type: 'OTHER', scope: 'farm', assigneeIds: [], createdById: ME,
    createdAt: '', updatedAt: '', ...over,
});

const TASKS = [
    task({ id: 'mine', title: 'Mine by name', assigneeIds: [ME], createdById: RAVI }),
    task({ id: 'everyone', title: 'Everyone job', assigneeIds: [] }),
    task({ id: 'theirs', title: 'Ravi job', assigneeIds: [RAVI] }),
    task({ id: 'mypersonal', title: 'My private note', scope: 'personal', assigneeIds: [ME], createdById: ME }),
    task({ id: 'theirpersonal', title: 'Ravi private note', scope: 'personal', assigneeIds: [RAVI], createdById: RAVI }),
    task({ id: 'daily', title: 'Morning feed', assigneeIds: [ME], parentTaskId: 'tpl-1' }),
];

beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    useActiveFarmStore.setState({ selectedFarm: FARM } as any);
    useAuthStore.setState({ user: { id: ME, email: 'o@pond.in' } } as any);
    useMembershipStore.setState({
        memberships: [{ farmId: 'farm-1', role: 'owner', farm: FARM }],
        loaded: true, loading: false,
    } as any);
    (fetchTeamOverview as jest.Mock).mockResolvedValue({
        farms: [FARM],
        myAttendance: null,
        allAttendance: [],
        pendingLeave: [],
        tasks: TASKS,
        members: [
            { id: 'm1', farmId: 'farm-1', userId: ME, status: 'active', user: { id: ME, firstName: 'Owner' } },
            { id: 'm2', farmId: 'farm-1', userId: RAVI, status: 'active', user: { id: RAVI, firstName: 'Ravi' } },
        ],
        pendingJoins: 0,
        myPendingLeave: 0,
    });
});

it('splits the board into your tasks and others’ tasks', async () => {
    const { findByText, getByText } = renderScreen();
    expect(await findByText('Your tasks')).toBeTruthy();
    expect(getByText("Others' tasks")).toBeTruthy();
});

it('puts what is assigned to me, what is for everyone and my own note under mine', async () => {
    const { findByText, getByText } = renderScreen();
    await findByText('Your tasks');
    expect(getByText('Mine by name')).toBeTruthy();
    expect(getByText('Everyone job')).toBeTruthy();
    expect(getByText('My private note')).toBeTruthy();
});

it('shows somebody else’s farm task with their name on it', async () => {
    const { findByText, getAllByText } = renderScreen();
    await findByText('Ravi job');
    // The "others" row names the assignee — that is what the section is for.
    expect(getAllByText(/Ravi/).length).toBeGreaterThan(0);
});

// The one leak this split must not have.
it('never shows another person’s personal task', async () => {
    const { findByText, queryByText } = renderScreen();
    await findByText('Your tasks');
    expect(queryByText('Ravi private note')).toBeNull();
});

it('marks a repeating instance and says who set each of my tasks', async () => {
    const { findByText, getByText, getAllByText } = renderScreen();
    await findByText('Morning feed');
    expect(getByText(/Repeats/)).toBeTruthy();
    // 'Mine by name' was created by Ravi; the rest of mine, by me.
    expect(getByText(/Assigned to you/)).toBeTruthy();
    expect(getAllByText(/You set this/).length).toBeGreaterThan(0);
});

it('opens the composer from Assign rather than the task list', async () => {
    const { findByText } = renderScreen();
    fireEvent.press(await findByText('Assign'));
    await waitFor(() =>
        expect(navigation.navigate).toHaveBeenCalledWith(
            'TaskCompose',
            expect.objectContaining({ farmId: 'farm-1', scope: 'farm' }),
        ),
    );
});

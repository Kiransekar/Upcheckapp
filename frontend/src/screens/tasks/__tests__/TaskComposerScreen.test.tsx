/**
 * The composer is the whole feature: until it existed the only way to create a
 * task was a title box that sent a title and an assignee of "whoever tapped
 * it". These tests check the four payloads a farmer can actually produce —
 * everyone, named people, personal, repeating — and that the assignee picker
 * never offers somebody the server would reject.
 */
jest.mock('../../../api/tasks', () => {
    const actual = jest.requireActual('../../../api/tasks');
    return { ...actual, tasksApi: { create: jest.fn() } };
});
jest.mock('../../../api/teamOverview', () => ({ fetchTeamOverview: jest.fn() }));
jest.mock('../../../api/ponds', () => ({ pondsApi: { getAll: jest.fn() } }));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TaskComposerScreen, eligibleAssignees, recurrenceFor } from '../TaskComposerScreen';
import { tasksApi, toDueDate } from '../../../api/tasks';
import { fetchTeamOverview } from '../../../api/teamOverview';
import { pondsApi } from '../../../api/ponds';
import { useMembershipStore } from '../../../store/membershipStore';
import { queryClient } from '../../../query/client';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

const member = (userId: string, firstName: string, over: any = {}) => ({
    id: `m-${userId}`,
    farmId: 'farm-1',
    userId,
    role: 'worker',
    status: 'active',
    pondIds: [],
    canViewFinancials: null,
    capabilityOverrides: null,
    createdAt: '',
    user: { id: userId, firstName, lastName: null, username: null, avatarUrl: null },
    ...over,
});

const MEMBERS = [
    member('u-ravi', 'Ravi'),
    member('u-sita', 'Sita', { pondIds: ['pond-1'] }),
    member('u-gone', 'Pending', { status: 'pending' }),
    member('u-other', 'Elsewhere', { farmId: 'farm-2' }),
];

const renderScreen = (params: any = { farmId: 'farm-1', farmName: 'North Farm' }) =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <TaskComposerScreen navigation={navigation} route={{ params }} />
        </SafeAreaProvider>,
    );

const asOwner = () =>
    useMembershipStore.setState({
        memberships: [{ farmId: 'farm-1', role: 'owner', farm: { id: 'farm-1', name: 'North Farm' } }],
        loaded: true, loading: false,
    } as any);

const asWorker = () =>
    useMembershipStore.setState({
        memberships: [{ farmId: 'farm-1', role: 'worker', farm: { id: 'farm-1', name: 'North Farm' } }],
        loaded: true, loading: false,
    } as any);

beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    asOwner();
    (tasksApi.create as jest.Mock).mockResolvedValue({ data: {} });
    (fetchTeamOverview as jest.Mock).mockResolvedValue({ members: MEMBERS, farms: [], tasks: [] });
    (pondsApi.getAll as jest.Mock).mockResolvedValue({ data: [{ id: 'pond-1', farmId: 'farm-1', name: 'P1' }] });
});

// ── The picker's eligibility rule, checked directly ───────────────
// The server rejects an assignee who is not an active member of the farm, or
// who cannot reach the chosen pond. Offering one is a guaranteed error dialog.
describe('eligibleAssignees', () => {
    it('offers only ACTIVE members of that farm', () => {
        expect(eligibleAssignees(MEMBERS as any, 'farm-1').map((m) => m.userId)).toEqual([
            'u-ravi', 'u-sita',
        ]);
    });

    it('drops members without access once a pond is chosen', () => {
        // Ravi has an EMPTY pond scope, which means every pond. Sita is pinned
        // to pond-1, so she is out for pond-2 and in for pond-1.
        expect(eligibleAssignees(MEMBERS as any, 'farm-1', 'pond-1').map((m) => m.userId))
            .toEqual(['u-ravi', 'u-sita']);
        expect(eligibleAssignees(MEMBERS as any, 'farm-1', 'pond-2').map((m) => m.userId))
            .toEqual(['u-ravi']);
    });
});

describe('recurrenceFor', () => {
    it('is absent for a one-off', () => {
        expect(recurrenceFor('never', new Date(2026, 8, 5))).toBeUndefined();
    });

    it('is a daily rule with no weekday', () => {
        expect(recurrenceFor('daily', new Date(2026, 8, 5))).toEqual({ freq: 'daily' });
    });

    it('pins a weekly rule to the due date’s weekday', () => {
        // 5 Sep 2026 is a Saturday.
        expect(recurrenceFor('weekly', new Date(2026, 8, 5))).toEqual({ freq: 'weekly', byWeekday: 6 });
    });
});

// ── What the form actually sends ──────────────────────────────────
describe('the payload', () => {
    const today = toDueDate(new Date());

    it('sends assigneeIds: [] for everyone', async () => {
        const { getByTestId, getByText } = renderScreen();
        await waitFor(() => getByText('Ravi'));

        fireEvent.changeText(getByTestId('task-title'), 'Check the aerators');
        fireEvent.press(getByText('Create task'));

        await waitFor(() =>
            expect(tasksApi.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    farmId: 'farm-1',
                    title: 'Check the aerators',
                    scope: 'farm',
                    assigneeIds: [],
                    dueDate: today,
                }),
            ),
        );
        expect((tasksApi.create as jest.Mock).mock.calls[0][0].recurrence).toBeUndefined();
    });

    it('sends the chosen people when specific members are picked', async () => {
        const { getByTestId, getByText } = renderScreen();
        await waitFor(() => getByText('Ravi'));

        fireEvent.changeText(getByTestId('task-title'), 'Water test');
        fireEvent.press(getByText('Ravi'));
        fireEvent.press(getByText('Sita'));
        fireEvent.press(getByText('Create task'));

        await waitFor(() =>
            expect(tasksApi.create).toHaveBeenCalledWith(
                expect.objectContaining({ assigneeIds: ['u-ravi', 'u-sita'] }),
            ),
        );
    });

    it('sends a daily recurrence in one tap', async () => {
        const { getByTestId, getByText } = renderScreen();
        await waitFor(() => getByText('Ravi'));

        fireEvent.changeText(getByTestId('task-title'), 'Morning feed');
        fireEvent.press(getByText('Every day'));
        fireEvent.press(getByText('Create task'));

        await waitFor(() =>
            expect(tasksApi.create).toHaveBeenCalledWith(
                expect.objectContaining({ recurrence: { freq: 'daily' }, assigneeIds: [] }),
            ),
        );
    });

    // Anyone with READ may write themselves a note. It has no assignee picker
    // at all, and the screen says in words that nobody else can see it.
    it('sends a personal task with no assignee picker and no recurrence', async () => {
        asWorker();
        const { getByTestId, getByText, queryByText } = renderScreen();

        expect(getByTestId('personal-note')).toBeTruthy();
        expect(queryByText('Everyone')).toBeNull();
        expect(queryByText('Every day')).toBeNull();

        fireEvent.changeText(getByTestId('task-title'), 'Fix my boots');
        fireEvent.press(getByText('Create task'));

        await waitFor(() =>
            expect(tasksApi.create).toHaveBeenCalledWith(
                expect.objectContaining({ scope: 'personal' }),
            ),
        );
        const body = (tasksApi.create as jest.Mock).mock.calls[0][0];
        expect(body.assigneeIds).toBeUndefined();
        expect(body.recurrence).toBeUndefined();
    });

    it('sends only people the picker was allowed to offer', async () => {
        const { getByTestId, getByText } = renderScreen();
        await waitFor(() => getByText('Sita'));

        fireEvent.changeText(getByTestId('task-title'), 'Sampling');
        fireEvent.press(getByText('Sita'));
        // Sita is pinned to pond-1; there is no pond-2 in the list, so drive
        // the same rule the picker uses rather than a second dropdown tap.
        expect(eligibleAssignees(MEMBERS as any, 'farm-1', 'pond-2').some((m) => m.userId === 'u-sita'))
            .toBe(false);

        fireEvent.press(getByText('Create task'));
        await waitFor(() =>
            expect(tasksApi.create).toHaveBeenCalledWith(
                expect.objectContaining({ assigneeIds: ['u-sita'] }),
            ),
        );
    });
});

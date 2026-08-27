// Three reported bugs, all on this screen:
//
//   "I tried adding tasks inside the pond using the button in that page and
//    it's also not showing in the today page"  — created with no assignee, and
//    Today asks for tasks assigned to you.
//   "once changed task status i cannot change that back" — the tap was a
//    one-way ratchet, so a mis-tap was permanent.
jest.mock('../../../api/tasks', () => ({
    tasksApi: {
        getAll: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        complete: jest.fn(),
        verify: jest.fn(),
        delete: jest.fn(),
    },
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
import { TaskListScreen } from '../TaskListScreen';
import { tasksApi } from '../../../api/tasks';
import { useAuthStore } from '../../../store/authStore';
import { useMembershipStore } from '../../../store/membershipStore';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

const renderScreen = (params: any = { farmId: 'farm-1', farmName: 'North Farm' }) =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <TaskListScreen navigation={navigation} route={{ params }} />
        </SafeAreaProvider>,
    );

beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ user: { id: 'user-1', email: 'o@pond.in' } } as any);
    useMembershipStore.setState({
        memberships: [{ farmId: 'farm-1', role: 'owner', farm: { id: 'farm-1', name: 'North Farm' } }],
        loaded: true, loading: false,
    } as any);
    (tasksApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (tasksApi.create as jest.Mock).mockResolvedValue({ data: {} });
    (tasksApi.update as jest.Mock).mockResolvedValue({ data: {} });
    (tasksApi.complete as jest.Mock).mockResolvedValue({ data: {} });
});

describe('adding a task', () => {
    // A task with no assignee is nobody's work: it never reached Today, which
    // asks for tasks assigned to you, so adding one looked like it did nothing.
    it('assigns it to whoever added it', async () => {
        const { getByPlaceholderText, findByPlaceholderText } = renderScreen();
        const input = await findByPlaceholderText('Add a task…');

        fireEvent.changeText(input, 'Check the aerators');
        fireEvent(getByPlaceholderText('Add a task…'), 'submitEditing');

        await waitFor(() =>
            expect(tasksApi.create).toHaveBeenCalledWith({
                farmId: 'farm-1',
                title: 'Check the aerators',
                assignedToId: 'user-1',
            }),
        );
    });

    // Opened from Today filtered to one person, a task added here belongs to
    // that person — not to whoever happens to be holding the phone.
    it('keeps the filtered assignee when the list is scoped to someone', async () => {
        const { getByPlaceholderText, findByPlaceholderText } = renderScreen({
            farmId: 'farm-1',
            assignedToId: 'worker-9',
        });
        const input = await findByPlaceholderText('Add a task…');

        fireEvent.changeText(input, 'Water test');
        fireEvent(getByPlaceholderText('Add a task…'), 'submitEditing');

        await waitFor(() =>
            expect(tasksApi.create).toHaveBeenCalledWith(
                expect.objectContaining({ assignedToId: 'worker-9' }),
            ),
        );
    });
});

describe('changing a status back', () => {
    const task = (status: string) => ({
        id: 't1', farmId: 'farm-1', title: 'Check trays', status,
        assignedToId: 'user-1', createdAt: '', updatedAt: '',
    });

    it('steps an in-progress task back to open on a long press', async () => {
        (tasksApi.getAll as jest.Mock).mockResolvedValue({ data: [task('in_progress')] });
        const { findByText } = renderScreen();

        fireEvent(await findByText('Check trays'), 'longPress');

        await waitFor(() =>
            expect(tasksApi.update).toHaveBeenCalledWith('t1', { status: 'open' }),
        );
    });

    it('steps a done task back to in progress', async () => {
        (tasksApi.getAll as jest.Mock).mockResolvedValue({ data: [task('done')] });
        const { findByText } = renderScreen();

        fireEvent(await findByText('Check trays'), 'longPress');

        await waitFor(() =>
            expect(tasksApi.update).toHaveBeenCalledWith('t1', { status: 'in_progress' }),
        );
    });

    // Verified is a manager's decision about someone else's work. Undoing it
    // is an approval question, not a typo, so a long press must not do it.
    it('will not un-verify', async () => {
        (tasksApi.getAll as jest.Mock).mockResolvedValue({ data: [task('verified')] });
        const { findByText } = renderScreen();

        fireEvent(await findByText('Check trays'), 'longPress');

        await waitFor(() => expect(tasksApi.getAll).toHaveBeenCalled());
        expect(tasksApi.update).not.toHaveBeenCalled();
    });

    it('still advances on a plain tap', async () => {
        (tasksApi.getAll as jest.Mock).mockResolvedValue({ data: [task('open')] });
        const { findByText } = renderScreen();

        fireEvent.press(await findByText('Check trays'));

        await waitFor(() =>
            expect(tasksApi.update).toHaveBeenCalledWith('t1', { status: 'in_progress' }),
        );
    });
});

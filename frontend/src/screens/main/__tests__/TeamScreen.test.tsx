// Team — frontend/design/team.png, plus the all-farms scope the design does
// not draw. The reported gap: "why team page showing only one farm, no unified
// view and per farm filter". It read the app-wide active farm and showed that
// one, with no total and no way to switch.
jest.mock('../../../api/farms', () => ({
    farmsApi: { getAll: jest.fn() },
}));
jest.mock('../../../api/attendance', () => ({
    attendanceApi: { mine: jest.fn(), getAll: jest.fn(), checkOut: jest.fn() },
}));
jest.mock('../../../api/leaveRequests', () => ({
    leaveRequestsApi: { getAll: jest.fn() },
}));
jest.mock('../../../api/tasks', () => ({
    tasksApi: { getAll: jest.fn() },
}));
jest.mock('../../../api/farmMembers', () => ({
    farmMembersApi: { listMembers: jest.fn() },
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
import { farmsApi } from '../../../api/farms';
import { attendanceApi } from '../../../api/attendance';
import { leaveRequestsApi } from '../../../api/leaveRequests';
import { tasksApi } from '../../../api/tasks';
import { farmMembersApi } from '../../../api/farmMembers';
import { useActiveFarmStore } from '../../../store/activeFarmStore';
import { useMembershipStore } from '../../../store/membershipStore';
import { useAuthStore } from '../../../store/authStore';

const FARM = { id: 'farm-1', name: "Ravi's Farm" };
const FARM_2 = { id: 'farm-2', name: 'Kakinada East' };

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { navigate: jest.fn() };

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <TeamScreen navigation={navigation} />
        </SafeAreaProvider>,
    );

// Anita works farm-1, Bala works both — the reason members are deduped.
const MEMBERS: Record<string, any[]> = {
    'farm-1': [
        { userId: 'u1', status: 'active', user: { id: 'u1', firstName: 'Anita', lastName: 'Rao' } },
        { userId: 'u2', status: 'active', user: { id: 'u2', firstName: 'Bala', lastName: 'K' } },
    ],
    'farm-2': [
        { userId: 'u2', status: 'active', user: { id: 'u2', firstName: 'Bala', lastName: 'K' } },
    ],
};

const TASKS: Record<string, any[]> = {
    'farm-1': [{ id: 't1', farmId: 'farm-1', title: 'Check aerators', status: 'open', assignedToId: 'u1' }],
    'farm-2': [{ id: 't2', farmId: 'farm-2', title: 'Water test', status: 'open', assignedToId: 'u2' }],
};

beforeEach(() => {
    jest.clearAllMocks();
    useActiveFarmStore.setState({ selectedFarm: FARM } as any);
    useAuthStore.setState({ user: { id: 'owner-1', email: 'o@pond.in' } } as any);
    useMembershipStore.setState({
        memberships: [
            { farmId: 'farm-1', role: 'owner', farm: FARM },
            { farmId: 'farm-2', role: 'owner', farm: FARM_2 },
        ],
        loaded: true, loading: false,
    } as any);
    (farmsApi.getAll as jest.Mock).mockResolvedValue({ data: [FARM, FARM_2] });
    (attendanceApi.mine as jest.Mock).mockResolvedValue({ data: [] });
    (attendanceApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (leaveRequestsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (tasksApi.getAll as jest.Mock).mockImplementation((id: string) =>
        Promise.resolve({ data: TASKS[id] ?? [] }),
    );
    (farmMembersApi.listMembers as jest.Mock).mockImplementation((id: string) =>
        Promise.resolve({ data: MEMBERS[id] ?? [] }),
    );
});

describe('TeamScreen — farm scope', () => {
    it('opens on every farm, whatever the app-wide active farm is', async () => {
        const { findByText, findAllByText } = renderScreen();

        // Twice: the eyebrow says what you are looking at, the chip changes it.
        expect(await findAllByText(/All farms/)).toHaveLength(2);
        // Both farms' work, in one list.
        expect(await findByText('Check aerators')).toBeTruthy();
        expect(await findByText('Water test')).toBeTruthy();
    });

    // Someone who works two of your farms is one member of your team. Counting
    // them twice would make "2 of 3" out of two people.
    it('counts a person on two farms once', async () => {
        const { findByText } = renderScreen();
        await findByText('Check aerators');

        expect(await findByText(/2 checked in today|0 of 2/)).toBeTruthy();
    });

    it('names the farm on each task while showing all of them', async () => {
        const { findAllByText } = renderScreen();

        // The chip plus the meta line under farm-2's task. Without the meta a
        // row is ambiguous — two farms both have a "Check aerators".
        expect(await findAllByText(/Kakinada East/)).toHaveLength(2);
    });

    it('narrows to one farm when its chip is tapped', async () => {
        const { findByText, queryByText, getAllByText } = renderScreen();
        await findByText('Check aerators');

        // [0] is the chip; the farm name also appears on farm-2's task row.
        fireEvent.press(getAllByText('Kakinada East')[0]);

        // The chip refetches only the farm in scope, so wait for that call
        // to land before asserting the other farm has gone.
        await waitFor(() =>
            expect((tasksApi.getAll as jest.Mock).mock.calls.map((c) => c[0])).toEqual([
                'farm-1', 'farm-2', 'farm-2',
            ]),
        );
        await waitFor(() => expect(queryByText('Check aerators')).toBeNull());
        expect(await findByText('Water test')).toBeTruthy();
    });

    it('offers no chips at all with a single farm', async () => {
        (farmsApi.getAll as jest.Mock).mockResolvedValue({ data: [FARM] });
        const { findByText, queryByText } = renderScreen();
        await findByText('Check aerators');

        expect(queryByText('Kakinada East')).toBeNull();
    });

    it('shows the empty state when there are no farms at all', async () => {
        (farmsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
        const { findByText } = renderScreen();

        expect(await findByText('No farms yet')).toBeTruthy();
    });
});

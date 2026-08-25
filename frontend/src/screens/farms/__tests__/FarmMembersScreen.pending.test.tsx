// W2 rework — the "waiting to be let in" queue.
//
// Redeeming the farm code now creates a `pending` membership that grants
// nothing until someone approves it. This locks in that the queue is visible
// to whoever may approve, that Let in / Decline call the right endpoints, and
// that a pending person is NOT shown as a member of the farm.
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../../../api/farmMembers', () => ({
    farmMembersApi: {
        listMembers: jest.fn(),
        listInvites: jest.fn().mockResolvedValue({ data: [] }),
        listPending: jest.fn(),
        approveMember: jest.fn().mockResolvedValue({ data: {} }),
        declineMember: jest.fn().mockResolvedValue({ data: {} }),
        rotateInvite: jest.fn(),
        revokeInvite: jest.fn(),
        removeMember: jest.fn(),
    },
}));
jest.mock('../../../api/farms', () => ({
    farmsApi: { getById: jest.fn().mockResolvedValue({ data: { farmCode: 'ABCD2345' } }) },
}));
const OWNER_PERMS = { role: 'owner', canInviteMember: true, canRemoveMember: true };
let mockPerms: any = OWNER_PERMS;
jest.mock('../../../hooks/usePermissions', () => ({
    usePermissions: () => mockPerms,
}));
jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useFocusEffect: (cb: any) => require('react').useEffect(cb, [cb]),
}));

import { FarmMembersScreen } from '../FarmMembersScreen';
import { farmMembersApi } from '../../../api/farmMembers';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const PENDING = {
    id: 'm-pending',
    farmId: 'farm-1',
    userId: 'user-anil',
    role: 'worker',
    status: 'pending',
    createdAt: new Date().toISOString(),
    user: { id: 'user-anil', firstName: 'Anil', lastName: 'Kumar', username: null, avatarUrl: null },
};

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <FarmMembersScreen
                route={{ params: { farmId: 'farm-1', farmName: 'Kakinada East' } }}
                navigation={{ navigate: jest.fn(), goBack: jest.fn() }}
            />
        </SafeAreaProvider>,
    );

describe('FarmMembersScreen — waiting to be let in', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPerms = OWNER_PERMS;
        (farmMembersApi.listMembers as jest.Mock).mockResolvedValue({ data: [] });
        (farmMembersApi.listInvites as jest.Mock).mockResolvedValue({ data: [] });
    });

    it('shows someone who used the code, with Let in and Decline', async () => {
        (farmMembersApi.listPending as jest.Mock).mockResolvedValue({ data: [PENDING] });

        const { getByText } = renderScreen();

        await waitFor(() => expect(getByText('Anil Kumar')).toBeTruthy());
        expect(getByText('Waiting to be let in')).toBeTruthy();
        expect(getByText('Used your code')).toBeTruthy();
        expect(getByText('Let in')).toBeTruthy();
        expect(getByText('Decline')).toBeTruthy();
    });

    it('does not show the queue section when nobody is waiting', async () => {
        (farmMembersApi.listPending as jest.Mock).mockResolvedValue({ data: [] });

        const { queryByText } = renderScreen();

        await waitFor(() => expect(farmMembersApi.listPending).toHaveBeenCalled());
        expect(queryByText('Waiting to be let in')).toBeNull();
    });

    it('Let in approves and drops them out of the queue', async () => {
        (farmMembersApi.listPending as jest.Mock).mockResolvedValue({ data: [PENDING] });

        const { getByText, queryByText } = renderScreen();
        await waitFor(() => expect(getByText('Let in')).toBeTruthy());

        fireEvent.press(getByText('Let in'));

        await waitFor(() =>
            expect(farmMembersApi.approveMember).toHaveBeenCalledWith('farm-1', 'user-anil'),
        );
        await waitFor(() => expect(queryByText('Waiting to be let in')).toBeNull());
        // The roster is refetched, so the new member appears without a manual pull.
        expect(farmMembersApi.listMembers).toHaveBeenCalledTimes(2);
    });

    it('never asks for the queue when the caller cannot manage workers', async () => {
        mockPerms = { role: 'worker', canInviteMember: false, canRemoveMember: false };
        (farmMembersApi.listPending as jest.Mock).mockResolvedValue({ data: [] });

        const { queryByText } = renderScreen();

        await waitFor(() => expect(farmMembersApi.listMembers).toHaveBeenCalled());
        expect(farmMembersApi.listPending).not.toHaveBeenCalled();
        expect(queryByText('Waiting to be let in')).toBeNull();
    });
});

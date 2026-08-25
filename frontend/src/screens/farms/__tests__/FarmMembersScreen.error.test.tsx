// audit #59 — `load()` caught every API failure and set `members` to `[]`, so a
// network or server error rendered the "No team members yet" empty state. The
// owner was told their roster was empty when it was not, with no way to tell the
// difference and no retry. This locks in that a failed load shows an error with
// a retry instead of the empty state.
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../../../api/farmMembers', () => ({
    farmMembersApi: { listMembers: jest.fn(), removeMember: jest.fn() },
}));
jest.mock('../../../api/farms', () => ({
    farmsApi: { getById: jest.fn().mockResolvedValue({ data: { farmCode: 'ABCD2345' } }) },
}));
jest.mock('../../../hooks/usePermissions', () => ({
    usePermissions: () => ({ role: 'owner', canInviteMember: true, canRemoveMember: true }),
}));
// useFocusEffect is a no-op outside a navigator; run the effect like useEffect so
// load() actually fires.
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

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <FarmMembersScreen
                route={{ params: { farmId: 'farm-1', farmName: 'Kakinada East' } }}
                navigation={{ navigate: jest.fn(), goBack: jest.fn() }}
            />
        </SafeAreaProvider>,
    );

describe('FarmMembersScreen — a failed load is not an empty roster', () => {
    beforeEach(() => jest.clearAllMocks());

    it('shows the error state, not the empty state, when listMembers rejects', async () => {
        (farmMembersApi.listMembers as jest.Mock).mockRejectedValue(
            new Error('Network Error'),
        );

        const { queryByText, getByText } = renderScreen();

        await waitFor(() => expect(getByText('Could not load the team')).toBeTruthy());
        expect(queryByText('No team members yet')).toBeNull();
    });

    it('retries the load when the error state retry is pressed', async () => {
        (farmMembersApi.listMembers as jest.Mock).mockRejectedValue(
            new Error('Network Error'),
        );

        const { getByText } = renderScreen();
        await waitFor(() => expect(getByText('Could not load the team')).toBeTruthy());

        const callsBefore = (farmMembersApi.listMembers as jest.Mock).mock.calls.length;
        fireEvent.press(getByText('Retry'));
        await waitFor(() =>
            expect((farmMembersApi.listMembers as jest.Mock).mock.calls.length)
                .toBeGreaterThan(callsBefore),
        );
    });

    it('still shows the empty state when the farm genuinely has no members', async () => {
        (farmMembersApi.listMembers as jest.Mock).mockResolvedValue({ data: [] });

        const { queryByText, getByText } = renderScreen();

        await waitFor(() => expect(getByText('No team members yet')).toBeTruthy());
        expect(queryByText('Could not load the team')).toBeNull();
    });
});

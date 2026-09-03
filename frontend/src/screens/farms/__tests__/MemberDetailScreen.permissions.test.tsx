/**
 * "Role-level and per-member permission model incl. money" (#5).
 *
 * The screen used to offer ONE thing — a money switch — so the only answers an
 * owner could give were on and off, for one permission. The grid replaces it,
 * and the state that matters most is the third one: Default, meaning "follow
 * the role", which a switch cannot say at all.
 */
jest.mock('../../../api/ponds', () => ({ pondsApi: { getAll: jest.fn() } }));
jest.mock('../../../api/farmMembers', () => ({
    farmMembersApi: {
        setCapabilities: jest.fn(),
        setPondScope: jest.fn(),
        changeRole: jest.fn(),
        removeMember: jest.fn(),
        transferOwnership: jest.fn(),
    },
}));
jest.mock('../../../hooks/usePermissions', () => ({ usePermissions: jest.fn() }));
jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useFocusEffect: (effect: () => void | (() => void)) => {
            const React = require('react');
            React.useEffect(effect, [effect]);
        },
    };
});

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MemberDetailScreen } from '../MemberDetailScreen';
import { pondsApi } from '../../../api/ponds';
import { farmMembersApi, type FarmMember } from '../../../api/farmMembers';
import { usePermissions } from '../../../hooks/usePermissions';
import { useMembershipStore } from '../../../store/membershipStore';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

const WORKER: FarmMember = {
    id: 'm1',
    farmId: 'f1',
    userId: 'u1',
    role: 'worker' as const,
    status: 'active' as const,
    pondIds: [],
    canViewFinancials: null,
    capabilityOverrides: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    user: { id: 'u1', firstName: 'Ravi', lastName: null, username: null, avatarUrl: null },
};

const renderScreen = (member = WORKER) =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <MemberDetailScreen
                navigation={navigation}
                route={{ params: { farmId: 'f1', farmName: 'Farm A', member } }}
            />
        </SafeAreaProvider>,
    );

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (pondsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (farmMembersApi.setCapabilities as jest.Mock).mockResolvedValue({ data: {} });
    (usePermissions as jest.Mock).mockReturnValue({
        role: 'owner',
        canOwnerActions: true,
        canTransferOwnership: true,
        can: () => true,
    });
    useMembershipStore.setState({
        memberships: [
            {
                farmId: 'f1',
                role: 'owner',
                status: 'active',
                capabilityOverrides: null,
                rolePolicy: null,
                farm: { id: 'f1', name: 'Farm A' },
            },
        ],
        loaded: true,
        loading: false,
    } as any);
});

it('offers Default / Allowed / Blocked on every grantable permission', () => {
    const { getByTestId, getAllByText, getByText } = renderScreen();

    expect(getByTestId('capability-RECORD_HARVEST')).toBeTruthy();
    expect(getByText('Record a harvest')).toBeTruthy();
    // Five rows, so five of each chip (MANAGE_WORKERS is not grantable).
    expect(getAllByText('Default')).toHaveLength(5);
    expect(getAllByText('Allowed')).toHaveLength(5);
    expect(getAllByText('Blocked')).toHaveLength(5);
    // A worker's default for harvest is "no", and the caption says which way.
    expect(getAllByText('Default: not allowed').length).toBeGreaterThan(0);
});

it('sends the whole merged override object when one row changes', async () => {
    const { getAllByText } = renderScreen({ ...WORKER, capabilityOverrides: { VIEW_FINANCIALS: true } });

    // Row order is OVERRIDABLE_CAPABILITIES: harvest first.
    fireEvent.press(getAllByText('Allowed')[0]);

    await waitFor(() =>
        expect(farmMembersApi.setCapabilities).toHaveBeenCalledWith('f1', 'u1', {
            VIEW_FINANCIALS: true,
            RECORD_HARVEST: true,
        }),
    );
});

it('puts the grid back when the server refuses the change', async () => {
    (farmMembersApi.setCapabilities as jest.Mock).mockRejectedValue({
        response: { data: { message: 'nope' } },
    });

    const { getAllByText } = renderScreen();
    fireEvent.press(getAllByText('Blocked')[0]);

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    // Back on Default: the caption only renders in that state.
    expect(getAllByText('Default: not allowed').length).toBeGreaterThan(0);
});

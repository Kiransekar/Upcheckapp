// W2 — the farm code was both the farm's public identity AND its join
// credential, so anyone holding it could join with no approval, no expiry and
// no revocation. This locks in the split: the farm code is labelled as an
// identifier, and joining goes through an invite that can be replaced or
// revoked.
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../../../api/farmMembers', () => ({
    farmMembersApi: {
        listMembers: jest.fn().mockResolvedValue({ data: [] }),
        listInvites: jest.fn(),
        rotateInvite: jest.fn(),
        revokeInvite: jest.fn(),
        removeMember: jest.fn(),
    },
}));
jest.mock('../../../api/farms', () => ({
    farmsApi: { getById: jest.fn().mockResolvedValue({ data: { farmCode: 'ABCD2345' } }) },
}));
// Mutable so a single test can render the screen as a worker without
// re-mocking the module mid-file (jest.resetModules() + require() detaches
// React's context and blows up the render).
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

const invite = (over: any = {}) => ({
    id: 'invite-1',
    code: 'WXYZ7890',
    role: 'worker',
    expiresAt: new Date(Date.now() + 6 * 24 * 3600_000).toISOString(),
    maxUses: 3,
    usedCount: 1,
    createdAt: new Date().toISOString(),
    ...over,
});

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <FarmMembersScreen
                route={{ params: { farmId: 'farm-1', farmName: 'Kakinada East' } }}
                navigation={{ navigate: jest.fn(), goBack: jest.fn() }}
            />
        </SafeAreaProvider>,
    );

describe('FarmMembersScreen — farm code is identity, invite is the credential', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPerms = OWNER_PERMS;
        (farmMembersApi.listMembers as jest.Mock).mockResolvedValue({ data: [] });
    });

    it('no longer tells the owner to share the farm code to let someone join', async () => {
        (farmMembersApi.listInvites as jest.Mock).mockResolvedValue({ data: [] });
        const { getByText, queryByText } = renderScreen();

        await waitFor(() => expect(getByText('ABCD2345')).toBeTruthy());
        // The old copy invited exactly the behaviour this workstream removes.
        expect(queryByText('Share this code with a worker so they can join this farm themselves.')).toBeNull();
        expect(getByText("This is the farm's identifier. To let someone join, share an invite below.")).toBeTruthy();
    });

    it('prompts to create an invite when there is none', async () => {
        (farmMembersApi.listInvites as jest.Mock).mockResolvedValue({ data: [] });
        const { getByText } = renderScreen();

        await waitFor(() =>
            expect(getByText('No active invite. Create one to let someone join this farm.')).toBeTruthy(),
        );
        expect(getByText('Create an invite')).toBeTruthy();
    });

    it('shows the active invite code with its expiry and remaining uses', async () => {
        (farmMembersApi.listInvites as jest.Mock).mockResolvedValue({ data: [invite()] });
        const { getByText } = renderScreen();

        await waitFor(() => expect(getByText('WXYZ7890')).toBeTruthy());
        expect(getByText('Expires in 6 days · 1 of 3 used')).toBeTruthy();
    });

    it('labels a backfilled legacy code as never expiring with unlimited uses', async () => {
        (farmMembersApi.listInvites as jest.Mock).mockResolvedValue({
            data: [invite({ expiresAt: null, maxUses: 0, usedCount: 12 })],
        });
        const { getByText } = renderScreen();

        await waitFor(() => expect(getByText('Never expires · Unlimited uses')).toBeTruthy());
    });

    it('creating an invite rotates, so the previous code stops working', async () => {
        (farmMembersApi.listInvites as jest.Mock).mockResolvedValue({ data: [invite()] });
        (farmMembersApi.rotateInvite as jest.Mock).mockResolvedValue({
            data: invite({ id: 'invite-2', code: 'QRST4567', usedCount: 0 }),
        });

        const { getByText } = renderScreen();
        await waitFor(() => expect(getByText('WXYZ7890')).toBeTruthy());

        fireEvent.press(getByText('Replace with a new invite'));

        await waitFor(() => expect(getByText('QRST4567')).toBeTruthy());
        expect(farmMembersApi.rotateInvite).toHaveBeenCalledWith('farm-1', {});
    });

    it('hides the invite card from someone who cannot manage workers', async () => {
        mockPerms = { role: 'worker', canInviteMember: false, canRemoveMember: false };
        (farmMembersApi.listInvites as jest.Mock).mockResolvedValue({ data: [] });

        const { queryByText } = renderScreen();

        await waitFor(() => expect(farmMembersApi.listMembers).toHaveBeenCalled());
        expect(queryByText('Invite to join')).toBeNull();
        // Never even asks the server for invites it may not see.
        expect(farmMembersApi.listInvites).not.toHaveBeenCalled();
    });
});

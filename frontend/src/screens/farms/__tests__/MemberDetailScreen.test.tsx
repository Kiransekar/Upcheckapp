// Pond scoping and the financial grant shipped in W4/W6 with endpoints, an API
// client and no UI — nothing in the app could call either. This screen is that
// UI, so what these tests pin is the part that would silently grant too much:
// the empty-scope convention, and who gets to see the controls at all.
jest.mock('../../../api/farmMembers', () => ({
    farmMembersApi: {
        changeRole: jest.fn(),
        setPondScope: jest.fn().mockResolvedValue({}),
        setFinancialAccess: jest.fn().mockResolvedValue({}),
        removeMember: jest.fn(),
        transferOwnership: jest.fn(),
    },
}));
jest.mock('../../../api/ponds', () => ({
    pondsApi: {
        getAll: jest.fn().mockResolvedValue({
            data: [
                { id: 'p1', name: 'Pond 01', displayName: 'Pond 01' },
                { id: 'p2', name: 'Pond 02', displayName: 'Pond 02' },
            ],
        }),
    },
}));

let mockPerms: any;
jest.mock('../../../hooks/usePermissions', () => ({
    usePermissions: () => mockPerms,
}));
// This screen is rendered directly (no NavigationContainer) — useFocusEffect
// needs useNavigation(), which throws without one. Same convention as
// FarmMembersScreen's tests: treat it as a plain mount effect here.
jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useFocusEffect: (cb: any) => require('react').useEffect(cb, [cb]),
}));

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MemberDetailScreen } from '../MemberDetailScreen';
import { farmMembersApi } from '../../../api/farmMembers';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const OWNER = {
    role: 'owner',
    canOwnerActions: true,
    canTransferOwnership: true,
    canInviteMember: true,
};
const MANAGER = {
    role: 'manager',
    canOwnerActions: false,
    canTransferOwnership: false,
    canInviteMember: true,
};

const worker = (over: any = {}) => ({
    id: 'fm-1',
    farmId: 'farm-1',
    userId: 'user-ravi',
    role: 'worker',
    status: 'active',
    pondIds: [],
    canViewFinancials: null,
    createdAt: '',
    user: { firstName: 'Ravi', lastName: 'Kumar' },
    ...over,
});

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

const renderScreen = (member: any = worker()) =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <MemberDetailScreen
                navigation={navigation}
                route={{ params: { farmId: 'farm-1', farmName: 'Kakinada East', member } }}
            />
        </SafeAreaProvider>,
    );

describe('MemberDetailScreen — pond scope', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPerms = OWNER;
    });

    it('reads an empty scope as EVERY pond, not none', async () => {
        // This is the backend's own convention (no farm_member_ponds rows =
        // unrestricted). Rendering it as "no ponds" would tell an owner their
        // worker is locked out when they have full access.
        const { getByText } = renderScreen(worker({ pondIds: [] }));

        await waitFor(() => expect(getByText('Pond 01')).toBeTruthy());
        expect(getByText('Every pond on this farm. Tick some to narrow it.')).toBeTruthy();
    });

    it('ticks every box when the scope is empty, so the boxes agree with the caption', async () => {
        // Saying "every pond" above a column of empty checkboxes is the
        // contradiction that would make an owner "fix" a scope that was never
        // restricted — and narrow it in the process.
        const { getAllByRole, getByText } = renderScreen(worker({ pondIds: [] }));
        await waitFor(() => expect(getByText('Pond 01')).toBeTruthy());

        const boxes = getAllByRole('checkbox');
        expect(boxes).toHaveLength(2);
        for (const box of boxes) {
            expect(box.props.accessibilityState.checked).toBe(true);
        }
    });

    it('ticks only the scoped pond when the scope is narrowed', async () => {
        const { getAllByRole, getByText } = renderScreen(worker({ pondIds: ['p1'] }));
        await waitFor(() => expect(getByText('Pond 01')).toBeTruthy());

        const boxes = getAllByRole('checkbox');
        expect(boxes[0].props.accessibilityState.checked).toBe(true);
        expect(boxes[1].props.accessibilityState.checked).toBe(false);
    });

    it('narrowing to one pond sends exactly that pond', async () => {
        const { getByText } = renderScreen(worker({ pondIds: [] }));
        await waitFor(() => expect(getByText('Pond 01')).toBeTruthy());

        fireEvent.press(getByText('Pond 02'));

        await waitFor(() =>
            expect(farmMembersApi.setPondScope).toHaveBeenCalledWith('farm-1', 'user-ravi', ['p2']),
        );
    });

    it('clearing the scope restores every pond with an empty list', async () => {
        const { getByText } = renderScreen(worker({ pondIds: ['p1'] }));
        await waitFor(() => expect(getByText('Pond 01')).toBeTruthy());

        fireEvent.press(getByText('All ponds'));

        await waitFor(() =>
            expect(farmMembersApi.setPondScope).toHaveBeenCalledWith('farm-1', 'user-ravi', []),
        );
    });

    it('does not offer scoping for a manager — they run the whole farm', async () => {
        const { queryByText, findByText } = renderScreen(worker({ role: 'manager' }));
        await findByText('Role');

        expect(queryByText('Ponds they can log')).toBeNull();
    });
});

describe('MemberDetailScreen — capability gating', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPerms = OWNER;
    });

    it('offers the financial grant to an owner, for someone whose role lacks it', async () => {
        const { findByText } = renderScreen(worker());
        expect(await findByText('Can see costs and money')).toBeTruthy();
    });

    it('hides the financial grant from a manager — it is owner-only on the server', async () => {
        mockPerms = MANAGER;
        const { queryByText, findByText } = renderScreen(worker());
        await findByText('Role');

        expect(queryByText('Can see costs and money')).toBeNull();
    });

    it('hides it for a manager target too — their role already includes it', async () => {
        const { queryByText, findByText } = renderScreen(worker({ role: 'manager' }));
        await findByText('Role');

        expect(queryByText('Can see costs and money')).toBeNull();
    });

    it('gives a manager no way to promote someone to manager', async () => {
        // canAssignRole: a manager may only assign 'worker'.
        mockPerms = MANAGER;
        const { queryByText, findByText } = renderScreen(worker());
        await findByText('Worker');

        expect(queryByText('Manager')).toBeNull();
    });

    it('does not offer transfer or removal to a manager looking at another manager', async () => {
        mockPerms = MANAGER;
        const { queryByText, findByText } = renderScreen(worker({ role: 'manager' }));
        await findByText('Role');

        expect(queryByText('Transfer ownership')).toBeNull();
        expect(queryByText('Remove')).toBeNull();
    });
});

describe('MemberDetailScreen — transfer of ownership', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPerms = OWNER;
    });

    // These four keys existed in the code and in NO locale file, so the button
    // and its confirmation both rendered the raw key ("members.transferCta")
    // for the one action on this screen you cannot undo.
    it('labels the button and the confirmation in words, not key names', async () => {
        const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        const { findByText } = renderScreen(worker());

        fireEvent.press(await findByText('Transfer ownership'));

        expect(spy).toHaveBeenCalledWith(
            'Transfer ownership?',
            expect.stringContaining('Ravi Kumar'),
            expect.any(Array),
        );
        // The copy must say it is irreversible — handing over the farm is not
        // something an owner can take back from the app.
        expect(spy.mock.calls[0][1]).toContain('cannot be undone');
        spy.mockRestore();
    });
});

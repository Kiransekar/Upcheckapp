jest.mock('../../../api/leaveRequests', () => ({
    leaveRequestsApi: { mine: jest.fn(), getAll: jest.fn(), approve: jest.fn(), reject: jest.fn() },
}));
jest.mock('../../../sync/recordSync', () => ({
    saveRecord: jest.fn(),
    drainRecordQueue: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../api/farms', () => ({
    farmsApi: { getAll: jest.fn() },
}));
jest.mock('../../../api/farmMembers', () => ({
    farmMembersApi: { listMembers: jest.fn().mockResolvedValue({ data: [] }) },
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
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LeaveRequestsScreen } from '../LeaveRequestsScreen';
import { leaveRequestsApi } from '../../../api/leaveRequests';
import { farmsApi } from '../../../api/farms';
import { saveRecord } from '../../../sync/recordSync';
import { useMembershipStore } from '../../../store/membershipStore';

const mockedMine = leaveRequestsApi.mine as jest.Mock;
const mockedGetAll = leaveRequestsApi.getAll as jest.Mock;
const mockedApprove = leaveRequestsApi.approve as jest.Mock;
const mockedSaveRecord = saveRecord as jest.Mock;

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const navigation = { goBack: jest.fn() };

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <LeaveRequestsScreen navigation={navigation} route={{ params: { farmId: 'farm-1', farmName: "Ravi's Farm" } }} />
        </SafeAreaProvider>,
    );

describe('LeaveRequestsScreen — worker submit + manager approve (#51)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });

    it('submits a leave request via the offline sync queue', async () => {
        useMembershipStore.setState({
            memberships: [{ farmId: 'farm-1', role: 'worker', farm: { id: 'farm-1', name: "Ravi's Farm" } }],
            loaded: true, loading: false,
        } as any);
        mockedMine.mockResolvedValue({ data: [] });
        mockedSaveRecord.mockResolvedValue({ id: 'req-1', queued: false });

        const { findByText } = renderScreen();
        fireEvent.press(await findByText('Submit request'));

        await waitFor(() => expect(mockedSaveRecord).toHaveBeenCalledWith(
            expect.objectContaining({ entity: 'leave_request', endpoint: '/leave-requests' }),
        ));
    });

    it("does not show pending approvals to a plain worker", async () => {
        useMembershipStore.setState({
            memberships: [{ farmId: 'farm-1', role: 'worker', farm: { id: 'farm-1', name: "Ravi's Farm" } }],
            loaded: true, loading: false,
        } as any);
        mockedMine.mockResolvedValue({ data: [] });

        const { queryByText, findByText } = renderScreen();
        await findByText('My requests');

        expect(queryByText('Pending approvals')).toBeNull();
        expect(mockedGetAll).not.toHaveBeenCalled();
    });

    it('shows pending approvals for a manager and approves one', async () => {
        useMembershipStore.setState({
            memberships: [{ farmId: 'farm-1', role: 'manager', farm: { id: 'farm-1', name: "Ravi's Farm" } }],
            loaded: true, loading: false,
        } as any);
        mockedMine.mockResolvedValue({ data: [] });
        mockedGetAll.mockResolvedValue({
            data: [{ id: 'req-1', farmId: 'farm-1', userId: 'worker-1', startDate: '2026-08-01', endDate: '2026-08-03', reason: null, status: 'pending', decidedById: null, decidedAt: null, createdAt: '2026-07-01T00:00:00.000Z' }],
        });
        mockedApprove.mockResolvedValue({ data: {} });

        const { findByText, findByLabelText } = renderScreen();
        await findByText('Pending approvals');
        fireEvent.press(await findByLabelText('Approve'));

        await waitFor(() => expect(mockedApprove).toHaveBeenCalledWith('req-1'));
    });
});

// #8: opened from Team in all-farms mode there is no route farmId, and the
// screen posted it straight through as `farmId: undefined` — which the server
// rejects — despite its own header comment saying it falls back.
describe('LeaveRequestsScreen — no farm in the route params', () => {
    const FARM_1 = { id: 'farm-1', name: "Ravi's Farm" };
    const FARM_2 = { id: 'farm-2', name: 'Kakinada East' };

    const renderAllFarms = () =>
        render(
            <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
                <LeaveRequestsScreen navigation={navigation} route={{ params: {} }} />
            </SafeAreaProvider>,
        );

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Alert, 'alert').mockImplementation(() => {});
        useMembershipStore.setState({
            memberships: [
                { farmId: 'farm-1', role: 'worker', farm: FARM_1 },
                { farmId: 'farm-2', role: 'worker', farm: FARM_2 },
            ],
            loaded: true, loading: false,
        } as any);
        mockedMine.mockResolvedValue({ data: [] });
        mockedSaveRecord.mockResolvedValue({ id: 'req-1', queued: false });
        (farmsApi.getAll as jest.Mock).mockResolvedValue({ data: [FARM_1, FARM_2] });
    });

    it('submits against a concrete farm rather than undefined', async () => {
        const { findByText } = renderAllFarms();
        // Wait for the farm list before submitting — the picker defaults to the
        // first farm, and an early tap would be the very bug under test.
        await findByText('Farm');

        fireEvent.press(await findByText('Submit request'));

        await waitFor(() =>
            expect(mockedSaveRecord).toHaveBeenCalledWith(
                expect.objectContaining({ payload: expect.objectContaining({ farmId: 'farm-1' }) }),
            ),
        );
    });

    it('submits against the farm picked in the chooser', async () => {
        const { findByText, findByLabelText } = renderAllFarms();
        // The field itself is the button; its <Text> label is a sibling.
        fireEvent.press(await findByLabelText('Farm'));
        fireEvent.press(await findByText('Kakinada East'));
        fireEvent.press(await findByText('Submit request'));

        await waitFor(() =>
            expect(mockedSaveRecord).toHaveBeenCalledWith(
                expect.objectContaining({ payload: expect.objectContaining({ farmId: 'farm-2' }) }),
            ),
        );
    });
});

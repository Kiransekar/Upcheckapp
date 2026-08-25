jest.mock('../../../api/attendance', () => ({
    attendanceApi: { mine: jest.fn(), getAll: jest.fn(), checkOut: jest.fn() },
}));
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
            React.useEffect(effect, []);
        },
    };
});

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AttendanceScreen } from '../AttendanceScreen';
import { attendanceApi } from '../../../api/attendance';
import { saveRecord } from '../../../sync/recordSync';
import { useAuthStore } from '../../../store/authStore';
import { useMembershipStore } from '../../../store/membershipStore';

const mockedMine = attendanceApi.mine as jest.Mock;
const mockedGetAll = attendanceApi.getAll as jest.Mock;
const mockedCheckOut = attendanceApi.checkOut as jest.Mock;
const mockedSaveRecord = saveRecord as jest.Mock;

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const navigation = { goBack: jest.fn() };

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <AttendanceScreen navigation={navigation} route={{ params: { farmId: 'farm-1', farmName: "Ravi's Farm" } }} />
        </SafeAreaProvider>,
    );

describe('AttendanceScreen — worker self check-in/out (#50)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAuthStore.setState({ user: { id: 'worker-1', email: 'w@pond.in' } } as any);
        jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });

    it('shows "not checked in" and a check-in CTA when there is no open record', async () => {
        useMembershipStore.setState({
            memberships: [{ farmId: 'farm-1', role: 'worker', farm: { id: 'farm-1', name: "Ravi's Farm" } }],
            loaded: true, loading: false,
        } as any);
        mockedMine.mockResolvedValue({ data: [] });

        const { findByText } = renderScreen();

        expect(await findByText("You haven't checked in today")).toBeTruthy();
        expect(await findByText('Check in')).toBeTruthy();
    });

    it('checks in via the offline sync queue (saveRecord) and refreshes', async () => {
        useMembershipStore.setState({
            memberships: [{ farmId: 'farm-1', role: 'worker', farm: { id: 'farm-1', name: "Ravi's Farm" } }],
            loaded: true, loading: false,
        } as any);
        mockedMine.mockResolvedValue({ data: [] });
        mockedSaveRecord.mockResolvedValue({ id: 'rec-1', queued: false });

        const { findByText } = renderScreen();
        fireEvent.press(await findByText('Check in'));

        await waitFor(() => expect(mockedSaveRecord).toHaveBeenCalledWith({
            entity: 'attendance', endpoint: '/attendance/check-in', payload: { farmId: 'farm-1' },
        }));
        expect(mockedMine).toHaveBeenCalledTimes(2); // initial load + reload after check-in
    });

    it('shows a check-out CTA when there is an open record, and calls checkOut', async () => {
        useMembershipStore.setState({
            memberships: [{ farmId: 'farm-1', role: 'worker', farm: { id: 'farm-1', name: "Ravi's Farm" } }],
            loaded: true, loading: false,
        } as any);
        mockedMine.mockResolvedValue({
            data: [{ id: 'rec-1', farmId: 'farm-1', userId: 'worker-1', checkInAt: '2026-07-14T09:00:00.000Z', checkOutAt: null, createdAt: '2026-07-14T09:00:00.000Z' }],
        });
        mockedCheckOut.mockResolvedValue({ data: {} });

        const { findByText } = renderScreen();
        fireEvent.press(await findByText('Check out'));

        await waitFor(() => expect(mockedCheckOut).toHaveBeenCalledWith('rec-1'));
    });

    it("does not show the team roster to a plain worker", async () => {
        useMembershipStore.setState({
            memberships: [{ farmId: 'farm-1', role: 'worker', farm: { id: 'farm-1', name: "Ravi's Farm" } }],
            loaded: true, loading: false,
        } as any);
        mockedMine.mockResolvedValue({ data: [] });

        const { queryByText, findByText } = renderScreen();
        await findByText("You haven't checked in today");

        expect(queryByText('Team today')).toBeNull();
        expect(mockedGetAll).not.toHaveBeenCalled();
    });

    it('shows the team roster for a manager', async () => {
        useMembershipStore.setState({
            memberships: [{ farmId: 'farm-1', role: 'manager', farm: { id: 'farm-1', name: "Ravi's Farm" } }],
            loaded: true, loading: false,
        } as any);
        mockedMine.mockResolvedValue({ data: [] });
        mockedGetAll.mockResolvedValue({
            data: [{ id: 'rec-2', farmId: 'farm-1', userId: 'worker-2', checkInAt: '2026-07-14T08:00:00.000Z', checkOutAt: null, createdAt: '2026-07-14T08:00:00.000Z' }],
        });

        const { findByText } = renderScreen();

        expect(await findByText('Team today')).toBeTruthy();
        expect(mockedGetAll).toHaveBeenCalledWith('farm-1', expect.any(String));
    });
});

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

        /**
         * This assertion used to read `payload: { farmId: 'farm-1' }` — and in
         * doing so it PINNED A PAY BUG IN PLACE. Sending no time meant the
         * server fell back to CURRENT_TIMESTAMP, which offline is the moment
         * the queue DRAINS, not the moment the worker pressed the button. A
         * 06:00 check-in drained at 18:00 recorded an 18:00 start and erased
         * the day. The test passed precisely BECAUSE the bug existed, and
         * fixing the bug broke the test.
         *
         * So it now asserts the BEHAVIOUR that matters — that the recorded
         * time is the time of the press — rather than the shape of the call.
         */
        await waitFor(() => expect(mockedSaveRecord).toHaveBeenCalled());
        const sent = mockedSaveRecord.mock.calls[0][0];
        expect(sent.entity).toBe('attendance');
        expect(sent.endpoint).toBe('/attendance/check-in');
        expect(sent.payload.farmId).toBe('farm-1');
        // Present, an ISO instant, and the press moment — not whenever a
        // queued write happens to reach the server.
        expect(typeof sent.payload.checkInAt).toBe('string');
        expect(Number.isNaN(Date.parse(sent.payload.checkInAt))).toBe(false);
        expect(Math.abs(Date.parse(sent.payload.checkInAt) - Date.now())).toBeLessThan(60_000);
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

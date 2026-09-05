// The reported gap: "There is no proper and clear attendance view, need
// attendance filters, sort and calendar view and export." The Attendance
// screen is one day deep on purpose; this is the month view behind it.
jest.mock('../../../api/attendance', () => ({
    attendanceApi: { getAll: jest.fn() },
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
import { Share } from 'react-native';
import { render, fireEvent, waitFor, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
    AttendanceLogScreen,
    monthBounds,
    monthGrid,
    shiftHours,
    csvRows,
    type LogRow,
} from '../AttendanceLogScreen';
import { toCsv } from '../../../utils/csv';
import { attendanceApi } from '../../../api/attendance';
import { farmMembersApi } from '../../../api/farmMembers';

const MEMBERS = [
    { userId: 'u1', user: { id: 'u1', firstName: 'Anita', lastName: 'Rao' }, role: 'worker' },
    { userId: 'u2', user: { id: 'u2', firstName: 'Bala', lastName: 'K' }, role: 'worker' },
];

// Fixed instants so the assertions do not move with the clock. The screen
// opens on the current month, so the tests below set the system time to match.
const RECORDS = [
    // Anita, 3rd: 06:00 → 12:00 IST = 6h
    { id: 'r1', farmId: 'farm-1', userId: 'u1', checkInAt: '2026-06-03T00:30:00.000Z', checkOutAt: '2026-06-03T06:30:00.000Z', createdAt: '' },
    // Bala, 3rd: 08:00 IST, still in
    { id: 'r2', farmId: 'farm-1', userId: 'u2', checkInAt: '2026-06-03T02:30:00.000Z', checkOutAt: null, createdAt: '' },
    // Anita, 5th: 07:00 → 09:00 IST = 2h
    { id: 'r3', farmId: 'farm-1', userId: 'u1', checkInAt: '2026-06-05T01:30:00.000Z', checkOutAt: '2026-06-05T03:30:00.000Z', createdAt: '' },
];

const renderScreen = () =>
    render(
        <SafeAreaProvider
            initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
        >
            <AttendanceLogScreen
                navigation={{ goBack: jest.fn(), navigate: jest.fn() }}
                route={{ params: { farmId: 'farm-1', farmName: 'North Farm' } }}
            />
        </SafeAreaProvider>,
    );

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-06-10T06:00:00.000Z'));
    (attendanceApi.getAll as jest.Mock).mockResolvedValue({ data: RECORDS });
    (farmMembersApi.listMembers as jest.Mock).mockResolvedValue({ data: MEMBERS });
});

afterEach(() => {
    jest.useRealTimers();
});

describe('pure helpers', () => {
    it('monthBounds spans the first to the last day of the month', () => {
        expect(monthBounds(new Date(2026, 1, 14))).toEqual({ from: '2026-02-01', to: '2026-02-28' });
        // Leap year — the reason this is computed rather than tabled.
        expect(monthBounds(new Date(2024, 1, 14))).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    });

    it('monthGrid pads to whole weeks so columns line up', () => {
        const weeks = monthGrid(new Date(2026, 5, 1)); // June 2026 starts Monday
        expect(weeks.every((w) => w.length === 7)).toBe(true);
        expect(weeks[0][0]).toBeNull(); // Sunday the 31st of May is not this month
        expect(weeks[0][1]).toBe(1);
        expect(weeks.flat().filter((d) => d !== null)).toHaveLength(30);
    });

    it('shiftHours is null while a shift is open, not zero', () => {
        expect(shiftHours(RECORDS[0] as any)).toBe(6);
        expect(shiftHours(RECORDS[1] as any)).toBeNull();
    });

    it('toCsv quotes a name containing a comma', () => {
        const row: LogRow = {
            record: { ...RECORDS[0], id: 'x' } as any,
            name: 'Rao, Anita',
            day: '2026-06-03',
            hours: 6,
        };
        const csv = toCsv(csvRows([row]), ['Date', 'Name', 'In', 'Out', 'Hours']);
        expect(csv.split('\n')[1]).toContain('"Rao, Anita"');
        expect(csv.split('\n')[1]).toContain('2026-06-03');
        expect(csv.split('\n')[1].endsWith(',6')).toBe(true);
    });
});

describe('AttendanceLogScreen', () => {
    it('asks for the whole month in one request, not a day at a time', async () => {
        renderScreen();
        await waitFor(() => expect(attendanceApi.getAll).toHaveBeenCalled());
        expect(attendanceApi.getAll).toHaveBeenCalledWith('farm-1', undefined, '2026-06-01', '2026-06-30');
        expect(attendanceApi.getAll).toHaveBeenCalledTimes(1);
    });

    it('totals hours, days and people across the month', async () => {
        const { getByText, getByTestId } = renderScreen();
        // 6h + 2h; the open shift contributes nothing until it is closed.
        await waitFor(() => expect(getByText('8h')).toBeTruthy());
        // Scoped to the summary: bare digits also appear in every calendar cell.
        const totals = within(getByTestId('attendance-totals'));
        // Two people, across two days — both render as a bare '2'.
        expect(totals.getAllByText('2')).toHaveLength(2);
        expect(totals.getByText('8h')).toBeTruthy();
    });

    it('filters to one person when their chip is tapped', async () => {
        const { getByText, getAllByText, queryAllByText } = renderScreen();
        await waitFor(() => expect(getByText('3 shifts')).toBeTruthy());

        // [0] is the filter chip; the same name also labels Bala's row.
        fireEvent.press(getAllByText('Bala K')[0]);

        await waitFor(() => expect(getByText('1 shifts')).toBeTruthy());
        // Anita's two shifts are gone. Her name survives once — as the chip
        // you tap to switch to her, which must not vanish when it is not
        // selected or there would be no way back.
        expect(queryAllByText('Anita Rao')).toHaveLength(1);
    });

    it('filters to open shifts only', async () => {
        const { getByText } = renderScreen();
        await waitFor(() => expect(getByText('3 shifts')).toBeTruthy());

        fireEvent.press(getByText('Still in only'));

        await waitFor(() => expect(getByText('1 shifts')).toBeTruthy());
    });

    it('narrows to a day when its calendar cell is tapped, and names who was absent', async () => {
        const { getByText, queryByText } = renderScreen();
        await waitFor(() => expect(getByText('3 shifts')).toBeTruthy());

        fireEvent.press(getByText('5'));

        await waitFor(() => expect(getByText('1 shifts')).toBeTruthy());
        // Only Anita worked the 5th, so Bala is the absentee — a list of only
        // who turned up tells a manager nothing about who did not.
        expect(getByText('No record')).toBeTruthy();
        expect(queryByText('Did not check in')).toBeTruthy();
    });

    it('moving to another month drops the day selection', async () => {
        const { getByText, getByLabelText, queryByText } = renderScreen();
        await waitFor(() => expect(getByText('3 shifts')).toBeTruthy());
        fireEvent.press(getByText('5'));
        await waitFor(() => expect(getByText('1 shifts')).toBeTruthy());

        fireEvent.press(getByLabelText('Previous month'));

        // The 5th of June is not the 5th of May.
        await waitFor(() => expect(queryByText('No record')).toBeNull());
        expect(attendanceApi.getAll).toHaveBeenLastCalledWith('farm-1', undefined, '2026-05-01', '2026-05-31');
    });

    it('exports exactly the rows on screen, not the unfiltered month', async () => {
        const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);
        const { getByText, getAllByText } = renderScreen();
        await waitFor(() => expect(getByText('3 shifts')).toBeTruthy());

        fireEvent.press(getAllByText('Bala K')[0]);
        await waitFor(() => expect(getByText('1 shifts')).toBeTruthy());
        fireEvent.press(getByText('Export'));

        await waitFor(() => expect(share).toHaveBeenCalled());
        const csv = share.mock.calls[0][0].message as string;
        expect(csv.split('\n')).toHaveLength(2); // heading + Bala's one shift
        expect(csv).toContain('Bala K');
        expect(csv).not.toContain('Anita Rao');
        share.mockRestore();
    });

    // A failed read is not an empty month. Rendering one as the other is the
    // same lie that had a farmer checking in over and over.
    it('says the load failed rather than showing an empty month', async () => {
        (attendanceApi.getAll as jest.Mock).mockRejectedValue(new Error('offline'));
        const { getByText } = renderScreen();
        await waitFor(() => expect(getByText('Could not load your attendance.')).toBeTruthy());
    });
});

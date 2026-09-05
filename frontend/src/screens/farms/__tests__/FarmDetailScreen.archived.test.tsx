/**
 * "I ARCHIVED a pond but it didn't show in Include archived ponds button press
 * and cant unarchive."
 *
 * The end-to-end path exists; this pins down whether the SCREEN actually shows
 * an archived pond once the toggle is on, and whether the unarchive control is
 * reachable.
 */
jest.mock('../../../api/ponds', () => ({
    pondsApi: { getAll: jest.fn(), unarchive: jest.fn() },
}));
jest.mock('../../../api/pondContext', () => ({
    pondContextApi: { forFarm: jest.fn() },
}));
jest.mock('../../../api/alertCenter', () => ({
    alertCenterApi: { liveBriefing: jest.fn(), briefing: jest.fn() },
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
jest.mock('../../../utils/confirm', () => ({ confirm: jest.fn().mockResolvedValue(true) }));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FarmDetailScreen } from '../FarmDetailScreen';
import { pondsApi } from '../../../api/ponds';
import { pondContextApi } from '../../../api/pondContext';
import { alertCenterApi } from '../../../api/alertCenter';
import { useActiveFarmStore } from '../../../store/activeFarmStore';
import { useMembershipStore } from '../../../store/membershipStore';
import { queryClient } from '../../../query/client';

const mockedGetAll = pondsApi.getAll as jest.Mock;
const mockedUnarchive = pondsApi.unarchive as jest.Mock;
const mockedForFarm = pondContextApi.forFarm as jest.Mock;

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

const ACTIVE = { id: 'p1', farmId: 'f9', name: 'Pond 01', displayName: 'Pond 01', status: 'active', activeCycleId: 'c1' };
const ARCHIVED = { id: 'p2', farmId: 'f9', name: 'Pond 02', displayName: 'Pond 02', status: 'archived', archivedAt: '2026-09-01T00:00:00.000Z' };

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <FarmDetailScreen navigation={navigation} route={{ params: { farmId: 'f9', farmName: 'Nine' } }} />
        </SafeAreaProvider>,
    );

describe('FarmDetailScreen — archived ponds', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        queryClient.clear();
        useActiveFarmStore.setState({ selectedFarm: null } as any);
        useMembershipStore.setState({
            memberships: [{ farmId: 'f9', role: 'owner' }],
            loaded: true,
            loading: false,
        } as any);
        (alertCenterApi.liveBriefing as jest.Mock).mockResolvedValue({ data: [] });
        (alertCenterApi.briefing as jest.Mock).mockResolvedValue({ data: [] });
        mockedForFarm.mockResolvedValue({ data: [] });
        mockedGetAll.mockImplementation((_farmId: string, params: any) =>
            Promise.resolve({
                data: { data: params?.includeArchived ? [ACTIVE, ARCHIVED] : [ACTIVE] },
            }),
        );
        mockedUnarchive.mockResolvedValue({ data: { message: 'ok' } });
    });

    it('lists the archived pond after the toggle is pressed', async () => {
        const screen = renderScreen();
        await screen.findByText('Pond 01');

        fireEvent.press(screen.getByLabelText(/Include archived ponds/));

        expect(await screen.findByText('Pond 02')).toBeTruthy();
    });

    /**
     * The complaint was "it didn't show" — which, with a toggle that gives no
     * feedback, is indistinguishable from "there are none". The count on the
     * chip is what tells those two apart BEFORE the farmer presses anything.
     */
    it('names the archived count on the toggle before it is pressed', async () => {
        const screen = renderScreen();
        expect(await screen.findByLabelText('Include archived ponds (1)')).toBeTruthy();
    });

    it('keeps archived ponds out of the working pond table', async () => {
        const screen = renderScreen();
        await screen.findByText('Pond 01');
        expect(screen.queryByText('Pond 02')).toBeNull();
    });

    it('says the farm has none, rather than nothing at all, when there are none', async () => {
        mockedGetAll.mockResolvedValue({ data: { data: [ACTIVE] } });
        const screen = renderScreen();
        await screen.findByText('Pond 01');

        fireEvent.press(screen.getByLabelText('Include archived ponds'));

        expect(await screen.findByText('No archived ponds.')).toBeTruthy();
    });

    it('offers unarchive on the archived row and calls the API', async () => {
        const screen = renderScreen();
        await screen.findByText('Pond 01');
        fireEvent.press(screen.getByLabelText(/Include archived ponds/));
        await screen.findByText('Pond 02');

        fireEvent.press(screen.getByLabelText('Unarchive'));
        await waitFor(() => expect(mockedUnarchive).toHaveBeenCalledWith('p2'));
    });
});

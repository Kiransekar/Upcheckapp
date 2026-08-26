// W3 — `accountType` was a global owner/worker flag that gated exactly one
// endpoint (farm creation) and had no UI to change it after signup. Someone who
// picked "worker" and later leased a pond was stuck: the FAB, the header "+"
// and the empty-state action were all hidden, and the server 403'd anyway.
//
// Farm creation is open to every account now — the creator becomes that farm's
// owner in farm_members. This locks in that the entry points are always there,
// whatever the person answered at signup.
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../../../api/farms', () => ({
    farmsApi: { getAll: jest.fn() },
}));
jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useFocusEffect: (cb: any) => require('react').useEffect(cb, [cb]),
}));

import { FarmsListScreen } from '../FarmsListScreen';
import { farmsApi } from '../../../api/farms';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <FarmsListScreen navigation={navigation} />
        </SafeAreaProvider>,
    );

describe('FarmsListScreen — farm creation is open to every account', () => {
    beforeEach(() => jest.clearAllMocks());

    it('offers creating a farm from the empty state, and mentions joining one', async () => {
        (farmsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });

        const { getByText } = renderScreen();

        await waitFor(() => expect(getByText('Add Farm')).toBeTruthy());
        // The empty state nudges the other way too, rather than hiding the action
        // from anyone — mitigating junk farms in copy, not with a permanent flag.
        expect(
            getByText("Create your first farm, or join someone else's with their code."),
        ).toBeTruthy();
    });

    it('no longer shows the worker-only "ask an owner" dead end', async () => {
        (farmsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });

        const { queryByText } = renderScreen();

        await waitFor(() => expect(farmsApi.getAll).toHaveBeenCalled());
        expect(queryByText('Ask a farm owner to add you as a team member.')).toBeNull();
    });

    it('routes to CreateFarm from every entry point on an empty screen', async () => {
        (farmsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });

        const { getAllByText } = renderScreen();
        // Two, deliberately: the header action (artboard 4a) and the empty
        // state's own. Someone opening the app for the first time reads the
        // middle of the screen, not the chrome — and W3 is about the entry
        // points ALWAYS being there, so asserting both is the stronger check.
        await waitFor(() => expect(getAllByText('Add Farm')).toHaveLength(2));

        for (const button of getAllByText('Add Farm')) {
            navigation.navigate.mockClear();
            fireEvent.press(button);
            expect(navigation.navigate).toHaveBeenCalledWith('CreateFarm');
        }
    });
});

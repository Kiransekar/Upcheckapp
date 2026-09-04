// "Pond 1" tells a farmer nothing once they work two farms and have one in
// each. When the ponds span more than one farm, name the farm under the chip.
//
// Since §4.8 the chip row IS the shared PondPicker (with `fetchContext={false}`),
// so the caption is the picker's meta line and the full farm-grouped list is one
// "Change pond" tap away. Same promise, one component instead of two.
jest.mock('../../../api/ponds', () => ({ pondsApi: { getMine: jest.fn(), getById: jest.fn() } }));
jest.mock('../../../api/farms', () => ({ farmsApi: { getAll: jest.fn() } }));
jest.mock('@react-navigation/native', () => ({
    // `[effect]`, not `[]` — with an empty dep array only the callback captured
    // on the first render ever runs.
    useFocusEffect: (effect: any) => {
        const React = require('react');
        React.useEffect(effect, [effect]);
    },
}));

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QuickLogScreen } from '../QuickLogScreen';
import { pondsApi } from '../../../api/ponds';
import { farmsApi } from '../../../api/farms';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <QuickLogScreen navigation={navigation} />
        </SafeAreaProvider>,
    );

describe('QuickLogScreen — farm caption on pond chips', () => {
    beforeEach(() => jest.clearAllMocks());

    it('names the farm under each chip when the ponds span two farms', async () => {
        (pondsApi.getMine as jest.Mock).mockResolvedValue({
            data: [
                { id: 'p1', farmId: 'f1', name: 'NURS01', displayName: 'Nursery 1', status: 'active', activeCycleId: 'c1' },
                { id: 'p2', farmId: 'f2', name: 'NURS01', displayName: 'Nursery 1', status: 'active', activeCycleId: 'c2' },
            ],
        });
        (farmsApi.getAll as jest.Mock).mockResolvedValue({
            data: [
                { id: 'f1', name: 'Delta Farm' },
                { id: 'f2', name: 'Coastal Farm' },
            ],
        });

        const { getByText, getAllByText } = renderScreen();

        // The chosen pond's farm is named right under it…
        await waitFor(() => expect(getByText('Delta Farm')).toBeTruthy());

        // …and opening the picker groups the rest by farm too.
        fireEvent.press(getByText('Change'));
        await waitFor(() => expect(getByText('Coastal Farm')).toBeTruthy());
        expect(getAllByText('Delta Farm').length).toBeGreaterThan(0);
    });

    it('does not fetch farms when every pond is on the same farm', async () => {
        (pondsApi.getMine as jest.Mock).mockResolvedValue({
            data: [
                { id: 'p1', farmId: 'f1', name: 'NURS01', displayName: 'Nursery 1', status: 'active', activeCycleId: 'c1' },
                { id: 'p2', farmId: 'f1', name: 'NURS02', displayName: 'Nursery 2', status: 'active', activeCycleId: 'c2' },
            ],
        });

        const { findByText } = renderScreen();
        await findByText('Nursery 1');

        expect(farmsApi.getAll).not.toHaveBeenCalled();
    });
});

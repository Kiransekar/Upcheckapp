// Closing a cycle is irreversible bookkeeping. The screen already asked before
// this task; the question is now the shared confirm helper, so a cancel (and a
// dismiss) must still stop the close.
jest.mock('../../../api/crops', () => ({
    cropsApi: { getById: jest.fn(), close: jest.fn() },
}));
jest.mock('@react-navigation/native', () => ({
    // Mirror focus with a plain effect. `[effect]` — not `[]` — or the callback
    // captured on the first render is the only one that ever runs.
    useFocusEffect: (effect: any) => {
        const React = require('react');
        React.useEffect(effect, [effect]);
    },
}));

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CycleDetailScreen } from '../CycleDetailScreen';
import { cropsApi } from '../../../api/crops';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { goBack: jest.fn(), navigate: jest.fn() };
const route = { params: { cycleId: 'crop-1' } };

const CYCLE = {
    id: 'crop-1',
    pondId: 'pond-1',
    status: 'active',
    stockingDate: '2026-07-01',
    stockingCount: 100000,
    speciesType: 'Vannamei',
};

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <CycleDetailScreen route={route} navigation={navigation} />
        </SafeAreaProvider>,
    );

describe('CycleDetailScreen — confirm before closing a cycle', () => {
    afterEach(() => jest.restoreAllMocks());
    beforeEach(() => {
        jest.clearAllMocks();
        (cropsApi.getById as jest.Mock).mockResolvedValue({ data: CYCLE });
    });

    it('does not close the cycle when the confirmation is cancelled', async () => {
        const alert = jest
            .spyOn(Alert, 'alert')
            .mockImplementation((_t, _m, buttons) => buttons?.[0].onPress?.());

        const { findByText } = renderScreen();
        fireEvent.press(await findByText('Close Cycle'));

        await waitFor(() => expect(alert).toHaveBeenCalled());
        expect(cropsApi.close).not.toHaveBeenCalled();
    });

    it('closes once confirmed', async () => {
        (cropsApi.close as jest.Mock).mockResolvedValue({ data: {} });
        jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[1].onPress?.());

        const { findByText } = renderScreen();
        fireEvent.press(await findByText('Close Cycle'));

        await waitFor(() => expect(cropsApi.close).toHaveBeenCalledWith('crop-1'));
    });
});

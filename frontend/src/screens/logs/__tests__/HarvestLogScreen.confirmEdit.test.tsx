// Editing a harvest rewrites a money record — the weight and sale price on it
// feed the cycle's yield and P&L. Saving one must ask first, and cancelling
// must not reach the API.
jest.mock('../../../api/harvests', () => ({
    harvestsApi: { update: jest.fn(), create: jest.fn() },
}));
jest.mock('../../../sync/recordSync', () => ({
    saveRecord: jest.fn(),
    drainRecordQueue: jest.fn().mockResolvedValue(undefined),
}));

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HarvestLogScreen } from '../HarvestLogScreen';
import { harvestsApi } from '../../../api/harvests';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { goBack: jest.fn() };
const route = {
    params: {
        pondId: 'pond-1',
        pondName: 'Pond 1',
        cropId: 'crop-1',
        editRecord: {
            id: 'harvest-1',
            harvestDate: '2026-09-01',
            weightKg: 120,
            harvestType: 'partial',
        },
    },
};

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <HarvestLogScreen route={route} navigation={navigation} />
        </SafeAreaProvider>,
    );

describe('HarvestLogScreen — confirm before overwriting a harvest', () => {
    afterEach(() => jest.restoreAllMocks());
    beforeEach(() => jest.clearAllMocks());

    it('does not call the API when the confirmation is cancelled', async () => {
        const alert = jest
            .spyOn(Alert, 'alert')
            .mockImplementation((_t, _m, buttons) => buttons?.[0].onPress?.());

        const { getByText } = renderScreen();
        fireEvent.press(getByText('Update'));

        await waitFor(() => expect(alert).toHaveBeenCalled());
        expect(alert.mock.calls[0][0]).toBe('Save these changes?');
        expect(harvestsApi.update).not.toHaveBeenCalled();
    });

    it('saves once confirmed', async () => {
        (harvestsApi.update as jest.Mock).mockResolvedValue({ data: {} });
        jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[1].onPress?.());

        const { getByText } = renderScreen();
        fireEvent.press(getByText('Update'));

        await waitFor(() => expect(harvestsApi.update).toHaveBeenCalledWith('harvest-1', expect.anything()));
    });
});

// A pond's dimensions and name are read by stocking density, the feed plan and
// every per-m² figure in the app, so an edit asks before it overwrites. A
// cancelled confirmation must not PATCH.
jest.mock('../../../api/ponds', () => ({
    pondsApi: { getById: jest.fn(), update: jest.fn(), create: jest.fn() },
}));

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CreatePondScreen } from '../CreatePondScreen';
import { pondsApi } from '../../../api/ponds';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { goBack: jest.fn() };
const route = { params: { farmId: 'farm-1', farmName: 'Delta', editPondId: 'pond-1' } };

const POND = {
    id: 'pond-1',
    farmId: 'farm-1',
    name: 'NURS01',
    displayName: 'Nursery 1',
    geometryType: 'rectangular',
    constructionType: 'earthen',
    lengthM: 40,
    widthM: 20,
    depthM: 1.5,
    activeCycleId: null,
};

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <CreatePondScreen route={route} navigation={navigation} />
        </SafeAreaProvider>,
    );

describe('CreatePondScreen — confirm before saving an edit', () => {
    afterEach(() => jest.restoreAllMocks());
    beforeEach(() => {
        jest.clearAllMocks();
        (pondsApi.getById as jest.Mock).mockResolvedValue({ data: POND });
    });

    it('does not PATCH when the confirmation is cancelled', async () => {
        const alert = jest
            .spyOn(Alert, 'alert')
            .mockImplementation((_t, _m, buttons) => buttons?.[0].onPress?.());

        const { getByText, findByDisplayValue } = renderScreen();
        await findByDisplayValue('Nursery 1');

        fireEvent.press(getByText('Save'));

        await waitFor(() => expect(alert).toHaveBeenCalled());
        expect(alert.mock.calls[0][0]).toBe('Save these changes?');
        expect(pondsApi.update).not.toHaveBeenCalled();
    });

    it('PATCHes once confirmed', async () => {
        (pondsApi.update as jest.Mock).mockResolvedValue({ data: POND });
        jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[1].onPress?.());

        const { getByText, findByDisplayValue } = renderScreen();
        await findByDisplayValue('Nursery 1');

        fireEvent.press(getByText('Save'));

        await waitFor(() => expect(pondsApi.update).toHaveBeenCalledWith('pond-1', expect.anything()));
    });
});

/**
 * DO = 400 CRASHED THE APP.
 *
 * The backend rejects `dissolvedOxygen > 30` with a class-validator 400 whose
 * body is `{ message: string[] }`. This screen passed that value straight into
 * `Alert.alert(title, …)`, and a native alert given an ARRAY as its message
 * crashes the app on Android — a crash the root ErrorBoundary cannot catch,
 * because it happens in the native layer, not in React.
 *
 * The contract this pins is narrow and total: whatever the server sends back,
 * the second argument to Alert.alert is a STRING.
 */
jest.mock('../../../api/waterQuality', () => ({
    waterQualityApi: { getLatest: jest.fn() },
}));
jest.mock('../../../sync/recordSync', () => ({
    saveRecord: jest.fn(),
    // OfflineIndicator (rendered by every ScreenWrapper) also calls this on
    // reconnect — unrelated to what this test exercises, but must exist.
    drainRecordQueue: jest.fn().mockResolvedValue(undefined),
}));

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WaterQualityLogScreen } from '../WaterQualityLogScreen';
import { waterQualityApi } from '../../../api/waterQuality';
import { saveRecord } from '../../../sync/recordSync';

const mockedGetLatest = waterQualityApi.getLatest as jest.Mock;
const mockedSaveRecord = saveRecord as jest.Mock;

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { goBack: jest.fn() };
const route = { params: { pondId: 'pond-1', pondName: 'Pond 1' } };

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <WaterQualityLogScreen route={route} navigation={navigation} />
        </SafeAreaProvider>,
    );

describe('WaterQualityLogScreen — a validation 400 never reaches Alert.alert as an array', () => {
    let alertSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        mockedGetLatest.mockRejectedValue({ response: { status: 404 } });
        alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });

    afterEach(() => {
        alertSpy.mockRestore();
    });

    it('joins the class-validator message array into a string', async () => {
        mockedSaveRecord.mockRejectedValue({
            response: {
                status: 400,
                data: { message: ['dissolvedOxygen must not be greater than 30'] },
            },
        });

        const { getByText } = renderScreen();
        await waitFor(() => expect(mockedGetLatest).toHaveBeenCalledWith('pond-1'));

        fireEvent.press(getByText('Save Log'));

        await waitFor(() => expect(alertSpy).toHaveBeenCalled());

        const body = alertSpy.mock.calls[0][1];
        expect(typeof body).toBe('string');
        expect(body).toContain('dissolvedOxygen');
    });

    it('falls back to the screen message when the server sends no usable message', async () => {
        mockedSaveRecord.mockRejectedValue({ response: { status: 500, data: {} } });

        const { getByText } = renderScreen();
        await waitFor(() => expect(mockedGetLatest).toHaveBeenCalledWith('pond-1'));

        fireEvent.press(getByText('Save Log'));

        await waitFor(() => expect(alertSpy).toHaveBeenCalled());
        expect(typeof alertSpy.mock.calls[0][1]).toBe('string');
    });
});

// Quick-mode regression test (USER_PERSPECTIVE_PRODUCT_ANALYSIS §Part 2 row
// #2): the daily water-quality log used to show all 10 numeric fields at
// once. Now only pH/DO/temperature show by default, the rest are behind an
// "Add more readings" toggle, and slow-changing fields (salinity/alkalinity/
// hardness/transparency) are pre-filled from the farmer's last reading so
// they don't have to re-type the same number every visit.
//
// Since §4.6 the prefill reads `GET /water-quality/latest` (per COLUMN, with a
// `<field>AsOf` each) and applies the 12-hour rule per field: only a reading
// younger than 12 h is written in silently. `prefillCandidates` is the real
// implementation — mocking the rule out would leave this test asserting nothing.
jest.mock('../../../api/waterQuality', () => ({
    ...jest.requireActual('../../../api/waterQuality'),
    waterQualityApi: { getLatest: jest.fn(), getLatestPerColumn: jest.fn() },
}));
jest.mock('../../../sync/recordSync', () => ({
    saveRecord: jest.fn(),
    // OfflineIndicator (rendered by every ScreenWrapper) also calls this on
    // reconnect — unrelated to what this test exercises, but must exist.
    drainRecordQueue: jest.fn().mockResolvedValue(undefined),
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WaterQualityLogScreen } from '../WaterQualityLogScreen';
import { waterQualityApi } from '../../../api/waterQuality';
import { saveRecord } from '../../../sync/recordSync';

const mockedGetLatest = waterQualityApi.getLatestPerColumn as jest.Mock;
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const mockedSaveRecord = saveRecord as jest.Mock;

// See src/screens/inventory/__tests__/InventoryListScreen.test.tsx for why:
// react-native-safe-area-context's initialWindowMetrics is statically null
// outside a native runtime, so SafeAreaProvider needs explicit fake metrics.
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

describe('WaterQualityLogScreen — quick mode', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedSaveRecord.mockResolvedValue({ id: 'rec-1', queued: false });
    });

    it('shows only pH/DO/temperature by default; the rest are behind "Add more readings"', async () => {
        mockedGetLatest.mockRejectedValue({ response: { status: 404 } }); // brand-new pond, no prior reading

        const { getByText, queryByText } = renderScreen();
        await waitFor(() => expect(mockedGetLatest).toHaveBeenCalledWith('pond-1'));

        expect(getByText('pH')).toBeTruthy();
        expect(getByText('DO (mg/L)')).toBeTruthy();
        expect(getByText('Temperature (°C)')).toBeTruthy();
        // Collapsed by default — these must not be on screen yet.
        expect(queryByText('Salinity (ppt)')).toBeNull();
        expect(queryByText('Ammonia (mg/L)')).toBeNull();

        fireEvent.press(getByText('Add more readings'));

        expect(getByText('Salinity (ppt)')).toBeTruthy();
        expect(getByText('Ammonia (mg/L)')).toBeTruthy();
        expect(getByText('Show fewer readings')).toBeTruthy();
    });

    it('pre-fills slow-changing fields measured in the last 12 h and submits them even while collapsed', async () => {
        mockedGetLatest.mockResolvedValue({
            data: {
                salinity: 18, salinityAsOf: hoursAgo(2),
                alkalinity: 120, alkalinityAsOf: hoursAgo(3),
                hardness: 300, hardnessAsOf: hoursAgo(4),
                transparency: 35, transparencyAsOf: hoursAgo(5),
            },
        });

        const { getByText } = renderScreen();
        await waitFor(() => expect(mockedGetLatest).toHaveBeenCalledWith('pond-1'));

        // Save immediately without ever opening "Add more readings" — the
        // whole point of pre-filling is that the farmer doesn't have to.
        fireEvent.press(getByText('Save Log'));

        await waitFor(() =>
            expect(mockedSaveRecord).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({
                        salinity: 18,
                        alkalinity: 120,
                        hardness: 300,
                        transparency: 35,
                    }),
                }),
            ),
        );
    });

    it('offers a reading 12 h or older instead of filling it in, and warns about the ones it did fill in', async () => {
        mockedGetLatest.mockResolvedValue({
            data: {
                salinity: 18, salinityAsOf: hoursAgo(18),
                alkalinity: 120, alkalinityAsOf: hoursAgo(2),
            },
        });

        const { getByText } = renderScreen();
        await waitFor(() => expect(mockedGetLatest).toHaveBeenCalledWith('pond-1'));

        // Both must be reachable without expanding "Add more readings": an offer
        // or a warning the farmer never scrolls to is not an offer or a warning.
        expect(getByText('From your last reading')).toBeTruthy();
        expect(getByText('18 · 18 h ago')).toBeTruthy();
        expect(getByText('Check the carried-over values')).toBeTruthy();

        fireEvent.press(getByText('Save Log'));

        await waitFor(() =>
            expect(mockedSaveRecord).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({ salinity: undefined, alkalinity: 120 }),
                }),
            ),
        );
    });

    it('drops the warning once the carried-over values are confirmed', async () => {
        mockedGetLatest.mockResolvedValue({
            data: { alkalinity: 120, alkalinityAsOf: hoursAgo(2) },
        });

        const { getByText, queryByText } = renderScreen();
        await waitFor(() => expect(getByText('Check the carried-over values')).toBeTruthy());

        fireEvent.press(getByText('These values are still right'));

        expect(queryByText('Check the carried-over values')).toBeNull();
    });

    it('does not prefill and does not error when there is no prior reading (new pond, offline)', async () => {
        mockedGetLatest.mockRejectedValue({ message: 'Network Error' });

        const { getByText, getByLabelText } = renderScreen();
        await waitFor(() => expect(mockedGetLatest).toHaveBeenCalledWith('pond-1'));

        // A log must carry at least one reading (L2), so Save is disabled on a
        // blank form. These tests are about what happens AFTER a save is
        // attempted, so they enter one value to get there.
        fireEvent.changeText(getByLabelText('pH'), '7.8');
        fireEvent.press(getByText('Save Log'));

        await waitFor(() =>
            expect(mockedSaveRecord).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({
                        salinity: undefined,
                        alkalinity: undefined,
                        hardness: undefined,
                        transparency: undefined,
                    }),
                }),
            ),
        );
    });
});

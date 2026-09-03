/**
 * "Weekly chemistry history" (#9).
 *
 * The weekly panel writes ammonia, nitrite, nitrate, alkalinity, hardness and
 * transparency into `water_quality_records`. This card rendered a fixed four
 * columns — pH, DO, temp, salinity — so that record showed up as `-- -- -- --`:
 * the farmer's own reading, on screen, as four dashes.
 */
jest.mock('../../../../api/waterQuality', () => ({ waterQualityApi: { getAll: jest.fn(), remove: jest.fn() } }));
jest.mock('../../../../api/crops', () => ({ cropsApi: { getById: jest.fn() } }));
jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useFocusEffect: (effect: () => void | (() => void)) => {
            const React = require('react');
            React.useEffect(effect, [effect]);
        },
    };
});

import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { WaterQualityHistoryScreen } from '../WaterQualityHistoryScreen';
import { waterQualityApi } from '../../../../api/waterQuality';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <WaterQualityHistoryScreen
                navigation={navigation}
                route={{ params: { pondId: 'p1', pondName: 'Pond 1' } }}
            />
        </SafeAreaProvider>,
    );

beforeEach(() => {
    jest.clearAllMocks();
});

it('renders a chemistry-only record as its own values, not as dashes', async () => {
    (waterQualityApi.getAll as jest.Mock).mockResolvedValue({
        data: [
            {
                id: 'w1',
                pondId: 'p1',
                ammonia: 0.12,
                nitrite: 0.4,
                nitrate: 15,
                alkalinity: 120,
                hardness: 3200,
                transparency: 35,
                recordedAt: '2026-09-01T06:00:00.000Z',
            },
        ],
    });

    const { findByText, queryByText } = renderScreen();

    await findByText('Weekly chemistry');
    // The values themselves — the labels also appear in the compare chips above.
    expect(await findByText('0.12')).toBeTruthy();
    expect(await findByText('3200')).toBeTruthy();
    // Hardness has no chip, so this label can only be the card's.
    expect(await findByText('Hardness')).toBeTruthy();
    // The four daily columns are simply absent, rather than four placeholders.
    expect(queryByText('--')).toBeNull();
});

it('leaves a daily reading alone and does not tag it as chemistry', async () => {
    (waterQualityApi.getAll as jest.Mock).mockResolvedValue({
        data: [
            {
                id: 'w2',
                pondId: 'p1',
                ph: 8.1,
                dissolvedOxygen: 5.2,
                temperature: 29,
                salinity: 18,
                recordedAt: '2026-09-02T06:00:00.000Z',
            },
        ],
    });

    const { findAllByText, queryByText } = renderScreen();

    // More than one: the card's value and the chart's axis label.
    expect(await findAllByText('8.1')).not.toHaveLength(0);
    expect(queryByText('Weekly chemistry')).toBeNull();
    expect(queryByText('Hardness')).toBeNull();
});

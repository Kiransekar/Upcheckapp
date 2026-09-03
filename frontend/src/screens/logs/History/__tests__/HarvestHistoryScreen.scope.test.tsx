/**
 * Harvest history is ONE pond's history.
 *
 * It used to be two different bugs wearing the same screen: with a cropId it
 * showed a single cycle, so a pond's run of harvests across successive cycles
 * could not be seen at all; with neither id it called `getAll()` and drew every
 * harvest on every farm the user can reach under this pond's title, summing
 * other ponds' tonnage into "total harvested".
 */
jest.mock('../../../../api/harvests', () => ({
    harvestsApi: { getAll: jest.fn(), getByCrop: jest.fn(), getByPond: jest.fn() },
}));
// useFocusEffect needs a NavigationContainer the plain SafeAreaProvider
// wrapper below doesn't provide.
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

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HarvestHistoryScreen } from '../HarvestHistoryScreen';
import { harvestsApi } from '../../../../api/harvests';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

const renderWith = (params: any) =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <HarvestHistoryScreen route={{ params }} navigation={navigation} />
        </SafeAreaProvider>,
    );

const harvest = (id: string, date: string, weightKg: number) => ({
    id,
    cropId: 'c-' + id,
    harvestDate: date,
    weightKg,
    harvestType: 'partial',
    status: 'sold',
    createdAt: date,
    updatedAt: date,
});

beforeEach(() => {
    jest.clearAllMocks();
    (harvestsApi.getByPond as jest.Mock).mockResolvedValue({ data: [] });
    (harvestsApi.getByCrop as jest.Mock).mockResolvedValue({ data: [] });
    (harvestsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
});

it('asks for the POND when it has one, so successive cycles list together', async () => {
    (harvestsApi.getByPond as jest.Mock).mockResolvedValue({
        data: [harvest('h1', '2026-01-10', 400), harvest('h2', '2026-06-02', 900)],
    });

    const { findByText } = renderWith({ pondId: 'p1', pondName: 'Pond 1', cropId: 'c1' });

    await waitFor(() => expect(harvestsApi.getByPond).toHaveBeenCalledWith('p1'));
    expect(harvestsApi.getByCrop).not.toHaveBeenCalled();
    expect(harvestsApi.getAll).not.toHaveBeenCalled();
    // Newest first, both cycles present.
    await findByText(new Date('2026-06-02').toLocaleDateString());
    await findByText(new Date('2026-01-10').toLocaleDateString());
});

it('falls back to the crop when there is no pond', async () => {
    renderWith({ cropId: 'c1' });
    await waitFor(() => expect(harvestsApi.getByCrop).toHaveBeenCalledWith('c1'));
    expect(harvestsApi.getAll).not.toHaveBeenCalled();
});

it('shows nothing rather than every farm when it has no scope at all', async () => {
    const { findByText } = renderWith({});
    await findByText('No Harvests Yet');
    expect(harvestsApi.getAll).not.toHaveBeenCalled();
});

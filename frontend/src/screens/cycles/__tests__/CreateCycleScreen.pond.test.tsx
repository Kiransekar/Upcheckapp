/**
 * "I clicked start cycle in the today page and it took me to start a cycle
 * pond and i dont even know which pond is that for and cant change, it didnt
 * ask me also."
 *
 * The screen took a `pondId` and then never mentioned it again: no header, no
 * pond name, no back button, and no way to switch. Arriving from the Today
 * hero it was survivable only if you remembered what the card said; arriving
 * any other way you were filling in a stocking form — species, seed grade,
 * stocking count, targets — for a pond the app would not name.
 *
 * It got worse when the hero learned to point at the first UNSTOCKED pond
 * rather than simply the first one: the pond it picks is now less likely to be
 * the one the farmer had in mind, so naming it matters more.
 */
jest.mock('../../../api/crops', () => ({
    cropsApi: { getAll: jest.fn(), create: jest.fn() },
}));
jest.mock('../../../api/ponds', () => ({
    pondsApi: { getById: jest.fn(), getAll: jest.fn() },
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CreateCycleScreen } from '../CreateCycleScreen';
import { cropsApi } from '../../../api/crops';
import { pondsApi } from '../../../api/ponds';

const mockedCropsGetAll = cropsApi.getAll as jest.Mock;
const mockedGetById = pondsApi.getById as jest.Mock;
const mockedPondsGetAll = pondsApi.getAll as jest.Mock;

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

const P1 = { id: 'p1', farmId: 'farm-1', name: 'P1', displayName: 'North pond', activeCycleId: null };
const P2 = { id: 'p2', farmId: 'farm-1', name: 'P2', displayName: 'South pond', activeCycleId: null };
/** Mid-cycle: cannot take a second one, so it must not be offered. */
const P3 = { id: 'p3', farmId: 'farm-1', name: 'P3', displayName: 'Busy pond', activeCycleId: 'c9' };

const renderScreen = (pondId = 'p1') =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <CreateCycleScreen navigation={navigation} route={{ params: { pondId } }} />
        </SafeAreaProvider>,
    );

beforeEach(() => {
    jest.clearAllMocks();
    mockedCropsGetAll.mockResolvedValue({ data: [] });
    mockedGetById.mockResolvedValue({ data: P1 });
    mockedPondsGetAll.mockResolvedValue({ data: [P1, P2, P3] });
});

describe('CreateCycleScreen — which pond', () => {
    it('names the pond it is about', async () => {
        const { findAllByText } = renderScreen();

        // The header names it; the picker's value repeats it. Either is fine —
        // what matters is that the pond is on screen at all, which it was not.
        expect((await findAllByText('North pond')).length).toBeGreaterThan(0);
    });

    it('offers the farm’s other free ponds so the choice can be corrected', async () => {
        const { findAllByText, getByText, getByLabelText } = renderScreen();
        await findAllByText('North pond');

        // The picker names the current pond; opening it lists the alternatives.
        fireEvent.press(getByLabelText('Pond'));

        await waitFor(() => expect(getByText('South pond')).toBeTruthy());
    });

    it('does not offer a pond that is already mid-cycle', async () => {
        const { findAllByText, getByText, getByLabelText, queryByText } = renderScreen();
        await findAllByText('North pond');

        fireEvent.press(getByLabelText('Pond'));

        // Offering it would be a choice that only fails on save.
        await waitFor(() => expect(getByText('South pond')).toBeTruthy());
        expect(queryByText('Busy pond')).toBeNull();
    });

    it('creates the cycle on the pond the farmer switched TO, not the one passed in', async () => {
        const { findAllByText, getByText, getByLabelText } = renderScreen();
        await findAllByText('North pond');

        fireEvent.press(getByLabelText('Pond'));
        await waitFor(() => expect(getByText('South pond')).toBeTruthy());
        fireEvent.press(getByText('South pond'));

        // The name prefill re-runs against the newly chosen pond, which is the
        // observable proof the switch reached the rest of the screen — and what
        // the create call will use.
        await waitFor(() => expect(mockedCropsGetAll).toHaveBeenCalledWith('p2'));
    });

    /**
     * There was no header at all, so the only way out was the Android back
     * gesture — on a form with a dozen fields and no title.
     */
    it('has a way back', async () => {
        const { findByLabelText } = renderScreen();

        fireEvent.press(await findByLabelText('Back'));

        expect(navigation.goBack).toHaveBeenCalled();
    });

    it('hides the picker when there is nothing to choose between', async () => {
        mockedPondsGetAll.mockResolvedValue({ data: [P1] });

        const { findAllByText, queryByLabelText } = renderScreen();
        await findAllByText('North pond');

        // A dropdown with one entry is noise on an already-long form; the
        // header names the pond regardless.
        await waitFor(() => expect(queryByLabelText('Pond')).toBeNull());
    });

    it('still renders when the farm cannot be read', async () => {
        mockedGetById.mockRejectedValue(new Error('offline'));

        const { findAllByText } = renderScreen();

        // Degrades to the old behaviour — no switch — rather than a blank screen.
        expect((await findAllByText('Start Production Cycle')).length).toBeGreaterThan(0);
    });
});

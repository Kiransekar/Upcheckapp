/**
 * L3 — the multi-pond grid, the retention bet.
 *
 * Quick mode cut each form from ten fields to three. Nobody cut the number of
 * FORMS. A four-pond farmer doing the morning round walked QuickLog → picker →
 * tile → form → save → back, four times — about 35–40 interactions — then again
 * in the evening. That is where paper still wins, and not on field count: one
 * notebook page holds every pond in a single pass.
 *
 * The rules that make the data honest are what these tests pin, because they
 * are the ones a grid makes tempting to drop.
 */
jest.mock('../../../api/ponds', () => ({
    pondsApi: { getMine: jest.fn() },
}));
jest.mock('../../../sync/recordSync', () => ({
    saveRecord: jest.fn(),
    drainRecordQueue: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useFocusEffect: (effect: () => void) => {
            const React = require('react');
            React.useEffect(effect, [effect]);
        },
    };
});

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MorningRoundsScreen } from '../MorningRoundsScreen';
import { pondsApi } from '../../../api/ponds';
import { saveRecord } from '../../../sync/recordSync';
import { qk, queryClient } from '../../../query/client';
import { useUIStore } from '../../../store/uiStore';

const mockedSave = saveRecord as jest.Mock;

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

const P1 = { id: 'p1', farmId: 'f1', name: 'P1', displayName: 'North pond', activeCycleId: 'c1' };
const P2 = { id: 'p2', farmId: 'f1', name: 'P2', displayName: 'South pond', activeCycleId: 'c2' };
const P3 = { id: 'p3', farmId: 'f1', name: 'P3', displayName: 'East pond', activeCycleId: 'c3' };

const renderScreen = () => {
    queryClient.clear();
    queryClient.setQueryData(qk.ponds(), [P1, P2, P3]);
    return render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <MorningRoundsScreen navigation={navigation} />
        </SafeAreaProvider>,
    );
};

beforeEach(() => {
    jest.clearAllMocks();
    (pondsApi.getMine as jest.Mock).mockResolvedValue({ data: [P1, P2, P3] });
    mockedSave.mockResolvedValue({ id: 'r1', queued: false });
});

describe('MorningRoundsScreen', () => {
    it('lists every pond as its own row', async () => {
        const { findByTestId } = renderScreen();

        expect(await findByTestId('rounds-row-p1')).toBeTruthy();
        expect(await findByTestId('rounds-row-p2')).toBeTruthy();
        expect(await findByTestId('rounds-row-p3')).toBeTruthy();
    });

    /**
     * THE RULE THAT MATTERS MOST (L2). A pond the farmer did not measure must
     * not become a record — otherwise walking this screen would mark every
     * pond as logged, stop their reminders and hold a green streak on data
     * nobody collected. That is the exact failure L2 exists to close, and a
     * grid is the easiest place to reintroduce it.
     */
    it('writes only the ponds that were filled in, never the blank ones', async () => {
        const { findByTestId, getByText } = renderScreen();
        fireEvent.changeText(await findByTestId('rounds-ph-p2'), '7.9');

        fireEvent.press(getByText('Save 1 ponds'));

        await waitFor(() => expect(mockedSave).toHaveBeenCalledTimes(1));
        expect(mockedSave.mock.calls[0][0].payload).toMatchObject({ pondId: 'p2', ph: 7.9 });
    });

    it('writes one record per filled pond, through the ordinary offline queue', async () => {
        const { findByTestId, getByText } = renderScreen();
        fireEvent.changeText(await findByTestId('rounds-ph-p1'), '7.5');
        fireEvent.changeText(await findByTestId('rounds-dissolvedOxygen-p1'), '5.2');
        fireEvent.changeText(await findByTestId('rounds-ph-p3'), '8.1');

        fireEvent.press(getByText('Save 2 ponds'));

        await waitFor(() => expect(mockedSave).toHaveBeenCalledTimes(2));
        // No batch endpoint: N queued records is the right shape for someone
        // who may lose signal between pond two and pond three.
        for (const call of mockedSave.mock.calls) {
            expect(call[0].endpoint).toBe('/water-quality');
            expect(call[0].entity).toBe('water_quality');
        }
        expect(mockedSave.mock.calls[0][0].payload).toMatchObject({
            pondId: 'p1',
            ph: 7.5,
            dissolvedOxygen: 5.2,
        });
    });

    /** Stamped at press time, not drain time — same lesson as the check-in fix. */
    it('records the time the farmer pressed save, not the time it syncs', async () => {
        const { findByTestId, getByText } = renderScreen();
        fireEvent.changeText(await findByTestId('rounds-ph-p1'), '7.5');

        fireEvent.press(getByText('Save 1 ponds'));

        await waitFor(() => expect(mockedSave).toHaveBeenCalled());
        const at = mockedSave.mock.calls[0][0].payload.recordedAt;
        expect(Number.isNaN(Date.parse(at))).toBe(false);
        expect(Math.abs(Date.parse(at) - Date.now())).toBeLessThan(60_000);
    });

    it('cannot be saved with nothing entered at all', async () => {
        const { findByText, getByText } = renderScreen();
        await findByText('North pond');

        fireEvent.press(getByText('Save'));

        expect(mockedSave).not.toHaveBeenCalled();
    });

    /**
     * PARTIAL FAILURE IS THE WHOLE POINT OF STAYING PUT. `PondNamesScreen`
     * toasts a count and resets to Home with no retry path; repeating that here
     * would throw away a morning's readings for the ponds that failed.
     */
    it('keeps the failed ponds on screen with their readings intact', async () => {
        mockedSave
            .mockResolvedValueOnce({ id: 'r1', queued: false })
            .mockRejectedValueOnce(new Error('boom'));
        const toasts: any[] = [];
        useUIStore.setState({ showToast: (t: any) => { toasts.push(t); } } as any);

        const { findByTestId, getByText, getByTestId } = renderScreen();
        fireEvent.changeText(await findByTestId('rounds-ph-p1'), '7.5');
        fireEvent.changeText(await findByTestId('rounds-ph-p2'), '8.2');

        fireEvent.press(getByText('Save 2 ponds'));

        await waitFor(() => expect(toasts.at(-1)?.type).toBe('error'));
        // Still here, still typed, and the one that worked is cleared.
        expect(getByTestId('rounds-ph-p2').props.value).toBe('8.2');
        expect(getByTestId('rounds-ph-p1').props.value).toBe('');
        expect(navigation.goBack).not.toHaveBeenCalled();
    });

    it('goes back only when everything landed', async () => {
        const { findByTestId, getByText } = renderScreen();
        fireEvent.changeText(await findByTestId('rounds-ph-p1'), '7.5');

        fireEvent.press(getByText('Save 1 ponds'));

        await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    });
});

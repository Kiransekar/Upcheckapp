// Artboard 06. Two things here can go wrong quietly and expensively:
//
//  1. The name preview disagreeing with what the server actually generates —
//     the farmer approves "P1…P4" and finds something else in their farm.
//  2. The write order. The farm is created first and the ponds after, so a
//     pond failure is PARTIAL: the farm exists. Unwinding it, or reporting
//     "couldn't create the farm", would both be lies, and a farmer who then
//     retries ends up with two farms.
jest.mock('../../../api/farms', () => ({ farmsApi: { create: jest.fn() } }));
jest.mock('../../../api/ponds', () => ({ pondsApi: { create: jest.fn() } }));
jest.mock('../../../store/membershipStore', () => ({
    useMembershipStore: Object.assign(
        jest.fn((sel: any) => sel({ load: jest.fn().mockResolvedValue(undefined) })),
        { setState: jest.fn(), getState: jest.fn() },
    ),
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PondNamesScreen, pondNames, isValidPrefix } from '../PondNamesScreen';
import { farmsApi } from '../../../api/farms';
import { pondsApi } from '../../../api/ponds';
import { useAuthStore } from '../../../store/authStore';
import { useUIStore } from '../../../store/uiStore';

const mockedCreateFarm = farmsApi.create as jest.Mock;
const mockedCreatePond = pondsApi.create as jest.Mock;

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { reset: jest.fn(), goBack: jest.fn() };
const route = { params: { farm: { name: 'Kakinada East' }, pondCount: 3 } };

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <PondNamesScreen navigation={navigation} route={route} />
        </SafeAreaProvider>,
    );

describe('pondNames', () => {
    it('numbers from 1 and upper-cases the prefix, matching the server', () => {
        expect(pondNames('p', 4)).toEqual(['P1', 'P2', 'P3', 'P4']);
    });

    it('yields nothing for an unusable prefix, so the preview cannot lie', () => {
        expect(pondNames('', 4)).toEqual([]);
        expect(pondNames('TOOLONG', 4)).toEqual([]);
        expect(pondNames('P-1', 4)).toEqual([]);
    });

    it('yields nothing for a zero count', () => {
        expect(pondNames('P', 0)).toEqual([]);
    });
});

describe('isValidPrefix — the server allows 1 to 4 alphanumerics', () => {
    it.each(['P', 'AB', 'A12', 'ABCD', '1'])('accepts %s', (p) => {
        expect(isValidPrefix(p)).toBe(true);
    });
    it.each(['', 'ABCDE', 'A B', 'A-1'])('rejects "%s"', (p) => {
        expect(isValidPrefix(p)).toBe(false);
    });
});

describe('PondNamesScreen — artboard 06', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAuthStore.setState({ pendingFarmSetup: true } as any);
        mockedCreateFarm.mockResolvedValue({ data: { id: 'farm-1' } });
        mockedCreatePond.mockResolvedValue({ data: {} });
    });

    it('offers one editable name per pond, pre-filled', () => {
        const { getByTestId, queryByTestId } = renderScreen();
        expect(getByTestId('pond-name-0').props.value).toBe('P1');
        expect(getByTestId('pond-name-1').props.value).toBe('P2');
        expect(getByTestId('pond-name-2').props.value).toBe('P3');
        // Three ponds were declared, so there is no fourth.
        expect(queryByTestId('pond-name-3')).toBeNull();
    });

    /**
     * The reported problem. Ponds were created with a PREFIX and no
     * `displayName` at all, so every farm in the app was P1, P2, P3 — a farmer
     * with two farms had two P1s with nothing between them — and the only route
     * to a real name was an edit form they never found.
     */
    it('sends what the farmer typed as the pond name', async () => {
        const utils = renderScreen();
        fireEvent.changeText(utils.getByTestId('pond-name-0'), 'North pond');
        fireEvent.changeText(utils.getByLabelText('Depth (m)'), '1.2');
        fireEvent.press(utils.getByText('Create farm'));

        await waitFor(() => expect(mockedCreatePond).toHaveBeenCalledTimes(3));
        expect(mockedCreatePond).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ displayName: 'North pond' }),
        );
        // The pond code the server needs is DERIVED, never asked for.
        expect(mockedCreatePond.mock.calls[0][0].namePrefix).toBe('NORT');
        // A pond the farmer left alone still gets its pre-filled name.
        expect(mockedCreatePond).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ displayName: 'P2', namePrefix: 'P2' }),
        );
    });

    it('will not create a pond with a blank name', async () => {
        const utils = renderScreen();
        fireEvent.changeText(utils.getByTestId('pond-name-1'), '   ');
        fireEvent.changeText(utils.getByLabelText('Depth (m)'), '1.2');
        fireEvent.press(utils.getByText('Create farm'));

        await waitFor(() => expect(utils.getByText('Give every pond a name')).toBeTruthy());
        expect(mockedCreateFarm).not.toHaveBeenCalled();
    });

    /**
     * Onboarding fills in shape, construction and area without asking. That is
     * the right trade — measurements in front of someone who has not seen the
     * app yet is how you lose them — but the result used to be
     * indistinguishable from an answer the farmer gave, and volume, aeration
     * adequacy and every dosing figure downstream read those numbers.
     *
     * So what the app chose is RECORDED as assumed, and the pond page says so.
     */
    describe('assumed measurements', () => {
        it('marks the defaults it filled in without asking', async () => {
            const utils = renderScreen();
            fireEvent.changeText(utils.getByLabelText('Depth (m)'), '1.2');
            fireEvent.press(utils.getByText('Create farm'));

            await waitFor(() => expect(mockedCreatePond).toHaveBeenCalledTimes(3));
            expect(mockedCreatePond.mock.calls[0][0].assumedFields).toEqual([
                'geometryType',
                'constructionType',
                'areaM2',
            ]);
        });

        it('stops marking shape and construction once the farmer answers them', async () => {
            const utils = renderScreen();
            fireEvent.press(utils.getByTestId('more-details-toggle'));
            fireEvent.press(utils.getByTestId('construction-lined'));
            fireEvent.changeText(utils.getByLabelText('Depth (m)'), '1.2');
            fireEvent.press(utils.getByText('Create farm'));

            await waitFor(() => expect(mockedCreatePond).toHaveBeenCalledTimes(3));
            const sent = mockedCreatePond.mock.calls[0][0];
            expect(sent.constructionType).toBe('lined');
            // Area is still a guess — nothing here measured it.
            expect(sent.assumedFields).toEqual(['areaM2']);
        });

        it('stops marking area once a real one is typed', async () => {
            const utils = renderScreen();
            fireEvent.changeText(utils.getByLabelText('Depth (m)'), '1.2');
            fireEvent.changeText(utils.getByLabelText('P1 — area m²'), '4200');
            fireEvent.press(utils.getByText('Create farm'));

            await waitFor(() => expect(mockedCreatePond).toHaveBeenCalledTimes(3));
            expect(mockedCreatePond.mock.calls[0][0].assumedFields).not.toContain('areaM2');
            // The pond beside it was NOT measured, and still says so.
            expect(mockedCreatePond.mock.calls[1][0].assumedFields).toContain('areaM2');
        });
    });

    it('creates the farm first, then one pond per declared pond', async () => {
        const utils = renderScreen();
        fireEvent.changeText(utils.getByLabelText('Depth (m)'), '1.2');
        fireEvent.press(utils.getByText('Create farm'));

        await waitFor(() => expect(mockedCreatePond).toHaveBeenCalledTimes(3));
        expect(mockedCreateFarm).toHaveBeenCalledWith({ name: 'Kakinada East' });
        expect(mockedCreatePond).toHaveBeenCalledWith(
            expect.objectContaining({ farmId: 'farm-1', depthM: 1.2 }),
        );
        await waitFor(() =>
            expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'MainApp' }] }),
        );
        expect(useAuthStore.getState().pendingFarmSetup).toBe(false);
    });

    it('refuses to write anything until a usable depth is given', async () => {
        const utils = renderScreen();
        fireEvent.press(utils.getByText('Create farm'));

        await waitFor(() => expect(utils.getByText('Depth must be 0.5–5.0 m')).toBeTruthy());
        expect(mockedCreateFarm).not.toHaveBeenCalled();
    });

    it('rejects a depth outside the range the server accepts', async () => {
        const utils = renderScreen();
        fireEvent.changeText(utils.getByLabelText('Depth (m)'), '9');
        fireEvent.press(utils.getByText('Create farm'));

        await waitFor(() => expect(utils.getByText('Depth must be 0.5–5.0 m')).toBeTruthy());
        expect(mockedCreateFarm).not.toHaveBeenCalled();
    });

    it('drops an area below the server minimum rather than sending a rejected one', async () => {
        const utils = renderScreen();
        fireEvent.changeText(utils.getByLabelText('Depth (m)'), '1.2');
        fireEvent.changeText(utils.getByLabelText('P1 — area m²'), '0.4');
        fireEvent.press(utils.getByText('Create farm'));

        await waitFor(() => expect(mockedCreatePond).toHaveBeenCalledTimes(3));
        expect(mockedCreatePond).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ overrideAreaM2: undefined }),
        );
    });

    it('sends a usable area through for the pond it was typed against', async () => {
        const utils = renderScreen();
        fireEvent.changeText(utils.getByLabelText('Depth (m)'), '1.2');
        fireEvent.changeText(utils.getByLabelText('P2 — area m²'), '4200');
        fireEvent.press(utils.getByText('Create farm'));

        await waitFor(() => expect(mockedCreatePond).toHaveBeenCalledTimes(3));
        expect(mockedCreatePond).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ overrideAreaM2: 4200 }),
        );
        expect(mockedCreatePond).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ overrideAreaM2: undefined }),
        );
    });

    it('keeps the farm and says how many ponds failed, rather than claiming nothing happened', async () => {
        const toasts: any[] = [];
        useUIStore.setState({ showToast: (tst: any) => { toasts.push(tst); } } as any);
        mockedCreatePond
            .mockResolvedValueOnce({ data: {} })
            .mockRejectedValueOnce(new Error('boom'))
            .mockRejectedValueOnce(new Error('boom'));

        const utils = renderScreen();
        fireEvent.changeText(utils.getByLabelText('Depth (m)'), '1.2');
        fireEvent.press(utils.getByText('Create farm'));

        await waitFor(() =>
            expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'MainApp' }] }),
        );
        expect(toasts.at(-1)).toEqual(
            expect.objectContaining({
                type: 'error',
                message: expect.stringContaining('2 pond(s) could not be added'),
            }),
        );
        // The farm was created once and is NOT retried or rolled back.
        expect(mockedCreateFarm).toHaveBeenCalledTimes(1);
    });
});

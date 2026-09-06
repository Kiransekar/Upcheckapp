// Artboard 07, plus the error and expired states artboard 10 specifies for it.
//
// The state split is the part with teeth: a code that never existed is a typo
// worth retyping, while a code that has expired, been revoked or been used up
// will never work no matter how carefully it is re-entered. Showing the same
// "check it and try again" for both sends the worker round in circles.
jest.mock('../../../api/farmMembers', () => {
    const actual = jest.requireActual('../../../api/farmMembers');
    return { ...actual, farmMembersApi: { joinFarm: jest.fn() } };
});
jest.mock('../../../store/membershipStore', () => ({
    useMembershipStore: Object.assign(
        jest.fn((sel: any) => sel({ load: jest.fn() })),
        { setState: jest.fn(), getState: jest.fn() },
    ),
}));
// expo-camera has no JS implementation under jest-expo's node environment.
jest.mock('expo-camera', () => {
    const { View } = require('react-native');
    return {
        CameraView: (props: any) => <View testID="camera" {...props} />,
        useCameraPermissions: () => [{ granted: true }, jest.fn()],
    };
});

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { JoinFarmScreen } from '../JoinFarmScreen';
import { farmMembersApi } from '../../../api/farmMembers';
import { useAuthStore } from '../../../store/authStore';

const mockedJoinFarm = farmMembersApi.joinFarm as jest.Mock;

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { reset: jest.fn(), replace: jest.fn(), goBack: jest.fn() };

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <JoinFarmScreen navigation={navigation} />
        </SafeAreaProvider>,
    );

/** How the server reports a code it recognised but will not honour. */
const rejection = (reason: string, farmName?: string) => ({
    response: { status: 400, data: { reason, message: 'nope', farmName } },
});

describe('JoinFarmScreen — artboard 07', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAuthStore.setState({ pendingFarmJoin: true } as any);
    });

    it('normalises the typed code and hands the worker to the confirmation', async () => {
        mockedJoinFarm.mockResolvedValue({
            data: {
                farmId: 'farm-1',
                role: 'worker',
                status: 'active',
                farm: { id: 'farm-1', name: "Ravi's Farm" },
            },
        });

        const { getByLabelText, getByText } = renderScreen();
        fireEvent.changeText(getByLabelText('Farm code'), 'abcd2345');
        fireEvent.press(getByText('Join farm'));

        await waitFor(() => expect(mockedJoinFarm).toHaveBeenCalledWith('ABCD2345'));
        await waitFor(() =>
            expect(navigation.replace).toHaveBeenCalledWith('JoinedFarm', {
                farmName: "Ravi's Farm",
                role: 'worker',
                status: 'active',
            }),
        );
        expect(useAuthStore.getState().pendingFarmJoin).toBe(false);
    });

    it('passes a pending join through as pending rather than as a success', async () => {
        mockedJoinFarm.mockResolvedValue({
            data: {
                farmId: 'farm-1',
                role: 'worker',
                status: 'pending',
                farm: { id: 'farm-1', name: 'Kakinada East' },
            },
        });

        const { getByLabelText, getByText } = renderScreen();
        fireEvent.changeText(getByLabelText('Farm code'), 'ABCD2345');
        fireEvent.press(getByText('Join farm'));

        await waitFor(() =>
            expect(navigation.replace).toHaveBeenCalledWith(
                'JoinedFarm',
                expect.objectContaining({ status: 'pending' }),
            ),
        );
    });

    it('treats an unknown code as a typo worth retrying', async () => {
        mockedJoinFarm.mockRejectedValue(rejection('not_found'));

        const { getByLabelText, getByText } = renderScreen();
        fireEvent.changeText(getByLabelText('Farm code'), 'ABCD2345');
        fireEvent.press(getByText('Join farm'));

        await waitFor(() =>
            expect(
                getByText('Could not join with that code. Check it and try again.'),
            ).toBeTruthy(),
        );
        expect(navigation.replace).not.toHaveBeenCalled();
    });

    it.each([
        ['expired', 'That invite has expired. Ask the farm owner for a new code.'],
        ['revoked', 'That invite has been revoked. Ask the farm owner for a new code.'],
        ['exhausted', 'That invite has already been used. Ask the farm owner for a new code.'],
    ])('points a %s code at the farm owner instead of at the worker', async (reason, copy) => {
        mockedJoinFarm.mockRejectedValue(rejection(reason));

        const { getByLabelText, getByText, queryByText } = renderScreen();
        fireEvent.changeText(getByLabelText('Farm code'), 'ABCD2345');
        fireEvent.press(getByText('Join farm'));

        await waitFor(() => expect(getByText(copy)).toBeTruthy());
        // Never the retype-it message — retyping a dead code cannot help.
        expect(
            queryByText('Could not join with that code. Check it and try again.'),
        ).toBeNull();
    });

    /**
     * W1 — THE LARGEST ACTIVATION LEAK IN THE PRODUCT, and it lived here.
     *
     * A worker redeemed a valid code, landed `pending` under manual approval,
     * saw Home's brand-new-user state ("No farms yet — create or join"), and
     * did the only sensible thing: re-entered the code. The server answered
     * correctly, "you have already asked to join this farm" — but
     * `already_pending` was not one of the four values in `InviteRejection`,
     * so `inviteRejectionOf()` returned null and this screen fell through to
     * its TYPO branch. Red boxes. "Check the code and try again."
     *
     * The worker concluded the code was wrong and asked for a new one. The new
     * code produced the identical error. The loop ended only when an owner
     * happened to open the app. Workers outnumber owners on every farm.
     */
    it('tells a waiting worker to WAIT, not that their correct code is wrong', async () => {
        mockedJoinFarm.mockRejectedValue(rejection('already_pending', 'Kakinada East'));

        const { getByLabelText, getByText, queryByText, getByTestId } = renderScreen();
        fireEvent.changeText(getByLabelText('Farm code'), 'ABCD2345');
        fireEvent.press(getByText('Join farm'));

        await waitFor(() => expect(getByTestId('join-waiting')).toBeTruthy());
        expect(getByText(/waiting for the owner to let you in/i)).toBeTruthy();
        // The two things that sent them round in circles: being told it was
        // their mistake, and being told to fetch a replacement code.
        expect(
            queryByText('Could not join with that code. Check it and try again.'),
        ).toBeNull();
        expect(queryByText(/Ask the farm owner for a new code/)).toBeNull();
    });

    it('tells someone already in the farm that there is nothing to do', async () => {
        mockedJoinFarm.mockRejectedValue(rejection('already_member', 'Kakinada East'));

        const { getByLabelText, getByText, queryByText, getByTestId } = renderScreen();
        fireEvent.changeText(getByLabelText('Farm code'), 'ABCD2345');
        fireEvent.press(getByText('Join farm'));

        await waitFor(() => expect(getByTestId('join-waiting')).toBeTruthy());
        expect(
            queryByText('Could not join with that code. Check it and try again.'),
        ).toBeNull();
    });

    it('clears a previous failure as soon as the code is edited', async () => {
        mockedJoinFarm.mockRejectedValue(rejection('not_found'));

        const { getByLabelText, getByText, queryByText } = renderScreen();
        fireEvent.changeText(getByLabelText('Farm code'), 'ABCD2345');
        fireEvent.press(getByText('Join farm'));
        await waitFor(() =>
            expect(
                getByText('Could not join with that code. Check it and try again.'),
            ).toBeTruthy(),
        );

        fireEvent.changeText(getByLabelText('Farm code'), 'ABCD234');
        expect(
            queryByText('Could not join with that code. Check it and try again.'),
        ).toBeNull();
    });

    it('hides the join button until the code is the full eight characters', () => {
        const { getByLabelText, queryByText, getByText } = renderScreen();
        expect(queryByText('Join farm')).toBeNull();

        fireEvent.changeText(getByLabelText('Farm code'), 'ABCD234');
        expect(queryByText('Join farm')).toBeNull();

        fireEvent.changeText(getByLabelText('Farm code'), 'ABCD2345');
        expect(getByText('Join farm')).toBeTruthy();
    });

    it('lets a worker skip straight to the app without joining', () => {
        const { getByText } = renderScreen();
        fireEvent.press(getByText("I'll do this later"));

        expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'MainApp' }] });
        expect(useAuthStore.getState().pendingFarmJoin).toBe(false);
    });
});

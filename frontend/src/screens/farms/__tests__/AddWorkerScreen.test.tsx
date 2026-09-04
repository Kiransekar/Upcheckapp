// #35 — a failed user lookup used to dead-end: alert "not found" and re-arm
// the scanner, with no way forward for someone who has never registered on
// Upcheck. This locks in the fix: the alert now offers "send an invite
// instead", which routes to the farm's invite screen (FarmMembers) rather
// than leaving the owner stuck. The scanner's re-arm-on-cancel-only behaviour
// is covered separately in AddWorkerScreen.scan.test.tsx.
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../../../api/farmMembers', () => ({
    WORKER_QR_PREFIX: 'upcheck-worker:',
    farmMembersApi: { lookupUser: jest.fn(), addMember: jest.fn() },
}));

// expo-camera has no JS implementation under jest-expo's node environment.
jest.mock('expo-camera', () => {
    const { View } = require('react-native');
    return {
        CameraView: (props: any) => <View testID="camera" {...props} />,
        useCameraPermissions: () => [{ granted: true }, jest.fn()],
    };
});

jest.mock('../../../hooks/usePermissions', () => ({
    usePermissions: () => ({ role: 'owner', canInviteMember: true }),
}));

import { AddWorkerScreen } from '../AddWorkerScreen';
import { farmMembersApi } from '../../../api/farmMembers';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const route = { params: { farmId: 'farm-1', farmName: 'Kakinada East' } };

const renderScreen = (navigate = jest.fn()) =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <AddWorkerScreen route={route} navigation={{ goBack: jest.fn(), navigate }} />
        </SafeAreaProvider>,
    );

// Manual entry, not scanning — #35's dead end is in resolveUser(), which
// both the scan and manual paths call, and manual entry needs no camera prop.
const lookUpAndFail = ({ getByLabelText, getByText }: ReturnType<typeof renderScreen>) => {
    fireEvent.press(getByText('Enter ID'));
    fireEvent.changeText(getByLabelText('Worker ID, phone or email'), '9876543210');
    fireEvent.press(getByText('Find user'));
};

describe('AddWorkerScreen — a failed lookup offers an invite instead of a dead end', () => {
    beforeEach(() => jest.clearAllMocks());
    afterEach(() => jest.restoreAllMocks());

    it('offers to invite a person who has no account instead of dead-ending', async () => {
        (farmMembersApi.lookupUser as jest.Mock).mockRejectedValue({ response: { status: 404 } });
        const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

        const screen = renderScreen();
        lookUpAndFail(screen);

        await waitFor(() => expect(alert).toHaveBeenCalled());
        const buttons = alert.mock.calls[0][2];
        expect(buttons?.map((b: any) => b.text)).toEqual(
            expect.arrayContaining(['Cancel', 'Send an invite instead']),
        );
    });

    it('routes to the farm invite screen when the owner sends an invite instead', async () => {
        (farmMembersApi.lookupUser as jest.Mock).mockRejectedValue({ response: { status: 404 } });
        const navigate = jest.fn();
        jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) =>
            buttons?.find((b: any) => b.text === 'Send an invite instead')?.onPress?.(),
        );

        const screen = renderScreen(navigate);
        lookUpAndFail(screen);

        await waitFor(() =>
            expect(navigate).toHaveBeenCalledWith('FarmMembers', {
                farmId: 'farm-1',
                farmName: 'Kakinada East',
                autoShare: true,
            }),
        );
    });
});

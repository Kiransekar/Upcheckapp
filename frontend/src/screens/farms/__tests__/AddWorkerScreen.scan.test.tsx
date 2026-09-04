// docs/UI_UX_AUDIT.md / audit #58 — a QR with a valid `upcheck-worker:` prefix
// whose user lookup FAILED left `scanned` stuck at true: `onBarcode` sets it
// before calling `resolveUser`, and `resolveUser`'s catch only alerted and set
// `found` to null. Every subsequent scan then hit `if (scanned) return` and did
// nothing, so the camera looked alive but was inert until the user toggled to
// manual mode and back.
//
// #35 changed WHEN the scanner re-arms: the failed-lookup alert now offers a
// real next step ("send an invite instead"), and re-arming unconditionally —
// the old behaviour — is what made that dead end a loop with no exit. So the
// scanner now only re-arms if the owner taps Cancel; this locks that in.
import React from 'react';
import { render, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../../../api/farmMembers', () => ({
    WORKER_QR_PREFIX: 'upcheck-worker:',
    farmMembersApi: { lookupUser: jest.fn(), addMember: jest.fn() },
}));

// expo-camera has no JS implementation under jest-expo's node environment.
// Render CameraView as a plain host view so the test can reach onBarcodeScanned.
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

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <AddWorkerScreen
                route={{ params: { farmId: 'farm-1', farmName: 'Kakinada East' } }}
                navigation={{ goBack: jest.fn(), navigate: jest.fn() }}
            />
        </SafeAreaProvider>,
    );

describe('AddWorkerScreen — scanner re-arms after a failed lookup', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    it('accepts a second scan after the owner cancels out of the failed-lookup invite prompt', async () => {
        (farmMembersApi.lookupUser as jest.Mock).mockRejectedValue({
            response: { data: { message: 'No such user' } },
        });
        // Alert now has two buttons: Cancel (index 0, re-arms) and "send an
        // invite instead" (index 1, navigates away). Simulate the owner
        // dismissing it, same as a real Cancel tap.
        const alertSpy = jest
            .spyOn(Alert, 'alert')
            .mockImplementation((_t, _m, buttons) => buttons?.[0]?.onPress?.());

        const { getByTestId } = renderScreen();
        // Re-read the prop before every scan. `onBarcode` closes over `scanned`,
        // so a handler captured before the first scan still sees `scanned: false`
        // and would bypass the very guard this test exists to exercise.
        const scan = (data: string) =>
            act(async () => {
                getByTestId('camera').props.onBarcodeScanned({ data });
            });

        await scan('upcheck-worker:11111111-1111-4111-8111-111111111111');
        expect(farmMembersApi.lookupUser).toHaveBeenCalledTimes(1);
        expect(alertSpy).toHaveBeenCalledTimes(1);

        // The Cancel path debounces re-arming by 1200ms, same as the
        // invalid-prefix path, so the alert can't instantly re-scan the same code.
        await act(async () => {
            jest.advanceTimersByTime(1200);
        });

        await scan('upcheck-worker:22222222-2222-4222-8222-222222222222');
        expect(farmMembersApi.lookupUser).toHaveBeenCalledTimes(2);
    });
});

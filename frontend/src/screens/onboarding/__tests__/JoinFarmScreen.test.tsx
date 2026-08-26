jest.mock('../../../api/farmMembers', () => ({
    farmMembersApi: { joinFarm: jest.fn() },
}));
jest.mock('../../../store/membershipStore', () => ({
    useMembershipStore: Object.assign(jest.fn((sel: any) => sel({ load: jest.fn() })), { setState: jest.fn(), getState: jest.fn() }),
}));

import React from 'react';
import { Alert } from 'react-native';
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

const navigation = { reset: jest.fn() };

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <JoinFarmScreen navigation={navigation} />
        </SafeAreaProvider>,
    );

describe('JoinFarmScreen — worker self-serve farm join', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAuthStore.setState({ pendingFarmJoin: true } as any);
        jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
            buttons?.[0]?.onPress?.();
        });
    });

    it('joins with the entered code and resets to MainApp on success', async () => {
        mockedJoinFarm.mockResolvedValue({ data: { farmId: 'farm-1', role: 'worker', farm: { id: 'farm-1', name: "Ravi's Farm" } } });

        const { getByPlaceholderText, getByText } = renderScreen();
        fireEvent.changeText(getByPlaceholderText('8-character code'), 'abcd2345');
        fireEvent.press(getByText('Join farm'));

        await waitFor(() => expect(mockedJoinFarm).toHaveBeenCalledWith('ABCD2345'));
        await waitFor(() => expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'MainApp' }] }));
        expect(useAuthStore.getState().pendingFarmJoin).toBe(false);
    });

    it('lets a worker skip straight to the app without joining', () => {
        const { getByText } = renderScreen();
        fireEvent.press(getByText("I'll do this later"));

        expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'MainApp' }] });
        expect(useAuthStore.getState().pendingFarmJoin).toBe(false);
    });
});

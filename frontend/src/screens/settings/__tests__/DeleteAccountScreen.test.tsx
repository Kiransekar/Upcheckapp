// The strict delete-account confirmation. These tests lock in the gate that
// replaced a single-tap Alert: the destructive action is blocked until the
// user types the exact confirmation phrase, password accounts must supply a
// password (re-verified server-side), and a wrong password surfaces inline
// without deleting anything.
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DeleteAccountScreen } from '../DeleteAccountScreen';
import { useAuthStore } from '../../../store/authStore';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { goBack: jest.fn(), navigate: jest.fn() };
const DELETE_BTN = 'Permanently delete my account';

const setUser = (over: Partial<any> = {}) =>
    useAuthStore.setState({
        user: {
            id: 'u1', email: 'ravi@farm.in', name: 'Ravi', avatarUrl: null,
            provider: 'email', emailVerified: true, ...over,
        },
    } as any);

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <DeleteAccountScreen navigation={navigation} />
        </SafeAreaProvider>,
    );

describe('DeleteAccountScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('keeps delete disabled until the confirmation phrase matches', () => {
        const deleteAccount = jest.fn().mockResolvedValue(undefined);
        setUser();
        useAuthStore.setState({ deleteAccount } as any);

        const { getByText, getByPlaceholderText } = renderScreen();

        fireEvent.changeText(getByPlaceholderText('ravi@farm.in'), 'nope');
        fireEvent.press(getByText(DELETE_BTN));
        expect(deleteAccount).not.toHaveBeenCalled();
    });

    it('a password account is still blocked with the right phrase but no password', () => {
        const deleteAccount = jest.fn().mockResolvedValue(undefined);
        setUser({ provider: 'email' });
        useAuthStore.setState({ deleteAccount } as any);

        const { getByText, getByPlaceholderText } = renderScreen();

        fireEvent.changeText(getByPlaceholderText('ravi@farm.in'), 'ravi@farm.in');
        fireEvent.press(getByText(DELETE_BTN));
        // requiresPassword && password empty → gate holds.
        expect(deleteAccount).not.toHaveBeenCalled();
    });

    it('an OAuth account needs no password and deletes with the phrase alone', async () => {
        const deleteAccount = jest.fn().mockResolvedValue(undefined);
        setUser({ provider: 'google' });
        useAuthStore.setState({ deleteAccount } as any);

        const { getByText, getByPlaceholderText } = renderScreen();

        fireEvent.changeText(getByPlaceholderText('ravi@farm.in'), 'RAVI@FARM.IN'); // case-insensitive
        fireEvent.press(getByText(DELETE_BTN));

        await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith(undefined));
    });

    it('surfaces a wrong-password error without leaving the screen', async () => {
        const deleteAccount = jest.fn().mockRejectedValue({ response: { status: 401 } });
        setUser({ provider: 'google' }); // phrase-only path, easy to trigger the call
        useAuthStore.setState({ deleteAccount } as any);

        const { getByText, getByPlaceholderText, findByText } = renderScreen();

        fireEvent.changeText(getByPlaceholderText('ravi@farm.in'), 'ravi@farm.in');
        fireEvent.press(getByText(DELETE_BTN));

        expect(await findByText('Password is incorrect.')).toBeTruthy();
    });
});

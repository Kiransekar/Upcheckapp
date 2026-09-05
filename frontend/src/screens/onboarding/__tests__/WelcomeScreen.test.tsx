// Artboard 02. The welcome screen used to carry the language picker and a
// fabricated example dashboard; both are gone, and what is left is the routing:
// "Get started" continues the first run, "Skip for now" is for someone who
// already has an account and must not be walked through sign-up to reach
// sign-in.
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WelcomeScreen } from '../WelcomeScreen';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { navigate: jest.fn() };

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <WelcomeScreen navigation={navigation} />
        </SafeAreaProvider>,
    );

describe('WelcomeScreen — artboard 02', () => {
    beforeEach(() => jest.clearAllMocks());

    it('shows the three value props and nothing else to decide', () => {
        const { getByText, queryByText } = renderScreen();

        expect(getByText('Welcome to Neerani')).toBeTruthy();
        expect(getByText('Log water, feed and growth in seconds')).toBeTruthy();
        expect(getByText('Smart advice to boost survival and profit')).toBeTruthy();
        expect(getByText('Add workers to share the daily work')).toBeTruthy();
        // The language question belongs to artboard 01 now.
        expect(queryByText('Choose your language')).toBeNull();
    });

    it('sends "Get started" to the intent question, not straight to sign-up', () => {
        const { getByText } = renderScreen();
        fireEvent.press(getByText('Get started'));
        expect(navigation.navigate).toHaveBeenCalledWith('Intent');
    });

    it('sends "Skip for now" to sign-in', () => {
        const { getByText } = renderScreen();
        fireEvent.press(getByText('Skip for now'));
        expect(navigation.navigate).toHaveBeenCalledWith('Login');
    });
});

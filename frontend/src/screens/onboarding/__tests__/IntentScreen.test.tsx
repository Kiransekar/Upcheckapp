// Artboard 03. The whole point of this screen is that the answer reaches
// signup() — an intent that is collected and then dropped would silently route
// every new worker into owner farm-setup.
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { IntentScreen } from '../IntentScreen';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <IntentScreen navigation={navigation} />
        </SafeAreaProvider>,
    );

describe('IntentScreen — artboard 03', () => {
    beforeEach(() => jest.clearAllMocks());

    it('carries the pre-selected owner intent through to create-account', () => {
        const { getByText } = renderScreen();
        fireEvent.press(getByText('Continue'));
        expect(navigation.navigate).toHaveBeenCalledWith('Register', { intent: 'own_farm' });
    });

    it('carries the worker intent when that option is chosen', () => {
        const { getByText } = renderScreen();
        fireEvent.press(getByText("I work on someone's farm"));
        fireEvent.press(getByText('Continue'));
        expect(navigation.navigate).toHaveBeenCalledWith('Register', { intent: 'work_on_farm' });
    });

    it('says out loud that the choice is not permanent', () => {
        const { getByText } = renderScreen();
        expect(
            getByText('You can do both later — this only decides where we start.'),
        ).toBeTruthy();
    });
});

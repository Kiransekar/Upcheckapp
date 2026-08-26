// Artboard 01. Language is chosen before anything readable, so the two things
// worth locking in are that a tap actually switches the app's language (not
// just the row's highlight) and that Continue persists a choice even when the
// farmer accepted the pre-selected one without tapping anything — that stored
// value is the only thing stopping this screen reappearing every launch.
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n, { hasChosenLanguage } from '../../../i18n';
import { LanguageScreen } from '../LanguageScreen';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { replace: jest.fn() };

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <LanguageScreen navigation={navigation} />
        </SafeAreaProvider>,
    );

describe('LanguageScreen — artboard 01', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        await AsyncStorage.clear();
    });
    afterEach(async () => {
        await i18n.changeLanguage('en'); // don't leak the language change across tests
    });

    it('lists every supported language by its own name', () => {
        const { getByText } = renderScreen();
        ['English', 'हिन्दी', 'தமிழ்', 'తెలుగు', 'বাংলা', 'ଓଡ଼ିଆ'].forEach((native) => {
            expect(getByText(native)).toBeTruthy();
        });
    });

    it('switches the app language on tap, before Continue is pressed', async () => {
        const { getByText } = renderScreen();
        fireEvent.press(getByText('हिन्दी'));

        await waitFor(() => expect(i18n.language).toBe('hi'));
        // The screen's own copy follows immediately — that visible change is
        // how a farmer confirms they picked the right row.
        expect(getByText('अपनी भाषा चुनें')).toBeTruthy();
    });

    it('persists the default language on Continue even if no row was tapped', async () => {
        expect(await hasChosenLanguage()).toBe(false);

        const { getByText } = renderScreen();
        fireEvent.press(getByText('Continue'));

        await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('Welcome'));
        expect(await hasChosenLanguage()).toBe(true);
    });
});

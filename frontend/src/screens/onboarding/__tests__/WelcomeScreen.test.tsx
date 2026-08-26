// Language-first Welcome (onboarding-plan Phase 1): language selection is now
// the FIRST interactive element on this screen, above the value-prop copy —
// previously a brand-new farmer had no way to pick their language before
// reading three feature sentences in whatever the device locale resolved to
// (docs/UI_UX_AUDIT.md Executive Summary #2 / docs/ONBOARDING_MODULE_PLAN.md
// Phase 1). This locks in that tapping a language chip actually switches the
// app's language.
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import i18n from '../../../i18n';
import { WelcomeScreen } from '../WelcomeScreen';

const navigation = { replace: jest.fn(), goBack: jest.fn() };

// See src/screens/inventory/__tests__/InventoryListScreen.test.tsx for why:
// react-native-safe-area-context's initialWindowMetrics is statically null
// outside a native runtime, so SafeAreaProvider needs explicit fake metrics.
const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <WelcomeScreen navigation={navigation} />
        </SafeAreaProvider>,
    );

describe('WelcomeScreen — language-first selection', () => {
    afterEach(async () => {
        await i18n.changeLanguage('en'); // don't leak the language change across tests
    });

    it('shows the language prompt and chips before/above the value props', () => {
        const { getByText, getAllByText } = renderScreen();

        expect(getByText('Choose your language')).toBeTruthy();
        // English's native label and English gloss are both literally "English".
        expect(getAllByText('English').length).toBeGreaterThanOrEqual(2);
        expect(getByText('हिन्दी')).toBeTruthy(); // Hindi endonym, with an English gloss alongside
    });

    it('switches the app language when a chip is tapped', async () => {
        const { getByText } = renderScreen();

        fireEvent.press(getByText('हिन्दी'));

        await waitFor(() => expect(i18n.language).toBe('hi'));
    });

    it('reveals the remaining languages behind the "more" chip', () => {
        const { getByLabelText, getByText, queryByText } = renderScreen();

        // Telugu isn't in the first 3 shown by default.
        expect(queryByText('తెలుగు')).toBeNull();

        fireEvent.press(getByLabelText('More'));

        expect(getByText('తెలుగు')).toBeTruthy();
    });

    it('still shows the static example preview clearly labeled as not real data', () => {
        const { getByText } = renderScreen();

        expect(getByText('EXAMPLE — not your data')).toBeTruthy();
    });
});

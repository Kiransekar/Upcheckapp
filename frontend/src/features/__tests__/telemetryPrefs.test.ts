import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    DEFAULT_TELEMETRY_PREFS,
    analyticsAllowed,
    loadTelemetryPrefs,
    saveTelemetryPrefs,
    shouldAskAnalyticsConsent,
} from '../telemetryPrefs';

describe('telemetryPrefs', () => {
    beforeEach(async () => {
        await AsyncStorage.clear();
    });

    it('defaults to crash reporting ON and analytics NEVER ASKED', async () => {
        expect(await loadTelemetryPrefs()).toEqual({ analytics: 'unasked', crashReports: true });
    });

    // The single most important line in this file: silence is not a yes.
    it('does not treat "never asked" as consent', async () => {
        const prefs = await loadTelemetryPrefs();
        expect(prefs.analytics).toBe('unasked');
        expect(analyticsAllowed(prefs)).toBe(false);
    });

    it('distinguishes three states, not two', () => {
        expect(shouldAskAnalyticsConsent({ analytics: 'unasked', crashReports: true })).toBe(true);
        expect(shouldAskAnalyticsConsent({ analytics: 'granted', crashReports: true })).toBe(false);
        // A decline is an ANSWER. It is never re-asked.
        expect(shouldAskAnalyticsConsent({ analytics: 'declined', crashReports: true })).toBe(false);
        expect(analyticsAllowed({ analytics: 'declined', crashReports: true })).toBe(false);
    });

    it('remembers a decline across restarts and never re-prompts', async () => {
        await saveTelemetryPrefs({ analytics: 'declined', crashReports: true });
        const reloaded = await loadTelemetryPrefs();
        expect(reloaded.analytics).toBe('declined');
        expect(shouldAskAnalyticsConsent(reloaded)).toBe(false);
    });

    it('round-trips a grant and a crash-reporting opt-out', async () => {
        await saveTelemetryPrefs({ analytics: 'granted', crashReports: false });
        expect(await loadTelemetryPrefs()).toEqual({ analytics: 'granted', crashReports: false });
    });

    // Corrupt storage must never resolve to "yes" — it resolves to the safe
    // default, which is analytics off.
    it('falls back to the defaults on unreadable stored data', async () => {
        await AsyncStorage.setItem('upcheck-telemetry-prefs', '{not json');
        expect(await loadTelemetryPrefs()).toEqual(DEFAULT_TELEMETRY_PREFS);
    });

    it('rejects an unknown consent value rather than trusting it', async () => {
        await AsyncStorage.setItem(
            'upcheck-telemetry-prefs',
            JSON.stringify({ analytics: 'yes', crashReports: true }),
        );
        expect((await loadTelemetryPrefs()).analytics).toBe('unasked');
    });
});

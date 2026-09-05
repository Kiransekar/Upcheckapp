/**
 * Consent gate. The claim under test is not "a flag is false" — it is that the
 * PostHog SDK is never constructed without a stored grant, and that revoking
 * shuts the client down rather than leaving it running behind a boolean.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// `mock`-prefixed so jest's out-of-scope guard allows the factory below.
const mockConstructed = jest.fn();
const mockCaptured = jest.fn();
const mockOptOut = jest.fn();
const mockReset = jest.fn();
const mockShutdown = jest.fn();

jest.mock('expo-constants', () => ({
    __esModule: true,
    default: { expoConfig: { extra: { posthogApiKey: 'phc_test_key' } } },
}));

jest.mock('posthog-react-native', () => ({
    __esModule: true,
    default: class FakePostHog {
        constructor(key: string, opts: Record<string, unknown>) {
            mockConstructed(key, opts);
        }
        capture = mockCaptured;
        optOut = mockOptOut;
        reset = mockReset;
        shutdown = mockShutdown;
    },
}));

import {
    capture,
    isAnalyticsRunning,
    sanitizeProps,
    stopAnalytics,
    syncAnalyticsConsent,
} from '../analytics';
import { saveTelemetryPrefs } from '../telemetryPrefs';

describe('analytics consent gate', () => {
    beforeEach(async () => {
        await stopAnalytics();
        await AsyncStorage.clear();
        jest.clearAllMocks();
    });

    it('sends nothing by default — the SDK is never even constructed', async () => {
        expect(await syncAnalyticsConsent()).toBe(false);
        expect(isAnalyticsRunning()).toBe(false);
        expect(mockConstructed).not.toHaveBeenCalled();
        capture('screen_view', { screen: 'Today' });
        expect(mockCaptured).not.toHaveBeenCalled();
    });

    it('does not start on a stored "unasked" — silence is not consent', async () => {
        await saveTelemetryPrefs({ analytics: 'unasked', crashReports: true });
        expect(await syncAnalyticsConsent()).toBe(false);
        expect(mockConstructed).not.toHaveBeenCalled();
    });

    it('does not start on a stored decline', async () => {
        await saveTelemetryPrefs({ analytics: 'declined', crashReports: true });
        expect(await syncAnalyticsConsent()).toBe(false);
        expect(mockConstructed).not.toHaveBeenCalled();
    });

    it('starts collection when consent is granted, with autocapture and replay off', async () => {
        await saveTelemetryPrefs({ analytics: 'granted', crashReports: true });
        expect(await syncAnalyticsConsent()).toBe(true);
        expect(isAnalyticsRunning()).toBe(true);
        expect(mockConstructed).toHaveBeenCalledWith(
            'phc_test_key',
            expect.objectContaining({ enableSessionReplay: false, captureAppLifecycleEvents: false }),
        );
        capture('screen_view', { screen: 'Today' });
        expect(mockCaptured).toHaveBeenCalledWith('screen_view', { screen: 'Today' });
    });

    it('revoking stops collection AND shuts the client down', async () => {
        await saveTelemetryPrefs({ analytics: 'granted', crashReports: true });
        await syncAnalyticsConsent();

        await saveTelemetryPrefs({ analytics: 'declined', crashReports: true });
        expect(await syncAnalyticsConsent()).toBe(false);

        expect(mockOptOut).toHaveBeenCalled();
        expect(mockShutdown).toHaveBeenCalled();
        expect(isAnalyticsRunning()).toBe(false);

        mockCaptured.mockClear();
        capture('screen_view', { screen: 'Money' });
        expect(mockCaptured).not.toHaveBeenCalled();
    });
});

describe('property allowlist', () => {
    // The policy promises farm/money data never reaches analytics. A call site
    // that hands over a whole record must not be able to make that a lie.
    it('drops everything that is not an allowlisted UI fact', () => {
        const record = {
            screen: 'Money',
            count: 4,
            ok: true,
            amount: 45000,
            salary: 12000,
            biomass: 820,
            phone: '9876543210',
            pond: { id: 'p1', harvestKg: 900 },
        } as any;
        expect(sanitizeProps(record)).toEqual({ screen: 'Money', count: 4, ok: true });
    });

    it('drops non-primitive values even under an allowlisted key', () => {
        expect(sanitizeProps({ screen: { name: 'Money' } } as any)).toEqual({});
    });
});

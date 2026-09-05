/**
 * What the farmer has said about telemetry — persisted locally.
 *
 * Two independent answers, stored under one AsyncStorage key exactly like
 * `reminderTimes.ts` / `moneyPrefs.ts`:
 *
 *  • `analytics` has THREE states, not two. "Never asked" is not consent, and
 *    it is not a decline either — it is the only state that may raise a
 *    prompt. Collapsing it into a boolean would either treat silence as a yes
 *    (which the Privacy Policy explicitly forbids) or re-ask a farmer who has
 *    already said no, forever.
 *  • `crashReports` is a plain boolean, ON by default. Section 6 of the
 *    Privacy Policy says crash reporting is on by default AND that "declining
 *    either one does not reduce your access to any feature" — "either" means
 *    it must be declinable, so there is a switch for it.
 *
 * A corrupt or partial stored value falls back to the defaults: crash
 * reporting on (as promised), analytics NOT granted (never inferred).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'upcheck-telemetry-prefs';

/** 'unasked' is a real, distinct state — see the note above. */
export type ConsentState = 'unasked' | 'granted' | 'declined';

export interface TelemetryPrefs {
    analytics: ConsentState;
    crashReports: boolean;
}

export const DEFAULT_TELEMETRY_PREFS: TelemetryPrefs = {
    analytics: 'unasked',
    crashReports: true,
};

const CONSENT_STATES: ConsentState[] = ['unasked', 'granted', 'declined'];

const isTelemetryPrefs = (v: any): v is TelemetryPrefs =>
    !!v && CONSENT_STATES.includes(v.analytics) && typeof v.crashReports === 'boolean';

export async function loadTelemetryPrefs(): Promise<TelemetryPrefs> {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        if (!raw) return DEFAULT_TELEMETRY_PREFS;
        const parsed = JSON.parse(raw);
        return isTelemetryPrefs(parsed) ? parsed : DEFAULT_TELEMETRY_PREFS;
    } catch {
        return DEFAULT_TELEMETRY_PREFS;
    }
}

export async function saveTelemetryPrefs(prefs: TelemetryPrefs): Promise<void> {
    await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
}

/**
 * Only an 'unasked' farmer may be prompted. A decline is permanent as far as
 * the app is concerned — it can be reversed in Settings, never by a dialog
 * that appears again on the next launch.
 */
export const shouldAskAnalyticsConsent = (prefs: TelemetryPrefs): boolean =>
    prefs.analytics === 'unasked';

/** The only thing analytics code is allowed to ask. Silence is not a yes. */
export const analyticsAllowed = (prefs: TelemetryPrefs): boolean => prefs.analytics === 'granted';

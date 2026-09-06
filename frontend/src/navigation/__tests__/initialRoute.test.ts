/**
 * W3 — where the app opens.
 *
 * The rule used to end in `: undefined`, and React Navigation reads that as
 * "the first registered screen". The first screen in the signed-out stack is
 * `Language`, so the branch meant to say "everyone else starts on the main app
 * / login" silently said "start at the language picker". Anyone who logged out,
 * or whose refresh token was revoked — which routes through `clearSession()` —
 * reopened the app at a language question and had to walk
 * Language → Welcome → "Skip for now" → Login to reach a form they had used a
 * hundred times.
 *
 * That is why this is a pure function with a test: an implicit fallthrough
 * cannot be seen, and could not be asserted on.
 */
import { initialRouteFor } from '../RootNavigator';

const base = {
    isAuthenticated: false,
    needsConsent: false,
    pendingFarmSetup: false,
    pendingFarmJoin: false,
    needsLanguage: false,
};

describe('initialRouteFor — signed out', () => {
    it('opens the language picker on a genuine first run', () => {
        expect(initialRouteFor({ ...base, needsLanguage: true })).toBe('Language');
    });

    /** THE BUG. A returning, signed-out farmer has already chosen a language. */
    it('opens LOGIN for someone who has logged out, not the language picker', () => {
        expect(initialRouteFor({ ...base, needsLanguage: false })).toBe('Login');
    });
});

describe('initialRouteFor — signed in', () => {
    it('asks for analytics consent before anything else', () => {
        expect(
            initialRouteFor({ ...base, isAuthenticated: true, needsConsent: true }),
        ).toBe('AnalyticsConsent');
    });

    /**
     * Consent is asked BEFORE farm setup (D2) so the setup funnel is
     * measurable — so it must win over the setup gates, not be skipped by them.
     */
    it('asks for consent even when first-run setup is pending', () => {
        expect(
            initialRouteFor({
                ...base,
                isAuthenticated: true,
                needsConsent: true,
                pendingFarmSetup: true,
            }),
        ).toBe('AnalyticsConsent');
    });

    it('sends a new owner to farm setup once consent is settled', () => {
        expect(
            initialRouteFor({ ...base, isAuthenticated: true, pendingFarmSetup: true }),
        ).toBe('CreateFarm');
    });

    it('sends a new worker to the join screen', () => {
        expect(
            initialRouteFor({ ...base, isAuthenticated: true, pendingFarmJoin: true }),
        ).toBe('JoinFarm');
    });

    it('sends everyone else to the app', () => {
        expect(initialRouteFor({ ...base, isAuthenticated: true })).toBe('MainApp');
    });

    /**
     * A signed-in farmer never sees the language picker from here. It is
     * reachable from Settings; opening the app into it would be the same class
     * of bug this function exists to prevent.
     */
    it('never opens the language picker for a signed-in farmer', () => {
        expect(
            initialRouteFor({ ...base, isAuthenticated: true, needsLanguage: true }),
        ).toBe('MainApp');
    });
});

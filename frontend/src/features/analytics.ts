/**
 * Product analytics — dead until the farmer says yes.
 *
 * The Privacy Policy (src/legal/content.ts, section 6) says analytics "is
 * never enabled by default, never pre-ticked, and never inferred from your
 * silence", that switching it off "stops collection — it is not a preference
 * we quietly ignore", and that "your farm records, money and harvest data are
 * never sent to analytics, whatever your setting". Three properties, and this
 * file is where each of them is either true or a lie:
 *
 *  1. NOT STARTED, rather than started-then-disabled. `posthog-react-native`
 *     is `require`d inside `startAnalytics()` and nowhere else, so with no
 *     consent the SDK is never constructed, never imported for effect, and
 *     never touches the network or storage.
 *  2. Revoking consent SHUTS THE CLIENT DOWN — optOut, then shutdown, then the
 *     reference is dropped. A boolean guard alone would leave a live client
 *     with a queue.
 *  3. Properties go through an ALLOWLIST. `capture(event, props)` cannot be
 *     handed a whole pond/harvest/expense record, because anything not on the
 *     list is dropped before it reaches the SDK — a permissive `props: any`
 *     would make the third promise unenforceable by anything but discipline.
 *
 * No autocapture and no session recording: the plain client (not
 * `<PostHogProvider autocapture>`) captures only what is passed to it here.
 */
import Constants from 'expo-constants';
import { analyticsAllowed, loadTelemetryPrefs } from './telemetryPrefs';
import { hashUserId } from '../utils/hashUserId';

/**
 * The only properties that may leave the device. Every one is a UI fact, not a
 * farm fact. Add to this list deliberately; do not widen the type.
 */
export interface AnalyticsProps {
    /** Route name, e.g. 'WaterLog'. */
    screen?: string;
    /** Feature area, e.g. 'calculator'. */
    feature?: string;
    /** What was done, e.g. 'opened' | 'saved'. */
    action?: string;
    /** UI language code, e.g. 'ta'. */
    language?: string;
    /** Whether it succeeded. */
    ok?: boolean;
    /** A COUNT of things, never a value of things. */
    count?: number;
}

const ALLOWED_PROPS: (keyof AnalyticsProps)[] = [
    'screen',
    'feature',
    'action',
    'language',
    'ok',
    'count',
];

/**
 * Allowlist + primitive check. Belt and braces: TypeScript stops this at the
 * call site, but analytics call sites get written in a hurry and `as any`
 * exists, so the runtime filter is what actually holds the promise up.
 */
export function sanitizeProps(props?: AnalyticsProps): Record<string, string | number | boolean> {
    const out: Record<string, string | number | boolean> = {};
    if (!props) return out;
    for (const key of ALLOWED_PROPS) {
        const v = (props as Record<string, unknown>)[key];
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            out[key] = v;
        }
    }
    return out;
}

const getKey = (): string =>
    ((Constants.expoConfig?.extra as any)?.posthogApiKey as string | undefined)?.trim() || '';

const getHost = (): string =>
    ((Constants.expoConfig?.extra as any)?.posthogHost as string | undefined)?.trim() ||
    'https://us.i.posthog.com';

let client: any = null;

/**
 * Construct the client. Only reached with consent granted AND a key
 * configured — no key means analytics simply never runs, exactly like a
 * missing Sentry DSN.
 */
export async function startAnalytics(): Promise<boolean> {
    if (client) return true;
    const apiKey = getKey();
    if (!apiKey) return false;
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require('posthog-react-native');
        const PostHog = mod.default ?? mod.PostHog ?? mod;
        client = new PostHog(apiKey, {
            host: getHost(),
            // Session replay stays off permanently: it records the SCREEN, and
            // these screens show pond names, expenses and harvest values, which
            // the Privacy Policy promises analytics never receives.
            enableSessionReplay: false,
            // Lifecycle events ARE on. Application opened / installed / updated
            // / backgrounded are the raw material for every metric that counts
            // people rather than clicks — DAU, retention, growth, stickiness.
            // Without them PostHog has events but no product story, which is
            // what the first build shipped. They carry no farm data: an app
            // open is a UI fact.
            captureAppLifecycleEvents: true,
            // GeoIP off: the Policy says we do not build profiles, and IP
            // anonymisation is already forced on at the project level.
            disableGeoip: true,
            // Feature flags and experiments need the flag payload fetched on
            // start and refreshed on identify, so assignment is stable for a
            // given person instead of flipping between launches.
            preloadFeatureFlags: true,
        });
        return true;
    } catch {
        client = null;
        return false;
    }
}

/**
 * Stop collecting, and mean it: opt out, flush what is queued so nothing sits
 * on disk waiting to be sent by a later session, reset the anonymous id, close
 * the client, drop the reference.
 */
export async function stopAnalytics(): Promise<void> {
    const c = client;
    client = null;
    if (!c) return;
    try {
        await c.optOut?.();
        await c.reset?.();
        await c.shutdown?.();
    } catch {
        /* a client that will not close cleanly is still unreferenced now */
    }
}

/**
 * The entire call-site API. A no-op without consent, so screens never have to
 * check — and a screen that forgets to check therefore cannot leak anything.
 */
export function capture(event: string, props?: AnalyticsProps): void {
    if (!client) return;
    try {
        client.capture(event, sanitizeProps(props));
    } catch {
        /* analytics must never be able to break a screen */
    }
}

/**
 * Record a screen view through PostHog's OWN screen API.
 *
 * This must not be `capture('screen_viewed', { screen })`. That is what the
 * first build did, and it populated a custom property while PostHog's built-in
 * Screen and URL columns — which every mobile dashboard, path analysis and
 * funnel reads — stayed null. `client.screen()` emits `$screen` with
 * `$screen_name`, which is the field the product actually looks at.
 *
 * The route NAME only. Route params carry farmId, pondId, cropId and amounts
 * and are never passed.
 */
export function screenView(name: string): void {
    if (!client || !name) return;
    try {
        client.screen(name);
    } catch {
        /* analytics must never be able to break a screen */
    }
}

/**
 * Tie events to a stable person, by irreversible hash only.
 *
 * Everything that counts PEOPLE rather than events — retention, growth,
 * DAU/MAU, stickiness — needs a distinct id that survives a restart. Without
 * this, PostHog mints a fresh anonymous id and those panels are permanently
 * empty however many events arrive. It is also what makes feature-flag and
 * experiment assignment stable instead of re-rolling on every launch.
 *
 * No person properties are set: no email, no name, no phone. The hash is the
 * whole identity, and it means nothing outside Upcheck.
 */
export async function identifyUser(rawId: string | null | undefined): Promise<void> {
    if (!client) return;
    try {
        if (!rawId) {
            // Signed out. reset() gives the device a fresh anonymous id so the
            // next person to use this phone is not counted as the last one.
            await client.reset?.();
            return;
        }
        const id = await hashUserId(rawId);
        if (!id) return;
        await client.identify?.(id);
        // Re-fetch flags for the newly identified person: assignment can depend
        // on who they are, and the payload fetched while anonymous may differ.
        await client.reloadFeatureFlags?.();
    } catch {
        /* an identity failure must never break the app or lose the session */
    }
}

/**
 * Feature flags and experiments.
 *
 * Both read from the payload PostHog preloads on start and refreshes on
 * identify. All three degrade to "off"/undefined when analytics is not running
 * — no consent, no key, or a failed fetch — so a flag can never turn a feature
 * on for someone who has not agreed to analytics, and an offline farmer gets
 * the control experience rather than a crash.
 *
 * Treat "off" as the safe default when writing call sites: the flag decides
 * whether to ADD something, never whether to withhold something essential.
 */
export function isFeatureEnabled(flag: string): boolean {
    if (!client) return false;
    try {
        return client.isFeatureEnabled?.(flag) === true;
    } catch {
        return false;
    }
}

/** The variant string for a multivariate flag / experiment, or undefined. */
export function getFeatureFlag(flag: string): string | boolean | undefined {
    if (!client) return undefined;
    try {
        return client.getFeatureFlag?.(flag);
    } catch {
        return undefined;
    }
}

/** Force a refresh — after a role change, or on returning to the foreground. */
export async function reloadFeatureFlags(): Promise<void> {
    if (!client) return;
    try {
        await client.reloadFeatureFlags?.();
    } catch {
        /* stale flags are better than a thrown error */
    }
}

/**
 * Bring the client into line with what is stored. Called on launch and after
 * every change to the switch, so "off" takes effect immediately rather than at
 * the next restart.
 */
export async function syncAnalyticsConsent(): Promise<boolean> {
    const prefs = await loadTelemetryPrefs();
    if (analyticsAllowed(prefs)) return startAnalytics();
    await stopAnalytics();
    return false;
}

/** For tests and for the Settings readout. */
export const isAnalyticsRunning = (): boolean => client !== null;

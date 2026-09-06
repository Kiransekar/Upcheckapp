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
export type SignupMethod = 'email' | 'google' | 'truecaller' | 'otp';
export type FarmRole = 'owner' | 'manager' | 'worker' | 'viewer';

/**
 * Bucketed size band. Deliberately NOT an exact number: how many ponds a farmer
 * holds is a commercial fact about their business, and the Privacy Policy says
 * farm records never reach analytics. A band answers the question worth asking
 * — do small holdings retain differently from large ones — without shipping a
 * per-person holding size.
 */
export type SizeBand = '1' | '2-5' | '6-20' | '20+';

/** Bucket a raw count. The ONLY sanctioned way to get a quantity into an event. */
export const sizeBand = (n: number): SizeBand =>
    n <= 1 ? '1' : n <= 5 ? '2-5' : n <= 20 ? '6-20' : '20+';

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
    /** How the account was created or signed in to. */
    method?: SignupMethod;
    /** WHICH kind of thing, e.g. 'water_quality' | 'feed' | 'pdf'. A category. */
    kind?: string;
    /**
     * Why something failed, as a CATEGORY — 'network' | 'validation' | 'auth'.
     * Never an error message: messages carry ids, emails, amounts and whatever
     * a backend chose to interpolate. A union, so a message cannot be passed.
     */
    reason?: 'network' | 'validation' | 'auth' | 'permission' | 'conflict' | 'unknown';
    /** The actor's role on the farm in context. A permission level, not a person. */
    role?: FarmRole;
    /** A bucketed quantity. Use sizeBand(); exact counts are not representable. */
    band?: SizeBand;
}

const ALLOWED_PROPS: (keyof AnalyticsProps)[] = [
    'screen',
    'feature',
    'action',
    'language',
    'ok',
    'method',
    'kind',
    'reason',
    'role',
    'band',
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
/**
 * Properties attached to the PERSON rather than an event, so PostHog can build
 * cohorts — "Odia-speaking workers who churned in week two" is a question you
 * cannot ask from events alone.
 *
 * All three are approved and all three are deliberately NOT identifying: a
 * language, a permission level, and which sign-in button was pressed. There is
 * no name, email, phone or farm here, and the person they hang off is a
 * one-way hash.
 */
export interface PersonProps {
    language?: string;
    role?: FarmRole;
    method?: SignupMethod;
}

const ALLOWED_PERSON_PROPS: (keyof PersonProps)[] = ['language', 'role', 'method'];

/** Same allowlist discipline as events — a person object is just as leakable. */
export function sanitizePersonProps(props?: PersonProps): Record<string, string> {
    const out: Record<string, string> = {};
    if (!props) return out;
    for (const key of ALLOWED_PERSON_PROPS) {
        const v = (props as Record<string, unknown>)[key];
        if (typeof v === 'string' && v) out[key] = v;
    }
    return out;
}

/**
 * Every event this app may send. A closed set, for two reasons: a typo in a
 * free-form string silently creates a second event that no dashboard counts,
 * and a reviewer can read this list and see the whole of what we collect
 * without grepping the codebase.
 *
 * Names are past-tense facts about the UI. None of them carries a farm record,
 * a money value, a harvest figure, or an exact quantity.
 */
export const EVENTS = {
    // Lifecycle — install → account → churn.
    SIGNUP_COMPLETED: 'signup_completed',
    LOGIN_COMPLETED: 'login_completed',
    LOGIN_FAILED: 'login_failed',
    ONBOARDING_COMPLETED: 'onboarding_completed',
    /** Fired BEFORE the account goes, or it never sends. See deleteAccount. */
    ACCOUNT_DELETED: 'account_deleted',

    // Activation — an account with no pond is not yet a user.
    FARM_CREATED: 'farm_created',
    POND_CREATED: 'pond_created',
    CYCLE_STARTED: 'cycle_started',
    FIRST_LOG_RECORDED: 'first_log_recorded',

    // Engagement — which features earn their place.
    LOG_RECORDED: 'log_recorded',
    TASK_CREATED: 'task_created',
    TASK_COMPLETED: 'task_completed',
    EXPORT_GENERATED: 'export_generated',
    INVITE_SENT: 'invite_sent',
    INVITE_ACCEPTED: 'invite_accepted',

    // Reliability — problems that are not crashes, so Sentry never sees them.
    SAVE_FAILED: 'save_failed',
    SYNC_QUEUE_DRAINED: 'sync_queue_drained',
} as const;

export type AnalyticsEvent = (typeof EVENTS)[keyof typeof EVENTS];

/**
 * The entire call-site API. A no-op without consent, so screens never have to
 * check — and a screen that forgets to check therefore cannot leak anything.
 *
 * `event` is the closed EVENTS union: a call site cannot invent a name, and
 * cannot accidentally pass a user-supplied string as one.
 */
/**
 * Properties attached to EVERY event, refreshed whenever they change.
 *
 * Why this exists: `role` and `language` were set as PERSON properties on
 * identify and nowhere else. In person-on-events mode PostHog attaches a person
 * property to events that arrive AFTER the identify that set it — so every
 * event before the memberships load, which is most of a first session, carried
 * no role at all. The dashboards duly reported `role: unknown` for essentially
 * everything.
 *
 * Person properties are still set on identify (they are what makes a PERSON
 * filterable). These are the same two facts stamped on the EVENT, so an insight
 * can split by role without depending on when identify happened to run.
 *
 * Same allowlist as everything else — this is not a back door for new fields.
 */
let ambient: Record<string, string> = {};

/**
 * Set the ambient properties. Called from App.tsx alongside `identifyUser`, so
 * the two never disagree about who the farmer currently is.
 */
export function setAmbientProps(props?: PersonProps): void {
    ambient = sanitizePersonProps(props);
}

/** For tests, and for `reset()` on sign-out — a new person, no stale role. */
export function clearAmbientProps(): void {
    ambient = {};
}

export function capture(event: AnalyticsEvent, props?: AnalyticsProps): void {
    if (!client) return;
    try {
        // Event props win: a call site that says `role` means that role, for
        // that event, whatever the ambient one is.
        client.capture(event, { ...ambient, ...sanitizeProps(props) });
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
        // Carries role and language ON THE EVENT — see `ambient`. Without this
        // a screen view is only attributable to a role if identify happened to
        // have run first, which for a first session it mostly had not.
        client.screen(name, { ...ambient });
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
export async function identifyUser(
    rawId: string | null | undefined,
    props?: PersonProps,
): Promise<void> {
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
        await client.identify?.(id, sanitizePersonProps(props));
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

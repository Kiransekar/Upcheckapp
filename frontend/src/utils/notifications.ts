import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import i18n from '../i18n';
import type { PondContext } from '../api/pondContext';
import { pondSlotDone, chemistryDone, type Slot } from '../features/logProgress';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    } as Notifications.NotificationBehavior),
});

/**
 * The one Android channel everything of ours is delivered on.
 *
 * It used to be created only inside `registerForPushNotificationsAsync`, and
 * neither `scheduleNotificationAsync` call named a channel — so every reminder
 * landed on Expo's fallback "Miscellaneous" channel, which the farmer can mute
 * without ever touching the channel they were actually prompted about. Both
 * the creation and the `channelId` on the trigger are now unconditional.
 *
 * The id stays `'default'`: Expo's Android push delivery falls back to a
 * channel with exactly that id, so renaming it would push every server-sent
 * alert onto "Miscellaneous" instead. Only the human-readable name changed.
 */
export const REMINDER_CHANNEL_ID = 'default';

let channelReady: Promise<void> | null = null;

export function ensureNotificationChannel(): Promise<void> {
    if (Platform.OS !== 'android') return Promise.resolve();
    channelReady ??= Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
        name: 'Reminders & alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0062C4',
    }).then(() => undefined);
    return channelReady;
}

export type ReminderPermission = 'granted' | 'denied' | 'undetermined';

/**
 * Ask for POST_NOTIFICATIONS (Android 13+) / the iOS alert permission, once.
 *
 * This lives here rather than only in `registerForPushNotificationsAsync`
 * because scheduling without it SUCCEEDS and then shows nothing — the OS drops
 * it silently. Every arming path therefore routes through this first, so the
 * permission request can never be ordered after the scheduling that depends
 * on it. `requestPermissionsAsync` is a no-op once the user has answered, so
 * calling it from the foreground/save paths cannot re-prompt.
 */
export async function ensureNotificationPermission(): Promise<ReminderPermission> {
    try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        if (existing === 'granted') return 'granted';
        const { status } = await Notifications.requestPermissionsAsync();
        return (status as ReminderPermission) ?? 'undetermined';
    } catch (e) {
        console.warn('[Notifications] Could not resolve notification permission', e);
        return 'undetermined';
    }
}

export async function registerForPushNotificationsAsync() {
    let token;

    await ensureNotificationChannel();

    if (Device.isDevice) {
        const finalStatus = await ensureNotificationPermission();
        if (finalStatus !== 'granted') {
            console.warn('[Notifications] Push notification permissions not granted');
            return undefined;
        }
        // Learn more about projectId: https://docs.expo.dev/push-notifications/push-notifications-setup/#configure-projectid
        // EAS projectId is used here.
        try {
            const projectId =
                Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
            if (!projectId) {
                throw new Error('Project ID not found');
            }
            token = (
                await Notifications.getExpoPushTokenAsync({
                    projectId,
                })
            ).data;
        } catch (e: unknown) {
            token = `${e}`;
        }
    } else {
        console.warn('[Notifications] Must use physical device for Push Notifications');
    }

    return token;
}

// ──────────────────────────────────────────────────────────────────────────────
// Reminders that skip what is already done (the continuous-data loop)
//
// Local notifications prompt the farmer to log DO / pH / salinity / temperature
// three times a day, plus a weekly chemistry check. Those readings feed every
// engine (via pond-context), so the decision quality compounds across the
// cycle. Local (on-device) scheduling — no server needed, works offline.
// ──────────────────────────────────────────────────────────────────────────────

const REMINDER_TAG = 'wq-reminder';
const CHEM_REMINDER_TAG = 'chem-reminder';

export interface HM { hour: number; minute: number }
export interface ReminderTimes {
    morning: HM;
    afternoon: HM;
    evening: HM;
    /** weekday: 1 = Sunday … 7 = Saturday, matching expo-notifications. */
    chemistry: HM & { weekday: number };
}

export const DEFAULT_REMINDER_TIMES: ReminderTimes = {
    morning: { hour: 6, minute: 30 },
    afternoon: { hour: 13, minute: 0 },
    evening: { hour: 18, minute: 0 },
    chemistry: { weekday: 1, hour: 7, minute: 30 },
};

const DAILY_SLOTS: Slot[] = ['morning', 'afternoon', 'evening'];

/**
 * How far ahead the rolling window reaches. See the lapse note below.
 *
 * Raised from 7 to 14: the one-shot design means the reminders simply stop
 * once the window runs out, so the window IS the lapse tolerance, and it costs
 * nothing but pending slots to double it. 14 × 3 daily + 1 chemistry = 43,
 * comfortably under iOS's hard cap of 64 pending local notifications per app
 * (which is why this is not 30).
 */
const WINDOW_DAYS = 14;

const isOurs = (n: any): boolean => {
    const tag = n?.content?.data?.tag;
    return tag === REMINDER_TAG || tag === CHEM_REMINDER_TAG;
};

/** Cancel every notification this module owns, leaving others alone. */
async function cancelOurs(): Promise<void> {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
        scheduled
            .filter(isOurs)
            .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
}

/** Fire time of an already-scheduled one-shot, whatever shape the OS returns. */
const triggerDate = (n: any): Date | null => {
    const raw = n?.trigger?.value ?? n?.trigger?.date;
    if (raw == null) return null;
    const d = raw instanceof Date ? raw : new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
};

export interface ReminderStatus {
    permission: ReminderPermission;
    /** How many of OUR reminders the OS is actually holding. */
    scheduled: number;
    /** When the next one fires, or null if none. */
    next: Date | null;
}

/**
 * The honest answer to "am I going to be reminded?".
 *
 * Read from the OS, never from an assumption: every failure in this module
 * used to be swallowed, so a farmer with zero scheduled notifications and a
 * denied permission saw exactly the same UI as one who was fully armed. This
 * is what Settings renders.
 */
export async function getReminderStatus(): Promise<ReminderStatus> {
    if (Platform.OS === 'web') return { permission: 'denied', scheduled: 0, next: null };
    try {
        const { status } = await Notifications.getPermissionsAsync();
        const ours = (await Notifications.getAllScheduledNotificationsAsync()).filter(isOurs);
        const next = ours
            .map(triggerDate)
            .filter((d): d is Date => d !== null)
            .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
        return {
            permission: (status as ReminderPermission) ?? 'undetermined',
            scheduled: ours.length,
            next,
        };
    } catch (e) {
        console.warn('[Notifications] Could not read reminder status', e);
        return { permission: 'undetermined', scheduled: 0, next: null };
    }
}

/**
 * (Re)arm the reminder window, skipping anything the farmer has already done.
 *
 * WHY ONE-SHOTS RATHER THAN A REPEATING TRIGGER
 *
 * A local notification can be made conditional only when it is SCHEDULED —
 * nothing of ours runs at fire time, so a repeating DAILY trigger cannot ask
 * whether today's check is already logged. It therefore fired at a farmer who
 * had logged everything an hour earlier, which is exactly the complaint this
 * replaces. One-shots let a satisfied slot simply not be scheduled.
 *
 * WHY `contexts` NO LONGER DECIDES *WHETHER* TO REMIND
 *
 * `contexts` comes from `GET /alert-center/today`, whose `activeContexts`
 * filters on `activeCycleId: Not(IsNull())` — ONLY ponds with a running crop.
 * A farmer between cycles, or one who has ponds but has never started a crop,
 * got `contexts: []`; this function cancelled the whole window and returned,
 * so they silently received nothing, forever. That is the reported bug.
 *
 * A fallow pond still needs its water tested, so having a readable pond — not
 * having a running crop — is what arms the reminders. `hasPonds` carries that,
 * and `contexts` is now used for one thing only: SKIPPING a slot that is
 * already logged. No contexts simply means nothing is known to be done, which
 * is the safe direction to be wrong in.
 *
 * TWO ACCEPTED CONSEQUENCES
 *
 * 1. If the app is not opened for WINDOW_DAYS the reminders lapse, where the
 *    repeating triggers never did. Acceptable: the window is re-armed on every
 *    open, and it is now a fortnight rather than a week.
 * 2. If a worker logs the morning check on their own phone, this phone still
 *    reminds until it next syncs. Removing that needs a server deciding at send
 *    time (the QStash follow-up); until then the copy stays a nudge, never an
 *    accusation.
 *
 * Called on app foreground and from saveRecord()'s success path — the same
 * choke point that already drives invalidateForEntity().
 *
 * @param hasPonds does this account have any pond at all, cycle or no cycle?
 *   Defaults to `contexts.length > 0` so a caller that only has contexts still
 *   behaves sanely; App.tsx passes the real answer from `GET /ponds/mine`.
 */
export async function syncReminders(
    contexts: PondContext[],
    times: ReminderTimes = DEFAULT_REMINDER_TIMES,
    now: Date = new Date(),
    hasPonds: boolean = contexts.length > 0,
): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
        // Permission and channel BEFORE anything is scheduled: without the
        // first, scheduling "succeeds" and the OS shows nothing; without the
        // second, Android delivers on a channel the farmer never saw.
        const permission = await ensureNotificationPermission();
        await ensureNotificationChannel();

        // CANCEL ONLY WHEN WE ARE ABOUT TO RESCHEDULE.
        //
        // This used to cancel first and then hit these two early returns, and
        // it runs on EVERY app foreground — so a single transient condition
        // (permission not yet answered, `/ponds/mine` momentarily empty or
        // failing) silently wiped every reminder the farmer had and put none
        // back. Nothing rearmed them until a later launch happened to satisfy
        // both guards, and from the farmer's side reminders had simply stopped
        // with no explanation and nothing on screen.
        //
        // Bailing BEFORE the cancel leaves the previously scheduled window
        // intact, which is strictly better: those notifications were correct
        // when they were scheduled, and a stale reminder is a far smaller
        // failure than silence.
        if (permission !== 'granted') {
            console.warn('[Notifications] Reminders not armed — permission is', permission);
            return;
        }
        if (!hasPonds) return;
        await cancelOurs();

        /** Today's slot is skipped only when we KNOW every pond has logged it. */
        const allDone = (fn: (c: PondContext) => boolean) =>
            contexts.length > 0 && contexts.every(fn);

        for (let day = 0; day < WINDOW_DAYS; day++) {
            for (const slot of DAILY_SLOTS) {
                const { hour, minute } = times[slot];
                const when = new Date(now);
                when.setDate(when.getDate() + day);
                when.setHours(hour, minute, 0, 0);
                if (when <= now) continue; // already past

                // Today only: skip a slot every pond has already logged.
                if (day === 0 && allDone((c) => pondSlotDone(c, slot, now))) continue;

                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: i18n.t(`notifications.wq.${slot}.title`, 'Water check'),
                        body: i18n.t(
                            `notifications.wq.${slot}.body`,
                            'Log DO, pH, salinity and temperature so your feed and risk advice stay accurate.',
                        ),
                        data: { tag: REMINDER_TAG, slot },
                    },
                    trigger: {
                        type: Notifications.SchedulableTriggerInputTypes.DATE,
                        date: when,
                        channelId: REMINDER_CHANNEL_ID,
                    },
                });
            }
        }

        // Weekly chemistry: one occurrence inside the window, skipped when every
        // pond has a measurement inside the last seven days.
        if (!allDone((c) => chemistryDone(c, now))) {
            const when = nextWeekday(now, times.chemistry);
            if (when.getTime() - now.getTime() < WINDOW_DAYS * 86_400_000) {
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: i18n.t('notifications.chemTitle', 'Weekly chemistry check'),
                        body: i18n.t(
                            'notifications.chemBody',
                            'Test ammonia, nitrite, nitrate, alkalinity and hardness — it keeps your feed and disease advice sharp.',
                        ),
                        data: { tag: CHEM_REMINDER_TAG, slot: 'chemistry' },
                    },
                    trigger: {
                        type: Notifications.SchedulableTriggerInputTypes.DATE,
                        date: when,
                        channelId: REMINDER_CHANNEL_ID,
                    },
                });
            }
        }
    } catch (e) {
        console.warn('[Notifications] Could not sync reminders', e);
    }
}

/** Next occurrence of `weekday` (1 = Sunday) at the given time, after `now`. */
function nextWeekday(now: Date, t: { weekday: number; hour: number; minute: number }): Date {
    const when = new Date(now);
    when.setHours(t.hour, t.minute, 0, 0);
    const target = t.weekday - 1; // expo is 1-based Sunday; Date is 0-based
    let delta = (target - when.getDay() + 7) % 7;
    if (delta === 0 && when <= now) delta = 7;
    when.setDate(when.getDate() + delta);
    return when;
}

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

export async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#0062C4',
        });
    }

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
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

/** How far ahead the rolling window reaches. See the lapse note below. */
const WINDOW_DAYS = 7;

/** Cancel every notification this module owns, leaving others alone. */
async function cancelOurs(): Promise<void> {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
        scheduled
            .filter((n) => {
                const tag = (n.content?.data as any)?.tag;
                return tag === REMINDER_TAG || tag === CHEM_REMINDER_TAG;
            })
            .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
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
 * TWO ACCEPTED CONSEQUENCES
 *
 * 1. If the app is not opened for WINDOW_DAYS the reminders lapse, where the
 *    repeating triggers never did. Acceptable: the window is re-armed on every
 *    open, and a farmer who has not opened the app in a week has been reminded
 *    every day of that week.
 * 2. If a worker logs the morning check on their own phone, this phone still
 *    reminds until it next syncs. Removing that needs a server deciding at send
 *    time (the QStash follow-up); until then the copy stays a nudge, never an
 *    accusation.
 *
 * Called on app foreground and from saveRecord()'s success path — the same
 * choke point that already drives invalidateForEntity().
 */
export async function syncReminders(
    contexts: PondContext[],
    times: ReminderTimes = DEFAULT_REMINDER_TIMES,
    now: Date = new Date(),
): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
        await cancelOurs();
        if (contexts.length === 0) return;

        for (let day = 0; day < WINDOW_DAYS; day++) {
            for (const slot of DAILY_SLOTS) {
                const { hour, minute } = times[slot];
                const when = new Date(now);
                when.setDate(when.getDate() + day);
                when.setHours(hour, minute, 0, 0);
                if (when <= now) continue; // already past

                // Today only: skip a slot every pond has already logged.
                const satisfied =
                    day === 0 && contexts.every((c) => pondSlotDone(c, slot, now));
                if (satisfied) continue;

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
                    },
                });
            }
        }

        // Weekly chemistry: one occurrence inside the window, skipped when every
        // pond has a measurement inside the last seven days.
        if (!contexts.every((c) => chemistryDone(c, now))) {
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

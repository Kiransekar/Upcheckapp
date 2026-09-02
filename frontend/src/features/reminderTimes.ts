/**
 * The farmer's chosen reminder times — persisted locally.
 *
 * Defaults (06:30 / 13:00 / 18:00 daily, Sunday 07:30 for chemistry) suit most
 * farms, but a farm that starts at 5am should be able to say so. Stored as
 * plain JSON under one AsyncStorage key; a farmer who has never chosen gets
 * the defaults, and so does a farmer whose stored value is corrupt or
 * partial — the alternative is silently scheduling nothing, which is worse
 * than the wrong time.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_REMINDER_TIMES, type HM, type ReminderTimes } from '../utils/notifications';

const KEY = 'upcheck-reminder-times';

const isHM = (v: any): v is HM =>
    !!v && typeof v.hour === 'number' && typeof v.minute === 'number';

const isReminderTimes = (v: any): v is ReminderTimes =>
    !!v &&
    isHM(v.morning) &&
    isHM(v.afternoon) &&
    isHM(v.evening) &&
    isHM(v.chemistry) &&
    typeof v.chemistry.weekday === 'number';

export async function loadReminderTimes(): Promise<ReminderTimes> {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        if (!raw) return DEFAULT_REMINDER_TIMES;
        const parsed = JSON.parse(raw);
        return isReminderTimes(parsed) ? parsed : DEFAULT_REMINDER_TIMES;
    } catch {
        return DEFAULT_REMINDER_TIMES;
    }
}

export async function saveReminderTimes(times: ReminderTimes): Promise<void> {
    await AsyncStorage.setItem(KEY, JSON.stringify(times));
}

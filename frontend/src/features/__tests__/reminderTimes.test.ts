import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadReminderTimes, saveReminderTimes } from '../reminderTimes';
import { DEFAULT_REMINDER_TIMES } from '../../utils/notifications';

describe('reminderTimes', () => {
    beforeEach(async () => {
        await AsyncStorage.clear();
    });

    it('returns the defaults when the farmer has never chosen', async () => {
        expect(await loadReminderTimes()).toEqual(DEFAULT_REMINDER_TIMES);
    });

    it('round-trips a saved choice', async () => {
        const t = { ...DEFAULT_REMINDER_TIMES, morning: { hour: 5, minute: 0 } };
        await saveReminderTimes(t);
        expect(await loadReminderTimes()).toEqual(t);
    });

    // A corrupt or partial value must not brick the reminders.
    it('falls back to the defaults on unreadable stored data', async () => {
        await AsyncStorage.setItem('upcheck-reminder-times', '{not json');
        expect(await loadReminderTimes()).toEqual(DEFAULT_REMINDER_TIMES);
    });

    it('falls back to the defaults on a partial stored value', async () => {
        await AsyncStorage.setItem(
            'upcheck-reminder-times',
            JSON.stringify({ morning: { hour: 5, minute: 0 } }),
        );
        expect(await loadReminderTimes()).toEqual(DEFAULT_REMINDER_TIMES);
    });
});

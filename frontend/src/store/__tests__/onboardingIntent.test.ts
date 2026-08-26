// T3.12 — the onboarding intent now lives on the server (the `users` row in the
// app's Supabase Postgres), not only on the device.
//
// The reason is the reinstall / second-phone case: device storage cannot tell a
// farmer part-way through setup where they had got to. The risk is the mirror
// image — restoring an intent for someone who already finished, and trapping
// them in a setup screen they cannot leave. Both are pinned here.
jest.mock('../../api/profiles', () => ({
    profilesApi: {
        getMyPreferences: jest.fn(),
        setMyPreferences: jest.fn().mockResolvedValue({ data: {} }),
    },
}));

import { useAuthStore } from '../authStore';
import { profilesApi } from '../../api/profiles';

const reset = (over: Partial<ReturnType<typeof useAuthStore.getState>> = {}) =>
    useAuthStore.setState({ pendingFarmSetup: false, pendingFarmJoin: false, ...over } as any);

describe('persisting the intent', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        reset();
    });

    it('sends the intent to the server', async () => {
        await useAuthStore.getState().persistOnboardingIntent('own_farm');

        expect(profilesApi.setMyPreferences).toHaveBeenCalledWith({
            onboardingIntent: 'own_farm',
        });
    });

    it('swallows a failure — bookkeeping must not fail the signup that worked', async () => {
        (profilesApi.setMyPreferences as jest.Mock).mockRejectedValueOnce(new Error('offline'));

        await expect(
            useAuthStore.getState().persistOnboardingIntent('work_on_farm'),
        ).resolves.toBeUndefined();
    });

    it('clears the intent once the farm is created', async () => {
        // Otherwise a reinstall walks them back through setup they have done.
        reset({ pendingFarmSetup: true });

        useAuthStore.getState().completeFarmSetup();
        await Promise.resolve();

        expect(useAuthStore.getState().pendingFarmSetup).toBe(false);
        expect(profilesApi.setMyPreferences).toHaveBeenCalledWith({
            onboardingIntent: undefined,
        });
    });

    it('clears the intent once a farm is joined', async () => {
        reset({ pendingFarmJoin: true });

        useAuthStore.getState().completeFarmJoin();
        await Promise.resolve();

        expect(useAuthStore.getState().pendingFarmJoin).toBe(false);
        expect(profilesApi.setMyPreferences).toHaveBeenCalled();
    });
});

describe('restoring the intent on a fresh device', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        reset();
    });

    it('re-opens farm setup for an owner who never finished it', async () => {
        (profilesApi.getMyPreferences as jest.Mock).mockResolvedValue({
            data: { onboardingIntent: 'own_farm' },
        });

        await useAuthStore.getState().restoreOnboardingIntent();

        expect(useAuthStore.getState().pendingFarmSetup).toBe(true);
        expect(useAuthStore.getState().pendingFarmJoin).toBe(false);
    });

    it('re-opens the join screen for a worker who never finished it', async () => {
        (profilesApi.getMyPreferences as jest.Mock).mockResolvedValue({
            data: { onboardingIntent: 'work_on_farm' },
        });

        await useAuthStore.getState().restoreOnboardingIntent();

        expect(useAuthStore.getState().pendingFarmJoin).toBe(true);
        expect(useAuthStore.getState().pendingFarmSetup).toBe(false);
    });

    it('leaves a finished farmer alone — no stored intent, no gate', async () => {
        // The trap this avoids: someone who already made their farm being sent
        // back into setup on every launch, with no way out.
        (profilesApi.getMyPreferences as jest.Mock).mockResolvedValue({ data: {} });

        await useAuthStore.getState().restoreOnboardingIntent();

        expect(useAuthStore.getState().pendingFarmSetup).toBe(false);
        expect(useAuthStore.getState().pendingFarmJoin).toBe(false);
    });

    it('does not ask the server when this device already knows', async () => {
        reset({ pendingFarmSetup: true });

        await useAuthStore.getState().restoreOnboardingIntent();

        expect(profilesApi.getMyPreferences).not.toHaveBeenCalled();
    });

    it('leaves the gates alone when the server is unreachable', async () => {
        (profilesApi.getMyPreferences as jest.Mock).mockRejectedValue(new Error('offline'));

        await useAuthStore.getState().restoreOnboardingIntent();

        expect(useAuthStore.getState().pendingFarmSetup).toBe(false);
        expect(useAuthStore.getState().pendingFarmJoin).toBe(false);
    });
});

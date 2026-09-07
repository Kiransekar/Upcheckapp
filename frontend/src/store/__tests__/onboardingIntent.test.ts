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

jest.mock('../../api/farms', () => ({
    farmsApi: { getAll: jest.fn() },
}));

import { useAuthStore } from '../authStore';
import { profilesApi } from '../../api/profiles';
import { farmsApi } from '../../api/farms';

const reset = (over: Partial<ReturnType<typeof useAuthStore.getState>> = {}) =>
    useAuthStore.setState({ pendingFarmSetup: false, pendingFarmJoin: false, ...over } as any);

/** Default: the account owns nothing, so an intent is a live resume point. */
const ownsNoFarms = () =>
    (farmsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });

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
        // NULL, not undefined. This assertion used to say `undefined` and so
        // pinned the bug in place: JSON.stringify drops undefined properties,
        // so the request went out as `{}` and cleared nothing. The intent then
        // survived on the server and re-armed the gate on every launch.
        expect(profilesApi.setMyPreferences).toHaveBeenCalledWith({
            onboardingIntent: null,
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
        ownsNoFarms();
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

    /**
     * The production trap, reported by a farmer with seven ponds: the farm
     * creation screen on EVERY app open, with no way past it.
     *
     * A stale intent is not hypothetical — clearing is fire-and-forget, so it
     * can always be lost to a dropped connection. Owning a farm is the durable
     * fact and it must win over anything the server still remembers.
     */
    it('never gates someone who already has a farm, whatever the server remembers', async () => {
        (profilesApi.getMyPreferences as jest.Mock).mockResolvedValue({
            data: { onboardingIntent: 'own_farm' },
        });
        (farmsApi.getAll as jest.Mock).mockResolvedValue({ data: [{ id: 'f1' }] });

        await useAuthStore.getState().restoreOnboardingIntent();

        expect(useAuthStore.getState().pendingFarmSetup).toBe(false);
        expect(useAuthStore.getState().pendingFarmJoin).toBe(false);
    });

    it('heals the stale row so it stops costing a request every launch', async () => {
        (profilesApi.getMyPreferences as jest.Mock).mockResolvedValue({
            data: { onboardingIntent: 'own_farm' },
        });
        (farmsApi.getAll as jest.Mock).mockResolvedValue({ data: [{ id: 'f1' }] });

        await useAuthStore.getState().restoreOnboardingIntent();
        await Promise.resolve();

        expect(profilesApi.setMyPreferences).toHaveBeenCalledWith({
            onboardingIntent: null,
        });
    });

    it('applies the same guard to a worker who has already joined somewhere', async () => {
        // /farms is member-aware, so one call answers for both gates.
        (profilesApi.getMyPreferences as jest.Mock).mockResolvedValue({
            data: { onboardingIntent: 'work_on_farm' },
        });
        (farmsApi.getAll as jest.Mock).mockResolvedValue({ data: [{ id: 'f1' }] });

        await useAuthStore.getState().restoreOnboardingIntent();

        expect(useAuthStore.getState().pendingFarmJoin).toBe(false);
    });

    it('costs no farm lookup when there is no intent stored', async () => {
        (profilesApi.getMyPreferences as jest.Mock).mockResolvedValue({ data: {} });

        await useAuthStore.getState().restoreOnboardingIntent();

        expect(farmsApi.getAll).not.toHaveBeenCalled();
    });

    it('leaves the gates off when the farm lookup itself fails', async () => {
        // Failing open is the safe direction: someone who should have been
        // gated still reaches the app and can create a farm from inside it,
        // whereas a wrong gate is a screen with no exit.
        (profilesApi.getMyPreferences as jest.Mock).mockResolvedValue({
            data: { onboardingIntent: 'own_farm' },
        });
        (farmsApi.getAll as jest.Mock).mockRejectedValue(new Error('offline'));

        await useAuthStore.getState().restoreOnboardingIntent();

        expect(useAuthStore.getState().pendingFarmSetup).toBe(false);
    });
});

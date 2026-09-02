import { create } from 'zustand';
import { farmMembersApi, type MyMembership, type FarmRole } from '../api/farmMembers';
import { useAuthStore } from './authStore';

interface MembershipState {
    memberships: MyMembership[];
    loaded: boolean;
    loading: boolean;
    load: () => Promise<void>;
    /** Role on a farm, or null if not a member. Owner is the safe default for
     *  the legacy single-user case (a farm the user created but has no row yet). */
    roleForFarm: (farmId?: string) => FarmRole | null;
    isWorker: (farmId?: string) => boolean;
    reset: () => void;
}

export const useMembershipStore = create<MembershipState>((set, get) => ({
    memberships: [],
    loaded: false,
    loading: false,

    load: async () => {
        if (get().loading) return;
        // Production logs showed `[NO AUTH HEADER] GET /api/farm-members/mine`
        // — this fired before the session was restored, so it 401'd and the
        // store stayed empty. Wait for a token rather than spending a round
        // trip on a request that cannot succeed.
        if (!useAuthStore.getState().accessToken) return;
        set({ loading: true });
        try {
            const { data } = await farmMembersApi.listMine();
            set({ memberships: data, loaded: true, loading: false });
        } catch {
            set({ loading: false });
        }
    },

    roleForFarm: (farmId) => {
        if (!farmId) return null;
        const m = get().memberships.find((x) => x.farmId === farmId);
        return m ? m.role : null;
    },

    isWorker: (farmId) => get().roleForFarm(farmId) === 'worker',

    reset: () => set({ memberships: [], loaded: false, loading: false }),
}));

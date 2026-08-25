import apiClient from './client';

// Mirrors backend FarmRole (backend/src/farm-access/farm-member.entity.ts).
export type FarmRole = 'owner' | 'manager' | 'worker' | 'viewer';

/** Roles a member can be invited/added as (ownership is transferred separately). */
export type AssignableRole = Exclude<FarmRole, 'owner'>;

export interface PublicUser {
    id: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    avatarUrl: string | null;
}

/** Whether a membership grants anything yet. See backend FarmMemberStatus. */
export type FarmMemberStatus = 'active' | 'pending';

/** How a farm handles someone redeeming its code. */
export interface JoinPolicy {
    /** 'manual' queues them for approval; 'auto' admits immediately. */
    joinApproval: 'manual' | 'auto';
    /** Who may act on the queue: owner alone, or owner + managers. */
    joinApprover: 'owner' | 'managers';
}

export interface FarmMember {
    id: string;
    farmId: string;
    userId: string;
    role: FarmRole;
    status: FarmMemberStatus;
    createdAt: string;
    user: PublicUser | null;
}

export interface MyMembership {
    farmId: string;
    role: FarmRole;
    farm: { id: string; name: string; farmCode?: string } | null;
}

/** Prefix that wraps a user id inside their profile QR, to reject unrelated codes. */
export const WORKER_QR_PREFIX = 'upcheck-worker:';

/** Mirrors backend FarmInvite (backend/src/farm-members/farm-invite.entity.ts). */
export interface FarmInvite {
    id: string;
    code: string;
    role: AssignableRole;
    /** null = never expires (only the codes backfilled from the old farmCode). */
    expiresAt: string | null;
    /** 0 = unlimited uses (backfilled legacy codes only; not mintable). */
    maxUses: number;
    usedCount: number;
    createdAt: string;
}

export interface CreateInviteBody {
    role?: AssignableRole;
    expiresInHours?: number;
    maxUses?: number;
}

/**
 * Why the server refused a code. Sent as `reason` alongside the message so the
 * client can translate each case instead of showing one generic failure.
 */
export type InviteRejection = 'not_found' | 'revoked' | 'expired' | 'exhausted';

/** Pull the machine-readable rejection out of an axios error, if present. */
export const inviteRejectionOf = (e: any): InviteRejection | null => {
    const reason = e?.response?.data?.reason;
    return reason === 'not_found' || reason === 'revoked' || reason === 'expired' || reason === 'exhausted'
        ? reason
        : null;
};

export const farmMembersApi = {
    lookupUser: (params: { userId?: string; phone?: string; email?: string }) =>
        apiClient.get<PublicUser>('/farm-members/users/lookup', { params }),

    listMine: () => apiClient.get<MyMembership[]>('/farm-members/mine'),

    listMembers: (farmId: string) =>
        apiClient.get<FarmMember[]>(`/farms/${farmId}/members`),

    addMember: (farmId: string, userId: string, role?: AssignableRole) =>
        apiClient.post<FarmMember>(`/farms/${farmId}/members`, role ? { userId, role } : { userId }),

    removeMember: (farmId: string, userId: string) =>
        apiClient.delete(`/farms/${farmId}/members/${userId}`),

    changeRole: (farmId: string, userId: string, role: AssignableRole) =>
        apiClient.patch<FarmMember>(`/farms/${farmId}/members/${userId}`, { role }),

    transferOwnership: (farmId: string, newOwnerUserId: string) =>
        apiClient.post(`/farms/${farmId}/transfer-ownership`, { newOwnerUserId }),

    joinFarm: (code: string) =>
        apiClient.post<{ farmId: string; role: FarmRole; farm: { id: string; name: string } }>(
            '/farm-members/join',
            { code },
        ),

    // ── Invites ────────────────────────────────────────────────
    // The farm code is the farm's IDENTITY. An invite is the CREDENTIAL: it
    // expires, can be revoked, is usage-capped, and records who issued it.

    listInvites: (farmId: string) =>
        apiClient.get<FarmInvite[]>(`/farms/${farmId}/invites`),

    createInvite: (farmId: string, body: CreateInviteBody = {}) =>
        apiClient.post<FarmInvite>(`/farms/${farmId}/invites`, body),

    revokeInvite: (farmId: string, inviteId: string) =>
        apiClient.delete(`/farms/${farmId}/invites/${inviteId}`),

    // ── Waiting to be let in ──────────────────────────────────

    listPending: (farmId: string) =>
        apiClient.get<FarmMember[]>(`/farms/${farmId}/pending`),

    approveMember: (farmId: string, userId: string, role?: AssignableRole) =>
        apiClient.post<FarmMember>(
            `/farms/${farmId}/pending/${userId}/approve`,
            role ? { role } : {},
        ),

    declineMember: (farmId: string, userId: string) =>
        apiClient.delete(`/farms/${farmId}/pending/${userId}`),

    setJoinPolicy: (farmId: string, policy: Partial<JoinPolicy>) =>
        apiClient.post<JoinPolicy>(`/farms/${farmId}/join-policy`, policy),

    /** Retire every active invite for the farm and mint a fresh one. */
    rotateInvite: (farmId: string, body: CreateInviteBody = {}) =>
        apiClient.post<FarmInvite>(`/farms/${farmId}/invites/rotate`, body),
};

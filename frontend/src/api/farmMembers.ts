import apiClient from './client';
import type { CapabilityOverrides, RolePolicy } from '../permissions/capabilities';

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
    /**
     * Ponds this member is restricted to. EMPTY = every pond on the farm, which
     * is the default, and what owners and managers always get regardless — see
     * the backend farm_member_ponds semantics.
     */
    pondIds: string[];
    /**
     * Per-farm override for cost visibility (W6). `null` means "whatever the
     * role implies" — owner and manager see financials, worker and viewer do
     * not. `true` grants it to someone whose role would not, `false` takes it
     * from a manager. Owner-only to set.
     */
    canViewFinancials: boolean | null;
    /**
     * Per-member capability grants. `true` allows, `false` blocks, an absent
     * key falls through to the farm's role policy and then the default matrix.
     * Supersedes `canViewFinancials`, which the backend keeps for one release.
     */
    capabilityOverrides: CapabilityOverrides | null;
    createdAt: string;
    user: PublicUser | null;
}

export interface MyMembership {
    farmId: string;
    role: FarmRole;
    /** Always 'active' — `listMine` no longer returns memberships still pending. */
    status: FarmMemberStatus;
    capabilityOverrides: CapabilityOverrides | null;
    /** The farm's per-role capability defaults, set by its owner. */
    rolePolicy: RolePolicy | null;
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
export type InviteRejection =
    | 'not_found'
    | 'revoked'
    | 'expired'
    | 'exhausted'
    /**
     * The code was FINE. These two are about the caller, not the code, and
     * they are the reason this list grew.
     *
     * A worker who redeemed a valid code under manual approval landed
     * `pending`, held nothing, saw Home's brand-new-user state, and re-entered
     * the code to try again. The server answered correctly — "you have already
     * asked to join this farm" — but that reason had no value here, so
     * `inviteRejectionOf` returned null and JoinFarmScreen fell through to its
     * TYPO branch: red boxes, "check the code and try again". They asked for a
     * new code; it produced the identical error. The loop ended only when an
     * owner happened to open the app.
     */
    | 'already_pending'
    | 'already_member';

const REJECTIONS: InviteRejection[] = [
    'not_found',
    'revoked',
    'expired',
    'exhausted',
    'already_pending',
    'already_member',
];

/** Pull the machine-readable rejection out of an axios error, if present. */
export const inviteRejectionOf = (e: any): InviteRejection | null => {
    const reason = e?.response?.data?.reason;
    return REJECTIONS.includes(reason) ? (reason as InviteRejection) : null;
};

/**
 * How a rejection should FEEL, which is not the same as what caused it.
 *
 * Three tones, because there are three different things the farmer should do:
 *  • `typo`   — retype it. The code does not exist.
 *  • `dead`   — ask the owner for a new one. The code existed and is finished.
 *  • `waiting`— do nothing. It worked; someone has to let you in.
 *
 * Collapsing the third into the first is the whole bug: it told a worker their
 * correct code was wrong and sent them to fetch another one.
 */
export type RejectionTone = 'typo' | 'dead' | 'waiting';

export const toneOf = (r: InviteRejection | null): RejectionTone => {
    if (r === 'already_pending' || r === 'already_member') return 'waiting';
    if (r === 'revoked' || r === 'expired' || r === 'exhausted') return 'dead';
    return 'typo';
};

/**
 * A join request the caller has made that nobody has answered yet.
 *
 * Carries NO role, no capability overrides and no policy — a pending row
 * grants nothing, and it is read from its own endpoint precisely so it can
 * never be mistaken for a membership. See the backend's
 * `listMyPendingRequests`.
 */
export interface PendingJoinRequest {
    farmId: string;
    farmName: string;
    /** What they WILL be once approved. For copy only; not a role they hold. */
    requestedRole: FarmRole;
    requestedAt: string | null;
}

export const farmMembersApi = {
    lookupUser: (params: { userId?: string; phone?: string; email?: string }) =>
        apiClient.get<PublicUser>('/farm-members/users/lookup', { params }),

    listMine: () => apiClient.get<MyMembership[]>('/farm-members/mine'),

    /**
     * Join requests still waiting on an owner. Its own call, not a field on
     * `listMine`, so a pending row can never be read as access.
     */
    listMyPending: () =>
        apiClient.get<PendingJoinRequest[]>('/farm-members/mine/pending'),

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
        // `status` is 'pending' when the farm requires approval (the default) —
        // the join has NOT taken effect yet in that case. It was missing from this
        // type, so callers could not tell the two outcomes apart.
        apiClient.post<{ farmId: string; role: FarmRole; status: FarmMemberStatus; farm: { id: string; name: string } }>(
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

    /** Restrict a member to specific ponds; an EMPTY array clears the scope. */
    setPondScope: (farmId: string, userId: string, pondIds: string[]) =>
        apiClient.patch(`/farms/${farmId}/members/${userId}/ponds`, { pondIds }),

    /**
     * Per-farm cost visibility override for one member. `null` restores the
     * role default (owner + manager see financials).
     */
    setFinancialAccess: (farmId: string, userId: string, canViewFinancials: boolean | null) =>
        apiClient.patch(`/farms/${farmId}/members/${userId}/financials`, { canViewFinancials }),

    /**
     * Replace one member's capability overrides wholesale. `null` (or `{}`)
     * clears them, putting the member back on the farm's role policy. Owner only.
     */
    setCapabilities: (farmId: string, userId: string, overrides: CapabilityOverrides | null) =>
        apiClient.patch<{ farmId: string; userId: string; capabilityOverrides: CapabilityOverrides | null }>(
            `/farms/${farmId}/members/${userId}/capabilities`,
            { overrides },
        ),

    /** Retire every active invite for the farm and mint a fresh one. */
    rotateInvite: (farmId: string, body: CreateInviteBody = {}) =>
        apiClient.post<FarmInvite>(`/farms/${farmId}/invites/rotate`, body),
};

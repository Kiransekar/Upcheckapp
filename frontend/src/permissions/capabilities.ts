import type { FarmRole } from '../api/farmMembers';

/**
 * Frontend mirror of the backend capability matrix
 * (backend/src/farm-access/farm-capability.ts). Keep the two in sync — the
 * backend is the source of truth and the real enforcer; this drives UI
 * visibility only (hide, never merely disable). Never rely on these checks for
 * security: the user could call the API directly, where guards + RLS apply.
 */
export type FarmCapability =
    | 'READ'
    | 'WRITE_OPERATIONAL'
    | 'WRITE_MANAGEMENT'
    | 'VIEW_FINANCIALS'
    | 'MANAGE_WORKERS'
    | 'OWNER_ONLY'
    | 'RECORD_HARVEST'
    | 'VIEW_INVENTORY'
    | 'MANAGE_INVENTORY';

export const CAPABILITY_ROLES: Record<FarmCapability, FarmRole[]> = {
    READ: ['owner', 'manager', 'worker', 'viewer'],
    WRITE_OPERATIONAL: ['owner', 'manager', 'worker'],
    WRITE_MANAGEMENT: ['owner', 'manager'],
    VIEW_FINANCIALS: ['owner', 'manager'],
    MANAGE_WORKERS: ['owner', 'manager'],
    OWNER_ONLY: ['owner'],
    // A harvest closes a cycle and books revenue — not the same key as a pH
    // reading, which is why a worker no longer gets it by default.
    RECORD_HARVEST: ['owner', 'manager'],
    VIEW_INVENTORY: ['owner', 'manager', 'worker', 'viewer'],
    MANAGE_INVENTORY: ['owner', 'manager'],
};

/**
 * What the permission grid renders — the capabilities an owner may grant or
 * revoke per role (`farm.rolePolicy`) or per member (`member.capabilityOverrides`).
 */
export const OVERRIDABLE_CAPABILITIES: readonly FarmCapability[] = [
    'RECORD_HARVEST',
    'VIEW_FINANCIALS',
    'MANAGE_INVENTORY',
    'VIEW_INVENTORY',
    // MANAGE_WORKERS is not here: every member-management action re-checks the
    // bare role, so a grant only produced confusing 403s. Mirrors the backend.
    'WRITE_MANAGEMENT',
];

/**
 * READ is what membership MEANS; OWNER_ONLY is the farm's lifecycle. Neither
 * is reachable from a policy or an override — mirrors the backend's own
 * NEVER_OVERRIDABLE.
 */
const NEVER_OVERRIDABLE: readonly FarmCapability[] = ['READ', 'OWNER_ONLY'];

/** Per-member grants: `true` allows, `false` blocks, absent = use the default. */
export type CapabilityOverrides = Partial<Record<FarmCapability, boolean>>;

/** Per-farm, per-role defaults the owner has changed. Owner is not settable. */
export type RolePolicy = Partial<Record<Exclude<FarmRole, 'owner'>, CapabilityOverrides>>;

/**
 * Resolution order, most specific first — identical to the backend's
 * `roleSatisfies`:
 *   1. the member's own override
 *   2. the farm's policy for that role
 *   3. the built-in CAPABILITY_ROLES matrix
 *
 * The owner is never reduced: their matrix answer stands whatever any override
 * or policy says.
 */
export function roleCan(
    role: FarmRole | null,
    capability: FarmCapability,
    overrides: CapabilityOverrides | null = null,
    policy: RolePolicy | null = null,
): boolean {
    if (!role) return false;
    const byMatrix = CAPABILITY_ROLES[capability].includes(role);
    if (role === 'owner') return byMatrix;
    if (NEVER_OVERRIDABLE.includes(capability)) return byMatrix;

    const override = overrides?.[capability];
    if (override !== undefined) return override;

    const fromPolicy = policy?.[role]?.[capability];
    if (fromPolicy !== undefined) return fromPolicy;

    return byMatrix;
}

export const ROLE_RANK: Record<FarmRole, number> = {
    viewer: 0,
    worker: 1,
    manager: 2,
    owner: 3,
};

/** owner → manager/worker/viewer, manager → worker only. */
export function canAssignRole(actor: FarmRole | null, target: FarmRole): boolean {
    if (target === 'owner') return false;
    if (actor === 'owner') return true;
    if (actor === 'manager') return target === 'worker';
    return false;
}

/** owner manages any non-owner; manager manages workers only. */
export function canManageMember(actor: FarmRole | null, target: FarmRole): boolean {
    if (!actor) return false;
    if (target === 'owner') return false;
    if (actor === 'owner') return true;
    if (actor === 'manager') return target === 'worker';
    return false;
}

/** Human-readable role label (English fallback; localize via i18n where shown). */
export const ROLE_LABEL: Record<FarmRole, string> = {
    owner: 'Owner',
    manager: 'Manager',
    worker: 'Worker',
    viewer: 'Viewer',
};

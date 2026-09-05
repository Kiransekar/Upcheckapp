import { FarmRole } from './farm-member.entity';

/**
 * Capability classes used to authorize farm-scoped actions. The OwnershipGuard
 * and the member-aware service methods both consult the same map, so the
 * four-role policy (blueprint §28) lives in exactly one place.
 *
 *  - READ              : any member may view (owner, manager, worker, viewer)
 *  - WRITE_OPERATIONAL : record field/operational logs (owner, manager, worker)
 *  - WRITE_MANAGEMENT  : ponds/cycles/tasks/treatments lifecycle + verify
 *                        (owner, manager)
 *  - VIEW_FINANCIALS   : costs, transactions, P&L, financial reports
 *                        (owner, manager — viewer only if the owner grants it,
 *                        handled separately per-farm)
 *  - MANAGE_WORKERS    : invite/remove/assign the worker role (owner, manager)
 *  - OWNER_ONLY        : farm/pond delete, ownership transfer, role changes,
 *                        inviting manager/viewer (owner exclusively)
 *  - RECORD_HARVEST    : log/edit/delete a harvest (owner, manager) — a harvest
 *                        closes a cycle and books revenue, so it is NOT the
 *                        same key as a pH reading
 *  - VIEW_INVENTORY    : read stock levels (all four)
 *  - MANAGE_INVENTORY  : adjust stock (owner, manager)
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
  RECORD_HARVEST: ['owner', 'manager'],
  VIEW_INVENTORY: ['owner', 'manager', 'worker', 'viewer'],
  MANAGE_INVENTORY: ['owner', 'manager'],
};

/**
 * Capabilities an owner may grant/revoke per role (farm.rolePolicy) or per
 * member (farmMember.capabilityOverrides). This is the list the permission
 * grid renders — see NEVER_OVERRIDABLE for the ones resolution refuses to
 * bend, which is a stricter, smaller set.
 */
export const OVERRIDABLE_CAPABILITIES: readonly FarmCapability[] = [
  'RECORD_HARVEST',
  'VIEW_FINANCIALS',
  'MANAGE_INVENTORY',
  'VIEW_INVENTORY',
  'WRITE_MANAGEMENT',
];

/**
 * MANAGE_WORKERS is deliberately NOT overridable. Every action behind it
 * (`addMember`, `removeMember`, `setPondScope`, invite `create`) re-checks
 * `canAssignRole`/`canManageMember`, which answer by bare role and only ever
 * say yes to owner/manager. Granting it therefore bought a worker nothing but
 * confusing 403s — and on `invites/rotate` it bought them a destructive half
 * call: the revoke-all landed, the mint failed. Make the grid honest instead
 * of teaching two halves of member management to disagree.
 */

/**
 * READ is what membership MEANS — a member who cannot read is not a member,
 * they are a removed one. OWNER_ONLY is the farm's lifecycle (delete, transfer,
 * role changes); granting it to anyone else would make "owner" a label.
 * Neither is reachable from a policy or an override.
 */
const NEVER_OVERRIDABLE: readonly FarmCapability[] = ['READ', 'OWNER_ONLY'];

/** Per-member grants: `true` allows, `false` blocks, absent = use the default. */
export type CapabilityOverrides = Partial<Record<FarmCapability, boolean>>;

/** Per-farm, per-role defaults the owner has changed. Owner is not settable. */
export type RolePolicy = Partial<
  Record<Exclude<FarmRole, 'owner'>, CapabilityOverrides>
>;

/** Everything a capability decision on one farm needs, resolved together. */
export interface MembershipGrant {
  role: FarmRole | null;
  overrides: CapabilityOverrides | null;
  policy: RolePolicy | null;
}

/**
 * Does `role` satisfy `capability`?
 *
 * Resolution order, most specific first:
 *   1. the member's own override   (farm_members.capability_overrides)
 *   2. the farm's policy for that role (farms.role_policy)
 *   3. the built-in CAPABILITY_ROLES matrix
 *
 * It is consulted HERE, in the single place every capability decision passes
 * through, so a grant cannot mean one thing at the route guard and another in
 * a service.
 *
 * The owner is never reduced: their matrix answer stands whatever any override
 * or policy says. An owner cannot be locked out of their own farm's books.
 */
export function roleSatisfies(
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

/**
 * Validate an owner-supplied overrides object. Returns the offending key, or
 * null when it is safe to store. Lives here rather than in a DTO decorator so
 * the per-member route and the per-role route cannot drift apart.
 */
export function invalidOverrideKey(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return 'overrides';
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (!OVERRIDABLE_CAPABILITIES.includes(key as FarmCapability)) return key;
    if (typeof v !== 'boolean') return key;
  }
  return null;
}

/** Same, for a whole `{ role: overrides }` policy object. */
export function invalidPolicyKey(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return 'policy';
  for (const [role, overrides] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (!['manager', 'worker', 'viewer'].includes(role)) return role;
    const bad = invalidOverrideKey(overrides);
    if (bad) return `${role}.${bad}`;
  }
  return null;
}

/** Authority ranking; higher = more privileged. Used for member management. */
export const ROLE_RANK: Record<FarmRole, number> = {
  viewer: 0,
  worker: 1,
  manager: 2,
  owner: 3,
};

/**
 * May `actor` invite/assign a member to `target` role? (blueprint §13.3, §28.5)
 *   - owner   → manager, worker, viewer
 *   - manager → worker only
 * Ownership is transferred via a dedicated flow, never assigned here.
 */
export function canAssignRole(
  actor: FarmRole | null,
  target: FarmRole,
): boolean {
  if (target === 'owner') return false; // ownership transfer is a separate flow
  if (actor === 'owner') return true;
  if (actor === 'manager') return target === 'worker';
  return false;
}

/**
 * May `actor` remove/modify an existing member currently holding `target` role?
 * Owner manages anyone below owner; manager manages workers only.
 */
export function canManageMember(
  actor: FarmRole | null,
  target: FarmRole,
): boolean {
  if (!actor) return false;
  if (target === 'owner') return false; // the owner row is managed via transfer
  if (actor === 'owner') return true;
  if (actor === 'manager') return target === 'worker';
  return false;
}

import {
  roleSatisfies,
  canAssignRole,
  canManageMember,
  CAPABILITY_ROLES,
  ROLE_RANK,
  OVERRIDABLE_CAPABILITIES,
  invalidOverrideKey,
  invalidPolicyKey,
  CapabilityOverrides,
  RolePolicy,
} from './farm-capability';
import { FarmRole } from './farm-member.entity';

describe('farm-capability matrix (4 roles)', () => {
  const ALL: FarmRole[] = ['owner', 'manager', 'worker', 'viewer'];

  it('READ: every member role can read', () => {
    ALL.forEach((r) => expect(roleSatisfies(r, 'READ')).toBe(true));
    expect(roleSatisfies(null, 'READ')).toBe(false);
  });

  it('WRITE_OPERATIONAL: owner/manager/worker yes, viewer no', () => {
    expect(roleSatisfies('owner', 'WRITE_OPERATIONAL')).toBe(true);
    expect(roleSatisfies('manager', 'WRITE_OPERATIONAL')).toBe(true);
    expect(roleSatisfies('worker', 'WRITE_OPERATIONAL')).toBe(true);
    expect(roleSatisfies('viewer', 'WRITE_OPERATIONAL')).toBe(false);
  });

  it('WRITE_MANAGEMENT / VIEW_FINANCIALS / MANAGE_WORKERS: owner+manager only', () => {
    (
      ['WRITE_MANAGEMENT', 'VIEW_FINANCIALS', 'MANAGE_WORKERS'] as const
    ).forEach((cap) => {
      expect(roleSatisfies('owner', cap)).toBe(true);
      expect(roleSatisfies('manager', cap)).toBe(true);
      expect(roleSatisfies('worker', cap)).toBe(false);
      expect(roleSatisfies('viewer', cap)).toBe(false);
    });
  });

  it('OWNER_ONLY: owner only', () => {
    expect(roleSatisfies('owner', 'OWNER_ONLY')).toBe(true);
    (['manager', 'worker', 'viewer'] as FarmRole[]).forEach((r) =>
      expect(roleSatisfies(r, 'OWNER_ONLY')).toBe(false),
    );
  });

  it('preserves the pre-existing owner/worker behaviour (no regression)', () => {
    // The two roles that existed before the extension keep exactly their old access.
    expect(roleSatisfies('owner', 'READ')).toBe(true);
    expect(roleSatisfies('owner', 'WRITE_OPERATIONAL')).toBe(true);
    expect(roleSatisfies('owner', 'OWNER_ONLY')).toBe(true);
    expect(roleSatisfies('worker', 'READ')).toBe(true);
    expect(roleSatisfies('worker', 'WRITE_OPERATIONAL')).toBe(true);
    expect(roleSatisfies('worker', 'OWNER_ONLY')).toBe(false);
  });

  it('every capability lists at least the owner', () => {
    Object.values(CAPABILITY_ROLES).forEach((roles) =>
      expect(roles).toContain('owner'),
    );
  });

  // The resolution order that makes "permissions per role, plus a single-member
  // exception" one decision instead of two that can disagree:
  //   member override → farm role policy → matrix default.
  describe('overrides and role policy', () => {
    it('a worker cannot record a harvest by default', () => {
      expect(roleSatisfies('worker', 'RECORD_HARVEST')).toBe(false);
      expect(roleSatisfies('manager', 'RECORD_HARVEST')).toBe(true);
      expect(roleSatisfies('owner', 'RECORD_HARVEST')).toBe(true);
    });

    it('a farm policy grants it to every worker on that farm', () => {
      const policy: RolePolicy = { worker: { RECORD_HARVEST: true } };
      expect(roleSatisfies('worker', 'RECORD_HARVEST', null, policy)).toBe(true);
      // ...and only to workers.
      expect(roleSatisfies('viewer', 'RECORD_HARVEST', null, policy)).toBe(
        false,
      );
    });

    it('a member override of false beats a policy of true', () => {
      expect(
        roleSatisfies(
          'worker',
          'RECORD_HARVEST',
          { RECORD_HARVEST: false },
          { worker: { RECORD_HARVEST: true } },
        ),
      ).toBe(false);
    });

    it('a member override of true beats the matrix default', () => {
      expect(
        roleSatisfies('worker', 'VIEW_FINANCIALS', { VIEW_FINANCIALS: true }),
      ).toBe(true);
    });

    it('an owner is never reduced by an override or a policy', () => {
      expect(
        roleSatisfies(
          'owner',
          'VIEW_FINANCIALS',
          { VIEW_FINANCIALS: false },
          { manager: { VIEW_FINANCIALS: false } } as RolePolicy,
        ),
      ).toBe(true);
    });

    it('OWNER_ONLY and READ ignore both', () => {
      expect(
        roleSatisfies(
          'manager',
          'OWNER_ONLY',
          { OWNER_ONLY: true },
          { manager: { OWNER_ONLY: true } } as RolePolicy,
        ),
      ).toBe(false);
      expect(
        roleSatisfies('viewer', 'READ', { READ: false } as CapabilityOverrides),
      ).toBe(true);
    });

    // Documented and allowed: WRITE_OPERATIONAL is not on the permission grid
    // (OVERRIDABLE_CAPABILITIES), but resolution does not special-case it, so a
    // policy written by hand or by a later screen still applies.
    it('a policy can widen WRITE_OPERATIONAL for viewers', () => {
      expect(
        roleSatisfies('viewer', 'WRITE_OPERATIONAL', null, {
          viewer: { WRITE_OPERATIONAL: true },
        }),
      ).toBe(true);
    });

    it('inventory defaults: everyone reads, owner/manager adjust', () => {
      ALL.forEach((r) => expect(roleSatisfies(r, 'VIEW_INVENTORY')).toBe(true));
      expect(roleSatisfies('worker', 'MANAGE_INVENTORY')).toBe(false);
      expect(roleSatisfies('manager', 'MANAGE_INVENTORY')).toBe(true);
    });

    it('the grid never offers a capability resolution refuses to bend', () => {
      expect(OVERRIDABLE_CAPABILITIES).not.toContain('OWNER_ONLY');
      expect(OVERRIDABLE_CAPABILITIES).not.toContain('READ');
    });
  });

  describe('owner-supplied objects are validated before they are stored', () => {
    it('accepts a well-formed overrides object', () => {
      expect(invalidOverrideKey({ RECORD_HARVEST: true })).toBeNull();
      expect(invalidOverrideKey(null)).toBeNull();
    });
    it('rejects an unknown capability and a non-boolean value', () => {
      expect(invalidOverrideKey({ DELETE_EVERYTHING: true })).toBe(
        'DELETE_EVERYTHING',
      );
      expect(invalidOverrideKey({ RECORD_HARVEST: 'yes' })).toBe(
        'RECORD_HARVEST',
      );
      expect(invalidOverrideKey({ READ: false })).toBe('READ');
    });
    it('rejects an unknown role in a policy', () => {
      expect(invalidPolicyKey({ worker: { RECORD_HARVEST: true } })).toBeNull();
      expect(invalidPolicyKey({ owner: { RECORD_HARVEST: true } })).toBe(
        'owner',
      );
      expect(invalidPolicyKey({ worker: { NOPE: true } })).toBe('worker.NOPE');
    });
  });

  describe('canAssignRole', () => {
    it('owner can assign manager/worker/viewer but never owner', () => {
      expect(canAssignRole('owner', 'manager')).toBe(true);
      expect(canAssignRole('owner', 'worker')).toBe(true);
      expect(canAssignRole('owner', 'viewer')).toBe(true);
      expect(canAssignRole('owner', 'owner')).toBe(false);
    });
    it('manager can assign worker only', () => {
      expect(canAssignRole('manager', 'worker')).toBe(true);
      expect(canAssignRole('manager', 'manager')).toBe(false);
      expect(canAssignRole('manager', 'viewer')).toBe(false);
    });
    it('worker/viewer/null cannot assign anyone', () => {
      (['worker', 'viewer', null] as (FarmRole | null)[]).forEach((r) =>
        expect(canAssignRole(r, 'worker')).toBe(false),
      );
    });
  });

  describe('canManageMember', () => {
    it('owner manages manager/worker/viewer, not other owners', () => {
      expect(canManageMember('owner', 'manager')).toBe(true);
      expect(canManageMember('owner', 'worker')).toBe(true);
      expect(canManageMember('owner', 'viewer')).toBe(true);
      expect(canManageMember('owner', 'owner')).toBe(false);
    });
    it('manager manages workers only', () => {
      expect(canManageMember('manager', 'worker')).toBe(true);
      expect(canManageMember('manager', 'manager')).toBe(false);
      expect(canManageMember('manager', 'viewer')).toBe(false);
    });
  });

  it('role ranks are strictly ordered owner>manager>worker>viewer', () => {
    expect(ROLE_RANK.owner).toBeGreaterThan(ROLE_RANK.manager);
    expect(ROLE_RANK.manager).toBeGreaterThan(ROLE_RANK.worker);
    expect(ROLE_RANK.worker).toBeGreaterThan(ROLE_RANK.viewer);
  });
});

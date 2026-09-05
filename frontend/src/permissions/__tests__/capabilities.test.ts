/**
 * The same table as the backend's `farm-capability.spec.ts`.
 *
 * This mirror exists so the UI hides exactly what the API refuses. The two
 * files must agree row for row: a client that shows a button the server will
 * 403 is a farmer filling in a form for nothing.
 */
import { roleCan, OVERRIDABLE_CAPABILITIES, type RolePolicy } from '../capabilities';

describe('roleCan', () => {
    it('gives nobody anything without a role', () => {
        expect(roleCan(null, 'READ')).toBe(false);
    });

    it('does not let a worker record a harvest by default', () => {
        expect(roleCan('worker', 'RECORD_HARVEST')).toBe(false);
        expect(roleCan('manager', 'RECORD_HARVEST')).toBe(true);
        // The point of the change: a worker keeps every other daily log.
        expect(roleCan('worker', 'WRITE_OPERATIONAL')).toBe(true);
    });

    it('grants it when the farm policy says workers may', () => {
        const policy: RolePolicy = { worker: { RECORD_HARVEST: true } };
        expect(roleCan('worker', 'RECORD_HARVEST', null, policy)).toBe(true);
    });

    it('lets one member be blocked even though the policy allows their role', () => {
        const policy: RolePolicy = { worker: { RECORD_HARVEST: true } };
        expect(roleCan('worker', 'RECORD_HARVEST', { RECORD_HARVEST: false }, policy)).toBe(false);
    });

    it('lets one member be allowed even though the default forbids it', () => {
        expect(roleCan('worker', 'VIEW_FINANCIALS', { VIEW_FINANCIALS: true })).toBe(true);
    });

    it('never reduces the owner', () => {
        const policy: RolePolicy = { manager: { VIEW_FINANCIALS: false } };
        expect(roleCan('owner', 'VIEW_FINANCIALS', { VIEW_FINANCIALS: false }, policy)).toBe(true);
        expect(roleCan('owner', 'OWNER_ONLY')).toBe(true);
    });

    it('refuses to hand OWNER_ONLY or READ to anyone by policy', () => {
        expect(roleCan('manager', 'OWNER_ONLY', { OWNER_ONLY: true } as any, {
            manager: { OWNER_ONLY: true } as any,
        })).toBe(false);
        expect(roleCan('viewer', 'READ', { READ: false } as any)).toBe(true);
    });

    it('does let a policy widen an operational capability — documented, allowed', () => {
        const policy: RolePolicy = { viewer: { WRITE_MANAGEMENT: true } };
        expect(roleCan('viewer', 'WRITE_MANAGEMENT', null, policy)).toBe(true);
    });

    it('exposes exactly the capabilities the grid may hand out', () => {
        expect([...OVERRIDABLE_CAPABILITIES].sort()).toEqual([
            'MANAGE_INVENTORY',

            'RECORD_HARVEST',
            'VIEW_FINANCIALS',
            'VIEW_INVENTORY',
            'WRITE_MANAGEMENT',
        ]);
    });
});

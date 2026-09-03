import { useMemo } from 'react';
import { useMembershipStore } from '../store/membershipStore';
import { useActiveFarmStore } from '../store/activeFarmStore';
import type { FarmRole } from '../api/farmMembers';
import { roleCan, type FarmCapability } from '../permissions/capabilities';

export interface Permissions {
    role: FarmRole | null;
    isOwner: boolean;
    isManager: boolean;
    isWorker: boolean;
    isViewer: boolean;

    /** Raw capability check against the role on the (active) farm. */
    can: (capability: FarmCapability) => boolean;

    // Capability flags (mirror backend farm-capability.ts)
    canRead: boolean;
    canRecordData: boolean;        // WRITE_OPERATIONAL — feed/water/sampling/mortality
    canManageOperations: boolean;  // WRITE_MANAGEMENT — ponds, cycles, tasks, treatments, verify
    canViewFinancials: boolean;    // VIEW_FINANCIALS — costs, transactions, P&L, financial reports
    canManageMembers: boolean;     // MANAGE_WORKERS — invite/remove workers
    canOwnerActions: boolean;      // OWNER_ONLY — delete farm/pond, transfer, role changes
    canRecordHarvest: boolean;     // RECORD_HARVEST — a harvest books revenue and closes a cycle
    canViewInventory: boolean;     // VIEW_INVENTORY — read stock levels
    canManageInventory: boolean;   // MANAGE_INVENTORY — adjust stock

    // Semantic aliases for screens (kept thin so intent reads clearly at call sites)
    canCreatePond: boolean;
    canDeletePond: boolean;
    canStartCycle: boolean;
    canCreateTask: boolean;
    canRecordTreatment: boolean;
    canInviteMember: boolean;
    canDeleteFarm: boolean;
    canTransferOwnership: boolean;
    canChangeRoles: boolean;
}

/**
 * Resolve the current user's capabilities on a farm. Pass a farmId, or omit to
 * use the active farm context. Drives UI visibility only — the backend guards
 * and RLS are the real enforcement.
 */
export function usePermissions(farmId?: string): Permissions {
    const grantForFarm = useMembershipStore((s) => s.grantForFarm);
    const memberships = useMembershipStore((s) => s.memberships);
    const activeFarmId = useActiveFarmStore((s) => s.selectedFarm?.id);

    const targetFarmId = farmId ?? activeFarmId;

    // Depend on `memberships` so flags recompute when the membership list loads
    // or the active farm changes.
    return useMemo(() => {
        const { role, overrides, policy } = grantForFarm(targetFarmId);
        const can = (c: FarmCapability) => roleCan(role, c, overrides, policy);

        const canManageOperations = can('WRITE_MANAGEMENT');
        const canManageMembers = can('MANAGE_WORKERS');
        const canOwnerActions = can('OWNER_ONLY');

        return {
            role,
            isOwner: role === 'owner',
            isManager: role === 'manager',
            isWorker: role === 'worker',
            isViewer: role === 'viewer',
            can,
            canRead: can('READ'),
            canRecordData: can('WRITE_OPERATIONAL'),
            canManageOperations,
            canViewFinancials: can('VIEW_FINANCIALS'),
            canManageMembers,
            canOwnerActions,
            canRecordHarvest: can('RECORD_HARVEST'),
            canViewInventory: can('VIEW_INVENTORY'),
            canManageInventory: can('MANAGE_INVENTORY'),
            canCreatePond: canManageOperations,
            canDeletePond: canOwnerActions,
            canStartCycle: canManageOperations,
            canCreateTask: canManageOperations,
            canRecordTreatment: canManageOperations,
            canInviteMember: canManageMembers,
            canDeleteFarm: canOwnerActions,
            canTransferOwnership: canOwnerActions,
            canChangeRoles: canOwnerActions,
        };
    }, [targetFarmId, memberships, grantForFarm]);
}

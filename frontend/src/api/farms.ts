import apiClient from './client';
import type { RolePolicy } from '../permissions/capabilities';

export interface Farm {
    id: string;
    name: string;
    farmCode?: string;
    areaHectares?: number;
    address?: string;
    waterSourceType?: string;
    plannedPondCount?: number;
    latitude?: number;
    longitude?: number;
    qrCodeUrl?: string;
    privacySetting: string;
    boundary?: { latitude: number; longitude: number }[];
    userId: string;
    /** Per-role capability defaults for this farm. `null` = the built-in matrix. */
    rolePolicy?: RolePolicy | null;
    createdAt: string;
    updatedAt: string;
    /** Set while the farm is archived — it drops out of every list and total. */
    archivedAt?: string | null;
    deletedAt?: string | null;
    ponds?: any[];
}

/**
 * "You cannot delete this, because it holds records."
 *
 * Both `DELETE /farms/:id` and `DELETE /ponds/:id` answer a delete that would
 * take crop history with it as a 409 — the farm one with an
 * `error: 'crop_history_exists'` body, the pond one with a bare message. The
 * screens turn this into "archive it instead", never a raw API string, so the
 * status code is the whole test.
 */
export const isHistoryConflict = (err: unknown): boolean =>
    (err as any)?.response?.status === 409;

export interface CreateFarmDto {
    name: string;
    // No farmCode — the server always generates it. Sending one is ignored.
    areaHectares?: number;
    address?: string;
    waterSourceType?: string;
    plannedPondCount?: number;
    latitude?: number;
    longitude?: number;
    privacySetting?: string;
    boundary?: { latitude: number; longitude: number }[];
}

export interface UpdateFarmDto extends Partial<CreateFarmDto> {}

export const farmsApi = {
    // Archived farms are excluded server-side unless `includeArchived` is set.
    getAll: (params?: { includeArchived?: boolean }) =>
        apiClient.get<Farm[]>('/farms', { params }),

    getById: (id: string) => apiClient.get<Farm>(`/farms/${id}`),

    create: (data: CreateFarmDto) => apiClient.post<Farm>('/farms', data),

    update: (id: string, data: UpdateFarmDto) => apiClient.patch<Farm>(`/farms/${id}`, data),

    /** Owner only. Reversible — the farm keeps every record. */
    archive: (id: string) => apiClient.patch(`/farms/${id}/archive`),

    unarchive: (id: string) => apiClient.patch(`/farms/${id}/unarchive`),

    /** Owner only. Refused with a 409 once any pond has crop history. */
    delete: (id: string) => apiClient.delete(`/farms/${id}`),

    /** Set what each role may do on this farm. Owner only; `null` clears it. */
    setRolePolicy: (id: string, policy: RolePolicy | null) =>
        apiClient.patch<{ farmId: string; rolePolicy: RolePolicy | null }>(
            `/farms/${id}/role-policy`,
            { policy },
        ),
};

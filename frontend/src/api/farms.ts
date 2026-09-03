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
    deletedAt?: string | null;
    ponds?: any[];
}

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
    getAll: () => apiClient.get<Farm[]>('/farms'),

    getById: (id: string) => apiClient.get<Farm>(`/farms/${id}`),

    create: (data: CreateFarmDto) => apiClient.post<Farm>('/farms', data),

    update: (id: string, data: UpdateFarmDto) => apiClient.patch<Farm>(`/farms/${id}`, data),

    delete: (id: string) => apiClient.delete(`/farms/${id}`),

    /** Set what each role may do on this farm. Owner only; `null` clears it. */
    setRolePolicy: (id: string, policy: RolePolicy | null) =>
        apiClient.patch<{ farmId: string; rolePolicy: RolePolicy | null }>(
            `/farms/${id}/role-policy`,
            { policy },
        ),
};

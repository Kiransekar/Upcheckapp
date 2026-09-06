import apiClient from './client';

export interface Pond {
    id: string;
    farmId: string;
    name: string;
    namePrefix?: string;
    sequenceNumber?: number;
    pondCode?: string;
    displayName?: string;
    geometryType?: 'rectangular' | 'circular' | 'irregular' | 'raceway';
    constructionType?: 'earthen' | 'lined' | 'cage' | 'biofloc_ras';
    lengthM?: number;
    widthM?: number;
    diameterM?: number;
    depthM?: number;
    installedAeratorHp?: number;
    aeratorCount?: number;
    channelCount?: number;
    calculatedAreaM2?: number;
    overrideAreaM2?: number;
    gpsLat?: number;
    gpsLng?: number;
    status: 'fallow' | 'active' | 'harvesting' | 'archived';
    archivedAt?: string;
    activeCycleId?: string | null;
    boundary?: { latitude: number; longitude: number }[];
    createdAt: string;
    updatedAt: string;
    farm?: any;
    activeCycle?: any;
    /**
     * Which of this pond's measurements the APP filled in rather than the
     * farmer — see `Pond.assumedFields` on the backend. Rendered as "not
     * confirmed" rather than presented as an answer nobody gave.
     */
    assumedFields?: string[];
}

export interface CreatePondDto {
    farmId: string;
    namePrefix: string;
    geometryType: 'rectangular' | 'circular' | 'irregular' | 'raceway';
    constructionType: 'earthen' | 'lined' | 'cage' | 'biofloc_ras';
    lengthM?: number;
    widthM?: number;
    diameterM?: number;
    depthM: number;
    installedAeratorHp?: number;
    aeratorCount?: number;
    channelCount?: number;
    overrideAreaM2?: number;
    displayName?: string;
    batchCount?: number;
    /**
     * Fields this client filled in WITHOUT asking, so the pond can say which
     * of its numbers are assumed. Onboarding sends this; the full create form
     * sends nothing, because every value there was typed by the farmer.
     */
    assumedFields?: string[];
}

// POST /ponds wraps the created pond with derived geometry figures.
export interface CreatePondResult {
    pond: Pond;
    calculatedAreaM2?: number;
    volumeM3?: number;
    warnings?: { field: string; message: string }[];
}

export interface UpdatePondDto extends Partial<Omit<CreatePondDto, 'farmId'>> { }

export const pondsApi = {
    getAll: (farmId: string, params?: { status?: string; search?: string; sort?: string; includeArchived?: boolean; page?: number; take?: number }) =>
        apiClient.get<any>(`/ponds`, { params: { farmId, ...params } }),

    getMine: () => apiClient.get<Pond[]>('/ponds/mine'),

    getById: (id: string) => apiClient.get<Pond>(`/ponds/${id}`),

    create: (data: CreatePondDto) => apiClient.post<Pond>('/ponds', data),

    update: (id: string, data: UpdatePondDto) => apiClient.patch<Pond>(`/ponds/${id}`, data),

    archive: (id: string) => apiClient.patch(`/ponds/${id}/archive`),
    unarchive: (id: string) => apiClient.patch(`/ponds/${id}/unarchive`),

    delete: (id: string) => apiClient.delete(`/ponds/${id}`),

    getDimensionHistory: (id: string, params?: { page?: number; take?: number }) =>
        apiClient.get<any>(`/ponds/${id}/dimension-history`, { params }),
};

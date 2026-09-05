import apiClient from './client';

export type HarvestType = 'partial' | 'full';
export type HarvestStatus = 'pending' | 'sold' | 'discarded';

export interface Harvest {
    id: string;
    cropId: string;
    harvestDate: string;
    weightKg: number;
    count?: number | null;
    averageSize?: number | null;
    salePriceTotal?: number | null;
    buyerName?: string | null;
    harvestType: HarvestType;
    status: HarvestStatus;
    notes?: string | null;
    createdAt: string;
    updatedAt: string;
}

/** @deprecated Use Harvest instead */
export type HarvestRecord = Harvest;

export interface CreateHarvestDto {
    cropId: string;
    harvestDate: string;
    weightKg: number;
    count?: number;
    averageSize?: number;
    salePriceTotal?: number;
    buyerName?: string;
    harvestType: HarvestType;
    status?: HarvestStatus;
    notes?: string;
}

export const harvestsApi = {
    getAll: (cropId?: string) => apiClient.get<Harvest[]>('/harvests', { params: cropId ? { cropId } : {} }),
    getByCrop: (cropId: string) => apiClient.get<Harvest[]>('/harvests', { params: { cropId } }),
    /**
     * Every harvest on a pond, across all of its crop cycles, newest first.
     *
     * A pond outlives its cycles: after a full harvest closes one, the record of
     * what came out of that pond used to be reachable only per-crop, so nobody
     * could see the pond's own run of harvests. Same DTO as `?cropId=`.
     */
    getByPond: (pondId: string) => apiClient.get<Harvest[]>('/harvests', { params: { pondId } }),
    getById: (id: string) => apiClient.get<Harvest>(`/harvests/${id}`),
    create: (data: CreateHarvestDto) => apiClient.post<Harvest>('/harvests', data),
    update: (id: string, data: Partial<CreateHarvestDto>) => apiClient.patch<Harvest>(`/harvests/${id}`, data),
    delete: (id: string) => apiClient.delete(`/harvests/${id}`),
};

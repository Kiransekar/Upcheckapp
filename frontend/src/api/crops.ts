import apiClient from './client';

export interface Crop {
    id: string;
    pondId: string;
    farmId?: string;
    name: string;
    cropCode?: string;
    speciesType?: string;
    seedType?: string;
    totalSeed?: number;
    stockingDensity?: number;
    stockingCount?: number;
    stockingDate?: string;
    initialAgeDays?: number;
    preparationDays?: number;
    totalFeedingTrays?: number;
    hatcheryId?: string;
    speciesId?: string;
    broodstockId?: string;
    feedPriceRpPerKg?: number;
    carryingCapacityKgM2?: number;
    targetCultivationDays?: number;
    targetSize?: number;
    targetSrPercent?: number;
    srPredictionMethod?: string;
    doc?: number;
    isActive?: boolean;
    expectedHarvestDate?: string;
    actualHarvestDate?: string;
    harvestWeightKg?: number;
    status: string;
    createdAt: string;
    updatedAt: string;
    /** Only `GET /crops/:id` enriches with this; the list endpoint does not. */
    computedDOC?: number;
}

/**
 * Day of culture, local-calendar days, stocking day = 1, frozen at harvest —
 * the same convention as the backend's `computeDoc`, so DOC agrees on every
 * screen. The list endpoint returns no DOC at all, so the client computes it.
 */
export const computeDoc = (
    crop: Pick<Crop, 'stockingDate' | 'actualHarvestDate' | 'initialAgeDays'>,
): number => {
    if (!crop.stockingDate) return 0;
    const [y, m, d] = crop.stockingDate.split('T')[0].split('-').map(Number);
    const start = new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
    const endSrc = crop.actualHarvestDate ? new Date(crop.actualHarvestDate) : new Date();
    const end = new Date(endSrc.getFullYear(), endSrc.getMonth(), endSrc.getDate()).getTime();
    const diff = Math.round((end - start) / 86_400_000);
    return diff >= 0 ? diff + 1 + (crop.initialAgeDays ?? 0) : 0;
};

export interface CreateCropDto {
    pondId: string;
    name: string;
    cropCode?: string;
    speciesType?: string;
    seedType?: string;
    stockingDensity?: number;
    stockingCount?: number;
    stockingDate?: string;
    expectedHarvestDate?: string;
    status?: string;
    // Stocking detail + cycle targets consumed by the decision engines/simulation.
    totalSeed?: number;
    feedPriceRpPerKg?: number;
    carryingCapacityKgM2?: number;
    targetCultivationDays?: number;
    targetSize?: number;
    targetSrPercent?: number;
    srPredictionMethod?: string;
    initialAgeDays?: number;
    preparationDays?: number;
    totalFeedingTrays?: number;
    hatcheryId?: string;
    speciesId?: string;
    broodstockId?: string;
}

export interface UpdateCropDto extends Partial<Omit<CreateCropDto, 'pondId'>> {
    status?: string;
}

export const cropsApi = {
    getAll: (pondId: string) => apiClient.get<Crop[]>('/crops', { params: { pondId } }),

    getById: (id: string) => apiClient.get<Crop>(`/crops/${id}`),

    create: (data: CreateCropDto) => apiClient.post<Crop>('/crops', data),

    update: (id: string, data: UpdateCropDto) => apiClient.patch<Crop>(`/crops/${id}`, data),

    delete: (id: string) => apiClient.delete(`/crops/${id}`),

    close: (id: string, actualHarvestDate?: string) =>
        apiClient.patch(`/crops/${id}/close`, { actualHarvestDate: actualHarvestDate || new Date().toISOString() }),
};

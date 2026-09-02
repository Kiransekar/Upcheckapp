import { create } from 'zustand';

interface CultivationPerfInputs {
    totalSeed?: number;
    totalFeedKg?: number;
    currentMbwG?: number;
    totalMortality?: number;
    totalHarvestedKg?: number;
    totalHarvestedCount?: number;
    sourceMode: 'manual' | 'cycle';
    selectedCycleId?: string;
}

interface DailyFeedInputs {
    initialStocking?: number;
    abwG?: number;
    feedingRatePct?: number;
    survivalRatePct?: number;
}

interface ProductAmountInputs {
    waterHeightM?: number;
    targetPpm?: number;
    productForm: 'granular' | 'liquid';
    productDensity: number;
    selectedPondId?: string;
}

interface FreeAmmoniaInputs {
    temperatureC?: number;
    ph?: number;
    tanMgL?: number;
}

interface CalculatorState {
    cultivationPerf: CultivationPerfInputs;
    dailyFeed: DailyFeedInputs;
    productAmount: ProductAmountInputs;
    freeAmmonia: FreeAmmoniaInputs;

    setCultivationPerf: (inputs: Partial<CultivationPerfInputs>) => void;
    setDailyFeed: (inputs: Partial<DailyFeedInputs>) => void;
    setProductAmount: (inputs: Partial<ProductAmountInputs>) => void;
    setFreeAmmonia: (inputs: Partial<FreeAmmoniaInputs>) => void;
    resetAll: () => void;
}

const defaultProductAmount: ProductAmountInputs = {
    productForm: 'granular',
    productDensity: 1.0,
};

export const useCalculatorStore = create<CalculatorState>()((set) => ({
    cultivationPerf: { sourceMode: 'manual' },
    dailyFeed: {},
    productAmount: defaultProductAmount,
    freeAmmonia: {},

    setCultivationPerf: (inputs) =>
        set((s) => ({ cultivationPerf: { ...s.cultivationPerf, ...inputs } })),

    setDailyFeed: (inputs) =>
        set((s) => ({ dailyFeed: { ...s.dailyFeed, ...inputs } })),

    setProductAmount: (inputs) =>
        set((s) => ({ productAmount: { ...s.productAmount, ...inputs } })),

    setFreeAmmonia: (inputs) =>
        set((s) => ({ freeAmmonia: { ...s.freeAmmonia, ...inputs } })),

    resetAll: () =>
        set({
            cultivationPerf: { sourceMode: 'manual' },
            dailyFeed: {},
            productAmount: defaultProductAmount,
            freeAmmonia: {},
        }),
}));

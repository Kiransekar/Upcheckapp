// Harvest and close moved to RECORD_HARVEST in Phase 2, and the screen used to
// offer both to anyone — a viewer tapped through to a 403 with the dialog
// already answered. Hidden, not disabled, is the house rule.
jest.mock('../../../api/crops', () => ({
    cropsApi: { getById: jest.fn(), close: jest.fn(), update: jest.fn() },
    computeDoc: () => 1,
}));
jest.mock('../../../api/pnl', () => ({ pnlApi: { cropPnl: jest.fn() } }));
jest.mock('@react-navigation/native', () => ({
    useFocusEffect: (effect: any) => {
        const React = require('react');
        React.useEffect(effect, [effect]);
    },
}));

const permissions = {
    canRecordHarvest: false,
    canManageOperations: false,
    canViewFinancials: false,
};
jest.mock('../../../hooks/usePermissions', () => ({ usePermissions: () => permissions }));

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CycleDetailScreen } from '../CycleDetailScreen';
import { cropsApi } from '../../../api/crops';
import { pnlApi } from '../../../api/pnl';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const CYCLE = { id: 'crop-1', pondId: 'pond-1', farmId: 'farm-1', status: 'active', stockingDate: '2026-07-01' };

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <CycleDetailScreen route={{ params: { cycleId: 'crop-1' } }} navigation={{ goBack: jest.fn(), navigate: jest.fn() }} />
        </SafeAreaProvider>,
    );

describe('CycleDetailScreen — capability gates', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (cropsApi.getById as jest.Mock).mockResolvedValue({ data: CYCLE });
        (pnlApi.cropPnl as jest.Mock).mockRejectedValue(new Error('403'));
        permissions.canRecordHarvest = false;
        permissions.canManageOperations = false;
        permissions.canViewFinancials = false;
    });

    it('hides harvest, close, edit and the money view without the capabilities', async () => {
        const { queryByText, findByText } = renderScreen();
        await findByText('Stocking Info');
        expect(queryByText('Record Harvest')).toBeNull();
        expect(queryByText('Close Cycle')).toBeNull();
        expect(queryByText('Edit')).toBeNull();
        expect(queryByText('Expenses & P&L')).toBeNull();
    });

    it('shows harvest and close with RECORD_HARVEST alone', async () => {
        permissions.canRecordHarvest = true;
        const { queryByText, findByText } = renderScreen();
        await findByText('Record Harvest');
        expect(queryByText('Close Cycle')).not.toBeNull();
        // Still no money view — RECORD_HARVEST is not VIEW_FINANCIALS.
        expect(queryByText('Expenses & P&L')).toBeNull();
    });

    it('shows the P&L card only with VIEW_FINANCIALS and a successful read', async () => {
        permissions.canViewFinancials = true;
        (pnlApi.cropPnl as jest.Mock).mockResolvedValue({
            data: { revenue: 500000, totalCost: 300000, profit: 200000, harvestBiomassKg: 1200, harvestComplete: true },
        });
        const { findByText } = renderScreen();
        await findByText('Profit & loss');
        await waitFor(() => expect(pnlApi.cropPnl).toHaveBeenCalledWith('crop-1'));
    });
});

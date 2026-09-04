// Task 15 — the item detail screen used to render one `lastAdjustmentReason`
// string, the most recent reason, overwriting all history. This locks in that
// the real ledger (`GET /inventory/:id/movements`) now drives the section,
// newest first with a signed delta and age, and that a pre-ledger item (a
// reason but no rows) still falls back to that single line instead of
// showing nothing.
jest.mock('../../../api/inventory', () => {
    const actual = jest.requireActual('../../../api/inventory');
    return {
        ...actual,
        inventoryApi: {
            ...actual.inventoryApi,
            getById: jest.fn(),
            listMovements: jest.fn(),
        },
    };
});
// See src/screens/farms/__tests__/FarmDetailScreen.test.tsx: useFocusEffect
// needs a NavigationContainer the plain SafeAreaProvider wrapper doesn't
// provide, so it's swapped for a plain mount-effect under test.
jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useFocusEffect: (effect: () => void) => {
            const React = require('react');
            React.useEffect(effect, []);
        },
    };
});

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { InventoryDetailScreen } from '../InventoryDetailScreen';
import { inventoryApi } from '../../../api/inventory';
import { useMembershipStore } from '../../../store/membershipStore';

const mockedGetById = inventoryApi.getById as jest.Mock;
const mockedListMovements = inventoryApi.listMovements as jest.Mock;

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

const baseItem = {
    id: 'item-1',
    farmId: 'farm-1',
    name: 'Starter feed',
    category: 'feed',
    unit: 'kg',
    quantity: 40,
    reorderLevel: 10,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
};

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <InventoryDetailScreen
                navigation={navigation}
                route={{ params: { inventoryId: 'item-1', itemName: 'Starter feed' } }}
            />
        </SafeAreaProvider>,
    );

describe('InventoryDetailScreen — stock history', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useMembershipStore.setState({ memberships: [], loaded: true, loading: false } as any);
    });

    it('renders the ledger newest-first with a signed delta and reason, hiding the single-reason fallback', async () => {
        mockedGetById.mockResolvedValue({
            data: { ...baseItem, lastAdjustmentReason: 'Old note, pre-ledger' },
        });
        mockedListMovements.mockResolvedValue({
            data: [
                {
                    id: 'm-2',
                    inventoryId: 'item-1',
                    delta: -5,
                    reason: 'Fed pond 3',
                    createdById: 'u1',
                    feedRecordId: 'f1',
                    createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
                },
                {
                    id: 'm-1',
                    inventoryId: 'item-1',
                    delta: 20,
                    reason: 'Restocked from supplier',
                    createdById: 'u1',
                    feedRecordId: null,
                    createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
                },
            ],
        });

        const { findByText, queryByText } = renderScreen();

        expect(await findByText(/-5 kg/)).toBeTruthy();
        expect(await findByText(/Fed pond 3 · 2 h/)).toBeTruthy();
        expect(await findByText(/\+20 kg/)).toBeTruthy();
        expect(await findByText(/Restocked from supplier · 3 d/)).toBeTruthy();

        // The pre-ledger fallback must not show once real rows exist.
        expect(queryByText('Old note, pre-ledger')).toBeNull();
    });

    it('falls back to lastAdjustmentReason when the ledger is empty', async () => {
        mockedGetById.mockResolvedValue({
            data: { ...baseItem, lastAdjustmentReason: 'Adjusted before this shipped' },
        });
        mockedListMovements.mockResolvedValue({ data: [] });

        const { findByText } = renderScreen();

        expect(await findByText('Adjusted before this shipped')).toBeTruthy();
    });

    it('fetches the ledger for the item on load, via the same call that fetches the item itself', async () => {
        mockedGetById.mockResolvedValue({ data: { ...baseItem, lastAdjustmentReason: null } });
        mockedListMovements.mockResolvedValue({ data: [] });

        renderScreen();

        await waitFor(() => expect(mockedListMovements).toHaveBeenCalledTimes(1));
        expect(mockedListMovements).toHaveBeenCalledWith('item-1');
    });
});

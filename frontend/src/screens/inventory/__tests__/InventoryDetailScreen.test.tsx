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
            listPurchases: jest.fn(),
            adjustStock: jest.fn(),
        },
    };
});
jest.mock('../../../api/farms', () => ({
    farmsApi: {
        getAll: jest.fn().mockResolvedValue({
            data: [{ id: 'farm-1', name: 'North Farm' }, { id: 'farm-2', name: 'South Farm' }],
        }),
    },
}));
// One fixed key per test run: what matters is that ONE is sent, not its value.
jest.mock('expo-crypto', () => ({ randomUUID: () => 'idem-key-1' }));
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
import { Alert } from 'react-native';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { InventoryDetailScreen } from '../InventoryDetailScreen';
import { inventoryApi } from '../../../api/inventory';
import { useMembershipStore } from '../../../store/membershipStore';

const mockedGetById = inventoryApi.getById as jest.Mock;
const mockedListMovements = inventoryApi.listMovements as jest.Mock;
const mockedListPurchases = inventoryApi.listPurchases as jest.Mock;
const mockedAdjustStock = inventoryApi.adjustStock as jest.Mock;

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
        mockedListPurchases.mockResolvedValue({ data: [] });
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

// The complaint this batch answers: inventory was not visibly connected to
// ponds or to money. These lock in both ends of the link.
describe('InventoryDetailScreen — inventory ↔ pond ↔ money', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useMembershipStore.setState({
            memberships: [{ farmId: 'farm-1', role: 'owner', farm: { id: 'farm-1', name: 'North Farm' } }],
            loaded: true,
            loading: false,
        } as any);
        mockedGetById.mockResolvedValue({ data: { ...baseItem, farmIds: ['farm-1'] } });
        mockedListMovements.mockResolvedValue({ data: [] });
        mockedListPurchases.mockResolvedValue({ data: [] });
        mockedAdjustStock.mockResolvedValue({ data: {} });
    });

    it('names the pond a consumption fed', async () => {
        mockedListMovements.mockResolvedValue({
            data: [{
                id: 'm-1', inventoryId: 'item-1', delta: -5, reason: 'Feed log',
                createdById: 'u1', feedRecordId: 'f1',
                pondId: 'pond-1', pondName: 'Pond 3',
                createdAt: new Date(Date.now() - 3_600_000).toISOString(),
            }],
        });
        const { findByText } = renderScreen();
        expect(await findByText(/Feed log to Pond 3 · 1 h/)).toBeTruthy();
    });

    it('shows the expense a purchase wrote', async () => {
        mockedListPurchases.mockResolvedValue({
            data: [{ id: 't-1', farmId: 'farm-1', amount: 4500, category: 'inventory', transactionDate: '2026-09-01T00:00:00.000Z' }],
        });
        const { findByText } = renderScreen();
        expect(await findByText('Purchases')).toBeTruthy();
        expect(await findByText('₹4500.00')).toBeTruthy();
    });

    it('sends the cost, the bill-to farm and an idempotency key when adding purchased stock', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        const { findByText, getByLabelText } = renderScreen();

        fireEvent.press(await findByText('Adjust Stock'));
        // The add/reduce chooser is an Alert; drive its "Add Stock" button.
        const chooser = alertSpy.mock.calls.find((c) => c[0] === 'Adjust Stock');
        await act(async () => { (chooser![2] as any)[0].onPress(); });

        fireEvent.changeText(getByLabelText('Quantity'), '10');
        // Unit price fills the total — the farmer types whichever the invoice shows.
        fireEvent.changeText(getByLabelText('Unit price (₹)'), '45');
        expect(getByLabelText('Total cost').props.value).toBe('450');

        fireEvent.press(getByLabelText('Save'));

        await waitFor(() => expect(mockedAdjustStock).toHaveBeenCalled());
        expect(mockedAdjustStock).toHaveBeenCalledWith('item-1', 10, undefined, {
            idempotencyKey: 'idem-key-1',
            amount: 450,
            billToFarmId: 'farm-1',
        });
        // The farmer is told which money row was written, and for which farm.
        await waitFor(() =>
            expect(alertSpy.mock.calls.some((c) => String(c[1]).includes('₹450.00'))).toBe(true),
        );
    });

    it('sends no amount when reducing stock — consumption is not a second expense', async () => {
        const alertSpy = jest.spyOn(Alert, 'alert');
        const { findByText, getByLabelText, queryByLabelText } = renderScreen();

        fireEvent.press(await findByText('Adjust Stock'));
        const chooser = alertSpy.mock.calls.find((c) => c[0] === 'Adjust Stock');
        await act(async () => { (chooser![2] as any)[1].onPress(); }); // Reduce Stock

        // The cost fields do not exist on the reduce path at all.
        expect(queryByLabelText('Total cost')).toBeNull();

        fireEvent.changeText(getByLabelText('Quantity'), '4');
        fireEvent.press(getByLabelText('Save'));

        await waitFor(() => expect(mockedAdjustStock).toHaveBeenCalled());
        expect(mockedAdjustStock).toHaveBeenCalledWith('item-1', -4, undefined, {
            idempotencyKey: 'idem-key-1',
        });
    });

    it('refuses to guess which farm paid when the item is shared', async () => {
        mockedGetById.mockResolvedValue({ data: { ...baseItem, farmIds: ['farm-1', 'farm-2'] } });
        const alertSpy = jest.spyOn(Alert, 'alert');
        const { findByText, getByLabelText } = renderScreen();

        fireEvent.press(await findByText('Adjust Stock'));
        await act(async () => { (alertSpy.mock.calls.find((c) => c[0] === 'Adjust Stock')![2] as any)[0].onPress(); });

        fireEvent.changeText(getByLabelText('Quantity'), '10');
        fireEvent.changeText(getByLabelText('Total cost'), '900');
        fireEvent.press(getByLabelText('Save'));

        await waitFor(() =>
            expect(alertSpy.mock.calls.some((c) => String(c[1]).includes('which farm paid'))).toBe(true),
        );
        expect(mockedAdjustStock).not.toHaveBeenCalled();

        // Naming one lets it through, and that farm is what gets billed.
        fireEvent.press(await findByText('South Farm'));
        fireEvent.press(getByLabelText('Save'));
        await waitFor(() => expect(mockedAdjustStock).toHaveBeenCalled());
        expect(mockedAdjustStock.mock.calls[0][3]).toMatchObject({ billToFarmId: 'farm-2', amount: 900 });
    });
});

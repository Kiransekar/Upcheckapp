// Task 4 — the card that said "All fine".
//
// The defect: a farm's third stat fell through actNow -> watch -> the literal
// string "All fine", so a farm nobody had logged for a month rendered a green
// card claiming "All fine" in words, not just in colour. `roll.stale` (Task 3)
// now sits ahead of that fallthrough.
import React from 'react';
import { render, waitFor, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { HEALTH_COLOR } from '../../../utils/pondHealth';

jest.mock('../../../api/farms', () => ({
    farmsApi: { getAll: jest.fn() },
}));
jest.mock('../../../api/ponds', () => ({
    pondsApi: { getMine: jest.fn() },
}));
jest.mock('../../../api/alertCenter', () => ({
    alertCenterApi: { liveBriefing: jest.fn(), briefing: jest.fn() },
}));
jest.mock('../../../api/pondContext', () => ({
    pondContextApi: { forFarm: jest.fn() },
}));
jest.mock('@react-navigation/native', () => ({
    ...jest.requireActual('@react-navigation/native'),
    useFocusEffect: (cb: any) => require('react').useEffect(cb, [cb]),
}));

import { FarmsListScreen } from '../FarmsListScreen';
import { farmsApi } from '../../../api/farms';
import { pondsApi } from '../../../api/ponds';
import { alertCenterApi } from '../../../api/alertCenter';
import { pondContextApi } from '../../../api/pondContext';

const TEST_SAFE_AREA_METRICS = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const nav = { navigate: jest.fn(), goBack: jest.fn() };

// The farm cards on screen. Several TouchableOpacitys render (join-with-code
// button, header action, chips); a farm card is the one carrying styles.card's
// `borderLeftWidth`.
const farmCards = (utils: { UNSAFE_getAllByType: any }) =>
    utils.UNSAFE_getAllByType(TouchableOpacity).filter((el: any) => {
        const flat = StyleSheet.flatten(el.props.style);
        return flat && flat.borderLeftWidth != null;
    });

const renderScreen = () =>
    render(
        <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
            <FarmsListScreen navigation={nav} />
        </SafeAreaProvider>,
    );

const mockFarms = (farms: { id: string; name: string }[]) =>
    (farmsApi.getAll as jest.Mock).mockResolvedValue({ data: farms });

const mockPonds = (
    ponds: {
        id: string;
        farmId: string;
        name: string;
        activeCycleId?: string | null;
        status: string;
    }[],
) => (pondsApi.getMine as jest.Mock).mockResolvedValue({ data: ponds });

const mockBriefing = (items: unknown[]) => {
    (alertCenterApi.liveBriefing as jest.Mock).mockResolvedValue({ data: items });
    (alertCenterApi.briefing as jest.Mock).mockResolvedValue({ data: items });
};

const mockContexts = (
    contexts: { pondId: string; farmId: string; waterQuality: { recordedAt: string | null } }[],
) => {
    // pondContextApi.forFarm is called once per farm — hand back only the
    // contexts for that farm, same as the real per-farm endpoint would.
    (pondContextApi.forFarm as jest.Mock).mockImplementation((farmId: string) =>
        Promise.resolve({ data: contexts.filter((c) => c.farmId === farmId) }),
    );
};

describe('FarmsListScreen — freshness (Task 4)', () => {
    beforeEach(() => jest.clearAllMocks());

    it('does not claim "All fine" for a farm nobody has logged', async () => {
        // The defect this screen shipped with: a farm untouched for a month
        // rendered a green card reading "All fine" in words, not just colour.
        mockFarms([{ id: 'f1', name: 'Farm A' }]);
        mockPonds([{ id: 'p1', farmId: 'f1', name: 'Pond 01', activeCycleId: 'c1', status: 'active' }]);
        mockBriefing([]);
        mockContexts([
            { pondId: 'p1', farmId: 'f1', waterQuality: { recordedAt: '2026-01-01T00:00:00.000Z' } },
        ]);

        const utils = renderScreen();
        const { queryByText } = utils;

        // StatRow renders value and label as separate nodes, so assert on the
        // label and the absence of the claim — not on a joined string.
        //
        // Scoped to the CARD deliberately. 'Not updated' is also a Legend
        // swatch label, so a bare findByText('Not updated') matched two nodes:
        // it resolved against the always-present legend before the card's stat
        // had rendered, then threw "found multiple elements" once both were
        // there. That is an ambiguous query, not a slow one — no timeout fixes
        // it. `within(card)` names the node the test actually means.
        await waitFor(() => {
            const cards = farmCards(utils);
            expect(cards).toHaveLength(1);
            expect(within(cards[0]).getByText('Not updated')).toBeTruthy();
        });
        expect(queryByText('All fine')).toBeNull();
    });

    it('counts un-logged ponds across every farm in the header', async () => {
        mockFarms([{ id: 'f1', name: 'Farm A' }, { id: 'f2', name: 'Farm B' }]);
        mockPonds([
            { id: 'p1', farmId: 'f1', name: 'Pond 01', activeCycleId: 'c1', status: 'active' },
            { id: 'p2', farmId: 'f2', name: 'Pond 02', activeCycleId: 'c2', status: 'active' },
        ]);
        mockBriefing([]);
        mockContexts([
            { pondId: 'p1', farmId: 'f1', waterQuality: { recordedAt: '2026-01-01T00:00:00.000Z' } },
            { pondId: 'p2', farmId: 'f2', waterQuality: { recordedAt: '2026-01-01T00:00:00.000Z' } },
        ]);

        const { findByText } = renderScreen();
        await waitFor(() => expect(pondContextApi.forFarm).toHaveBeenCalledTimes(2));
        expect(await findByText(/2 not updated/)).toBeTruthy();
    });

    it('colours the card border slate, not green, for a farm that is only stale', async () => {
        // The left border is "readable from further away than any number on
        // it" (component comment) — the most prominent signal on the card.
        // A stale-only farm must not render it as the all-clear green.
        mockFarms([{ id: 'f1', name: 'Farm A' }]);
        mockPonds([{ id: 'p1', farmId: 'f1', name: 'Pond 01', activeCycleId: 'c1', status: 'active' }]);
        mockBriefing([]);
        mockContexts([
            { pondId: 'p1', farmId: 'f1', waterQuality: { recordedAt: '2026-01-01T00:00:00.000Z' } },
        ]);

        const utils = renderScreen();
        await utils.findByText('Farm A');

        const cards = farmCards(utils);
        expect(cards).toHaveLength(1);
        const flat = StyleSheet.flatten(cards[0].props.style);
        expect(flat.borderLeftColor).toBe(HEALTH_COLOR.stale);
    });
});

// The portfolio under the fold on Today. Everything above it answers "what
// needs me right now" and then stops, so on a calm day the screen ran out of
// things to say halfway down and read as empty.
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FarmOverview } from '../FarmOverview';
import type { PondWithHealth } from '../../../utils/pondHealth';

const pond = (id: string, health: PondWithHealth['health']): PondWithHealth => ({
    pond: { id, farmId: 'f1', name: id, displayName: id } as any,
    health,
    reason: null,
    context: { pondId: id, biomassKg: health === 'fallow' ? null : 500 } as any,
    freshness: { state: 'fresh', asOf: null, ageMs: null },
});

const farm = (id: string, name: string, rows: PondWithHealth[]) => ({ id, name, rows });

describe('FarmOverview', () => {
    it('shows each farm with how much is stocked and how much stock is in it', () => {
        const { getByText } = render(
            <FarmOverview
                farms={[farm('f1', 'North Farm', [pond('p1', 'fine'), pond('p2', 'fallow')])]}
                onOpenFarm={jest.fn()}
            />,
        );

        expect(getByText('Your farms')).toBeTruthy();
        expect(getByText(/1 of 2 stocked/)).toBeTruthy();
        // Only the stocked pond has an estimate, so the farm's biomass is its.
        expect(getByText(/500/)).toBeTruthy();
    });

    // "0 act now" is a reassurance nobody asked for, and it competes for
    // attention with the farm that genuinely has three.
    it('says all fine rather than printing a zero count', () => {
        const { getByText, queryByText } = render(
            <FarmOverview farms={[farm('f1', 'North Farm', [pond('p1', 'fine')])]} onOpenFarm={jest.fn()} />,
        );

        expect(getByText('All fine')).toBeTruthy();
        expect(queryByText(/0 act now/)).toBeNull();
    });

    it('surfaces a farm that needs acting on', () => {
        const { getByText } = render(
            <FarmOverview
                farms={[farm('f1', 'North Farm', [pond('p1', 'critical'), pond('p2', 'fine')])]}
                onOpenFarm={jest.fn()}
            />,
        );

        expect(getByText('1 act now')).toBeTruthy();
    });

    it('opens the farm it names', () => {
        const onOpenFarm = jest.fn();
        const { getByText } = render(
            <FarmOverview farms={[farm('f1', 'North Farm', [pond('p1', 'fine')])]} onOpenFarm={onOpenFarm} />,
        );

        fireEvent.press(getByText('North Farm'));

        expect(onOpenFarm).toHaveBeenCalledWith('f1', 'North Farm');
    });

    // A farm whose ponds have not loaded has nothing to roll up, and a row of
    // dashes is not an overview — better to render nothing than furniture.
    it('renders nothing at all when no farm has ponds', () => {
        const { toJSON } = render(
            <FarmOverview farms={[farm('f1', 'North Farm', [])]} onOpenFarm={jest.fn()} />,
        );

        expect(toJSON()).toBeNull();
    });
});

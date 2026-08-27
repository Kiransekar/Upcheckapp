// Molting status on Today. It was dropped in the redesign and the user asked
// for it back: shrimp are soft-shelled around the new and full moon, so a
// molting pond is fed less and never handled or harvested. That is a decision
// about today, which is what the screen is for.
//
// The row earns its weight rather than being given it — loud inside the
// window, one quiet line of context outside it.
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { LunarRow } from '../LunarRow';
import { moonPhase } from '../../../features/moonPhase';

/** Walk a synodic month and pick a date the engine agrees is each kind. */
const findDay = (want: boolean): Date => {
    const start = new Date('2026-01-01T12:00:00.000Z');
    for (let i = 0; i < 40; i++) {
        const d = new Date(start.getTime() + i * 86_400_000);
        if (moonPhase(d).isMoltingWindow === want) return d;
    }
    throw new Error(`no ${want ? 'molting' : 'quiet'} day found in a synodic month`);
};

const MOLTING = findDay(true);
const QUIET = findDay(false);

describe('LunarRow', () => {
    it('names the consequence inside the molting window, not just the phase', () => {
        const { getByText } = render(<LunarRow date={MOLTING} />);

        expect(getByText('Molting window')).toBeTruthy();
        // The point is what to DO about it — a farmer who only learns it is a
        // full moon has learned nothing they can act on.
        expect(getByText(/Feed less/)).toBeTruthy();
    });

    it('is quiet context on an ordinary day', () => {
        const { queryByText } = render(<LunarRow date={QUIET} />);

        expect(queryByText('Molting window')).toBeNull();
        // Still shows the phase, just without the warning treatment.
        expect(queryByText(/illuminated/i)).toBeTruthy();
    });

    it('opens the lunar screen when given a handler', () => {
        const onPress = jest.fn();
        const { getByRole } = render(<LunarRow date={QUIET} onPress={onPress} />);

        fireEvent.press(getByRole('button'));

        expect(onPress).toHaveBeenCalled();
    });

    // The emoji is the phase — no icon font draws a waxing gibbous — so a
    // screen reader has to be told the name instead of the glyph.
    it('announces the phase by name rather than reading out the glyph', () => {
        const { getByLabelText } = render(<LunarRow date={MOLTING} />);

        expect(getByLabelText(/Feed less/)).toBeTruthy();
    });
});

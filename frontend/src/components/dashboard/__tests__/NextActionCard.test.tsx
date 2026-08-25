// "Do this first" is the redesign's centrepiece: Home used to open on a LIST of
// alerts, which asks the farmer to rank severity, pond and farm before they can
// act. This card does the ranking and states ONE action.
//
// The ranking is the part worth pinning — if it picks the wrong item, the whole
// screen points the farmer at the wrong pond.
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { NextActionCard, rankActions } from '../NextActionCard';
import type { BriefingItem } from '../../../api/alertCenter';

const item = (over: Partial<BriefingItem> = {}): BriefingItem => ({
    pondId: 'pond-1',
    topTitle: 'Start the aerators in Pond 04',
    topSeverity: 'critical',
    source: 'engine',
    steps: ['Oxygen has fallen to 2.8 mg/L.'],
    alertCount: 1,
    ...over,
});

describe('rankActions', () => {
    it('puts a critical ahead of a watch, whatever the order in', () => {
        const ranked = rankActions([
            item({ topTitle: 'watch', topSeverity: 'watch' }),
            item({ topTitle: 'critical', topSeverity: 'critical' }),
        ]);
        expect(ranked[0].topTitle).toBe('critical');
    });

    it('puts a watch ahead of an info', () => {
        const ranked = rankActions([
            item({ topTitle: 'info', topSeverity: 'info' }),
            item({ topTitle: 'watch', topSeverity: 'watch' }),
        ]);
        expect(ranked[0].topTitle).toBe('watch');
    });

    it('breaks ties on how many alerts back the item', () => {
        const ranked = rankActions([
            item({ topTitle: 'one', topSeverity: 'critical', alertCount: 1 }),
            item({ topTitle: 'three', topSeverity: 'critical', alertCount: 3 }),
        ]);
        expect(ranked[0].topTitle).toBe('three');
    });

    it('does not mutate the array it was given', () => {
        const input = [
            item({ topTitle: 'watch', topSeverity: 'watch' }),
            item({ topTitle: 'critical', topSeverity: 'critical' }),
        ];
        rankActions(input);
        expect(input[0].topTitle).toBe('watch');
    });
});

describe('NextActionCard', () => {
    const noop = () => undefined;

    it('states the single most urgent action, with why it matters', () => {
        const { getByText } = render(
            <NextActionCard
                items={[
                    item({ topTitle: 'Cut feed in Pond 07', topSeverity: 'watch' }),
                    item({ topTitle: 'Start the aerators in Pond 04', topSeverity: 'critical' }),
                ]}
                onDone={noop}
                onLater={noop}
            />,
        );

        expect(getByText('Start the aerators in Pond 04')).toBeTruthy();
        expect(getByText('Oxygen has fallen to 2.8 mg/L.')).toBeTruthy();
        // The less urgent one is NOT shown here — it belongs in the "then" list.
        expect(() => getByText('Cut feed in Pond 07')).toThrow();
    });

    it('shows the farm each action came from — Home spans every farm', () => {
        const { getByText } = render(
            <NextActionCard
                items={[item()]}
                farmNameForPond={() => 'Kakinada East'}
                onDone={noop}
                onLater={noop}
            />,
        );
        expect(getByText('Kakinada East')).toBeTruthy();
    });

    it('counts how many are waiting behind it', () => {
        const { getByText } = render(
            <NextActionCard items={[item(), item({ pondId: 'p2' }), item({ pondId: 'p3' })]} onDone={noop} onLater={noop} />,
        );
        expect(getByText('1 of 3')).toBeTruthy();
    });

    it('omits the counter when it is the only thing to do', () => {
        const { queryByText } = render(
            <NextActionCard items={[item()]} onDone={noop} onLater={noop} />,
        );
        expect(queryByText(/1 of/)).toBeNull();
    });

    it('renders nothing at all when there is nothing urgent', () => {
        // "All clear" is a RESULT, not this card's empty state — the caller
        // decides what calm looks like.
        const { toJSON } = render(<NextActionCard items={[]} onDone={noop} onLater={noop} />);
        expect(toJSON()).toBeNull();
    });

    it('reports the acted-on item to both handlers', () => {
        const onDone = jest.fn();
        const onLater = jest.fn();
        const critical = item({ topTitle: 'Start the aerators in Pond 04' });

        const { getByText, rerender } = render(
            <NextActionCard items={[critical]} onDone={onDone} onLater={onLater} />,
        );
        fireEvent.press(getByText('Done it'));
        expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ topTitle: critical.topTitle }));

        rerender(<NextActionCard items={[critical]} onDone={onDone} onLater={onLater} />);
        fireEvent.press(getByText('Later'));
        expect(onLater).toHaveBeenCalledWith(expect.objectContaining({ topTitle: critical.topTitle }));
    });
});

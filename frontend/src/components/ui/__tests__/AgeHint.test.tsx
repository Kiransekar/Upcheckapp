import React from 'react';
import { render } from '@testing-library/react-native';
import { AgeHint, FarmAgeHint } from '../SessionHint';
import type { PondWithHealth } from '../../../utils/pondHealth';

const NOW = new Date('2026-09-05T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const H = 3_600_000;
const D = 24 * H;

const row = (loggedAt: string | null, fedAt: string | null, state: any = 'fresh'): PondWithHealth =>
    ({
        pond: { id: 'p' } as any,
        health: 'fine',
        reason: null,
        context: { lastFeedAt: fedAt } as any,
        freshness: { state, asOf: loggedAt, ageMs: null },
    }) as PondWithHealth;

describe('AgeHint', () => {
    it('puts both ages on one line', () => {
        const { getByTestId } = render(<AgeHint loggedAt={ago(3 * D)} fedAt={ago(6 * H)} now={NOW} />);
        expect(getByTestId('age-hint').props.children).toBe('Logged 3 d · Fed 6 h');
    });

    /**
     * `lastFeedAt` is MAX(feed.recordedAt) GROUPED BY crop on the server, so a
     * pond with no active crop always reports null. Rendering that as an age
     * would tell a farmer a pond had just been fed when nothing has been.
     */
    it('says "never" for a missing timestamp rather than inventing an age', () => {
        const { getByTestId } = render(<AgeHint loggedAt={null} fedAt={null} now={NOW} />);
        expect(getByTestId('age-hint').props.children).toBe('Never logged · Never fed');
    });
});

describe('FarmAgeHint', () => {
    it('reports the OLDEST pond on the farm, not the newest', () => {
        const { getByTestId } = render(
            <FarmAgeHint rows={[row(ago(1 * H), ago(1 * H)), row(ago(5 * D), ago(2 * D), 'noData')]} now={NOW} />,
        );
        expect(getByTestId('age-hint').props.children).toBe('Logged 5 d · Fed 2 d');
    });

    it('lets one never-logged pond win outright — nothing is older than never', () => {
        const { getByTestId } = render(
            <FarmAgeHint rows={[row(ago(2 * H), ago(2 * H)), row(null, null, 'noData')]} now={NOW} />,
        );
        expect(getByTestId('age-hint').props.children).toBe('Never logged · Never fed');
    });

    it('renders nothing for a farm whose ponds have not loaded', () => {
        const { queryByTestId } = render(<FarmAgeHint rows={[]} now={NOW} />);
        expect(queryByTestId('age-hint')).toBeNull();
    });
});

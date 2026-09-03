import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { LogProgressCard } from '../LogProgressCard';
import type { PondContext } from '../../../api/pondContext';

const ctx = (pondId: string, farmId: string, recordedAt: string | null): PondContext =>
    ({
        pondId, farmId, cropId: 'c1', species: null, areaM2: null,
        installedAeratorHp: null, doc: 10,
        waterQuality: recordedAt
            ? ({ dissolvedOxygen: 6, ph: 8, temperature: 30, salinity: 15,
                 ammonia: null, nitrite: null, nitrate: null, alkalinity: null,
                 recordedAt, chemistryAsOf: null } as PondContext['waterQuality'])
            : null,
        freeAmmoniaMgL: null, abwG: null, livePopulation: null, biomassKg: null,
        crop: null, cumulativeFeedKg: null, runningFcr: null,
        latestTrayResidue: null, lastFeedAt: null, lastTrayAt: null,
        samplingAt: null,
        confidence: { score: 0, band: 'low', missing: [], stale: [] },
    }) as PondContext;

const names = { farmNames: { f1: 'North Farm', f2: 'South Farm' }, pondNames: { a: 'P01', b: 'P02', c: 'P03' } };

describe('LogProgressCard', () => {
    const now = new Date('2026-09-02T09:00:00');

    it('shows overall progress so the farmer sees it on open', () => {
        const { getByText } = render(
            <LogProgressCard
                now={now}
                contexts={[
                    ctx('a', 'f1', '2026-09-02T07:00:00'),
                    ctx('b', 'f1', null),
                    ctx('c', 'f2', '2026-09-02T07:30:00'),
                ]}
                {...names}
            />,
        );
        expect(getByText('2/3')).toBeTruthy();
    });

    it('breaks progress down per farm when expanded', () => {
        const { getByText, getByTestId } = render(
            <LogProgressCard
                now={now}
                contexts={[ctx('a', 'f1', '2026-09-02T07:00:00'), ctx('b', 'f1', null)]}
                {...names}
            />,
        );
        fireEvent.press(getByTestId('log-progress-toggle'));
        expect(getByText('North Farm')).toBeTruthy();
        expect(getByText('1/2')).toBeTruthy();
    });

    it('names the ponds still outstanding rather than only counting them', () => {
        const { getByTestId, getByText } = render(
            <LogProgressCard now={now} contexts={[ctx('b', 'f1', null)]} {...names} />,
        );
        fireEvent.press(getByTestId('log-progress-toggle'));
        expect(getByText('P02')).toBeTruthy();
    });

    it('renders nothing when the account has no active ponds', () => {
        const { queryByTestId } = render(
            <LogProgressCard now={now} contexts={[]} {...names} />,
        );
        expect(queryByTestId('log-progress-card')).toBeNull();
    });
});

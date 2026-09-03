import React from 'react';
import { render } from '@testing-library/react-native';
import { SessionHint } from '../SessionHint';
import type { PondContext } from '../../../api/pondContext';

const ctx = (over: Partial<PondContext>): PondContext =>
    ({
        pondId: 'p1', farmId: 'f1', cropId: 'c1', species: null, areaM2: null,
        installedAeratorHp: null, doc: 10, waterQuality: null,
        freeAmmoniaMgL: null, abwG: null, livePopulation: null, biomassKg: null,
        crop: null, cumulativeFeedKg: null, runningFcr: null,
        latestTrayResidue: null, lastFeedAt: null, lastTrayAt: null,
        samplingAt: null,
        confidence: { score: 0, band: 'low', missing: [], stale: [] },
        ...over,
    }) as PondContext;

const wqAt = (recordedAt: string) =>
    ({ dissolvedOxygen: 6, ph: 8, temperature: 30, salinity: 15,
       ammonia: null, nitrite: null, nitrate: null, alkalinity: null,
       recordedAt, chemistryAsOf: null }) as PondContext['waterQuality'];

describe('SessionHint', () => {
    const now = new Date('2026-09-02T09:00:00');

    it('shows both done when the pond was logged and fed this session', () => {
        const { getByTestId } = render(
            <SessionHint now={now} ctx={ctx({ waterQuality: wqAt('2026-09-02T07:00:00'), lastFeedAt: '2026-09-02T07:30:00' })} />,
        );
        expect(getByTestId('session-hint-logged').props.accessibilityState.checked).toBe(true);
        expect(getByTestId('session-hint-fed').props.accessibilityState.checked).toBe(true);
    });

    it('shows logged but not fed', () => {
        const { getByTestId } = render(
            <SessionHint now={now} ctx={ctx({ waterQuality: wqAt('2026-09-02T07:00:00'), lastFeedAt: null })} />,
        );
        expect(getByTestId('session-hint-logged').props.accessibilityState.checked).toBe(true);
        expect(getByTestId('session-hint-fed').props.accessibilityState.checked).toBe(false);
    });

    it('shows neither when nothing happened this session', () => {
        const { getByTestId } = render(
            <SessionHint now={now} ctx={ctx({ waterQuality: null, lastFeedAt: null })} />,
        );
        expect(getByTestId('session-hint-logged').props.accessibilityState.checked).toBe(false);
        expect(getByTestId('session-hint-fed').props.accessibilityState.checked).toBe(false);
    });

    // Yesterday's work must not read as today's.
    it('does not count yesterday as this session', () => {
        const { getByTestId } = render(
            <SessionHint now={now} ctx={ctx({ waterQuality: wqAt('2026-09-01T07:00:00'), lastFeedAt: '2026-09-01T07:30:00' })} />,
        );
        expect(getByTestId('session-hint-logged').props.accessibilityState.checked).toBe(false);
        expect(getByTestId('session-hint-fed').props.accessibilityState.checked).toBe(false);
    });
});

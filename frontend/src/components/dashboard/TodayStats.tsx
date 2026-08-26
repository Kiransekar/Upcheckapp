import React from 'react';
import { useTranslation } from 'react-i18next';

import { StatRow, type Stat } from '../ui/StatRow';

/**
 * The figures that close artboard 1b: how much stock is in the water, and how
 * many of the team are on duty.
 *
 * The drawing has a third — "Logs today 41 / 72". Nothing reports it. There is
 * no endpoint that counts today's expected versus completed logs across farms,
 * and computing it client-side would mean fetching every pond's routine for
 * every farm on the busiest screen in the app. It is left out rather than
 * approximated, for the same reason it was left off artboard 4a: a plausible
 * number a farmer might act on is worse than an absent one.
 */

export interface TodayStatsProps {
    /** Summed standing biomass across visible farms; null when unsampled. */
    biomassKg: number | null;
    /** Checked in today / total members. Omitted for someone who cannot see it. */
    onDuty: { present: number; total: number } | null;
}

export const TodayStats: React.FC<TodayStatsProps> = ({ biomassKg, onDuty }) => {
    const { t } = useTranslation();

    const stats: Stat[] = [];
    if (biomassKg != null) {
        stats.push({
            value: Math.round(biomassKg).toLocaleString('en-IN'),
            label: t('farms.biomassKg'),
        });
    }
    if (onDuty) {
        stats.push({
            value: String(onDuty.present),
            unit: ` / ${onDuty.total}`,
            label: t('home.onDuty'),
        });
    }

    // One figure does not make a band; it makes a stray number under a list.
    if (stats.length < 2) return null;

    return <StatRow stats={stats} divider />;
};

export default TodayStats;

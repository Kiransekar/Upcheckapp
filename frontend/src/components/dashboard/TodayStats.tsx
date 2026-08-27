import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { theme } from '../../theme';

import { StatRow, type Stat } from '../ui/StatRow';

/**
 * The three figures that close artboard 1b: how much stock is in the water,
 * how much of today's logging is done, and how many of the team are on duty.
 *
 * "Logs today" counts PONDS, not log entries — a pond counts as logged once
 * anything has been recorded against it today (feed, water, or a sampling).
 * The drawing reads "41 / 72", three-per-pond across 24 ponds, but the only
 * thing the pond-context snapshot carries is each pond's LAST reading, so a
 * per-window count would have to be invented. Counting ponds is a real number
 * from data Home already holds, and it answers the same question — how much of
 * today's round is still outstanding.
 */

export interface TodayStatsProps {
    /** Summed standing biomass across the farms in scope; null when unsampled. */
    biomassKg: number | null;
    /** Ponds logged today / ponds expected to be. */
    logsToday: { done: number; total: number } | null;
    /** Checked in today / total members. Omitted for someone who cannot see it. */
    onDuty: { present: number; total: number } | null;
}

export const TodayStats: React.FC<TodayStatsProps> = ({ biomassKg, logsToday, onDuty }) => {
    const { t } = useTranslation();

    const stats: Stat[] = [];
    if (biomassKg != null) {
        stats.push({
            value: Math.round(biomassKg).toLocaleString('en-IN'),
            label: t('farms.biomassKg'),
        });
    }
    if (logsToday && logsToday.total > 0) {
        stats.push({
            value: String(logsToday.done),
            unit: ` / ${logsToday.total}`,
            label: t('home.logsToday'),
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

    // `lg` because this is the screen-level band the artboard draws at the
    // bottom of Today, not a figure row inside a card — the numbers are meant
    // to be readable at arm's length. The rule above fences it off from the
    // task rows, which carry their own top borders.
    return (
        <View style={styles.band}>
            <StatRow stats={stats} size="lg" divider />
        </View>
    );
};

const styles = StyleSheet.create({
    band: {
        borderTopWidth: 1,
        borderTopColor: theme.roles.light.borderDefault,
        marginTop: theme.spacing[3],
    },
});

export default TodayStats;

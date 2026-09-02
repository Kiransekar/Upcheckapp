import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';
import { theme } from '../../theme';
import { progressFor } from '../../features/logProgress';
import type { PondContext } from '../../api/pondContext';

/**
 * "What is logged, what is left" — for the current slot, overall / per farm /
 * per pond, on the screen the farmer opens first.
 *
 * Reads the contexts the Today query already fetched (see HomeScreen.tsx) and
 * `progressFor` — the ONLY definition of "done" (src/features/logProgress.ts).
 * This component computes no rule of its own: SessionHint and the reminders
 * read the same function, so all three surfaces agree.
 *
 * Outstanding ponds are NAMED here, not just counted — "1 remaining" gives a
 * farmer nothing to act on; "P02" does.
 */
export interface LogProgressCardProps {
    contexts: PondContext[];
    farmNames: Record<string, string>;
    pondNames: Record<string, string>;
    /** Deterministic clock for tests; defaults to the real time. */
    now?: Date;
}

const Bar = ({ pct }: { pct: number }) => (
    <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.max(0, Math.min(100, pct))}%` }]} />
    </View>
);

export const LogProgressCard: React.FC<LogProgressCardProps> = ({
    contexts,
    farmNames,
    pondNames,
    now,
}) => {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);

    if (contexts.length === 0) return null;

    const clock = now ?? new Date();
    const progress = progressFor(contexts, clock);
    const overallPct = (progress.overall.done / Math.max(1, progress.overall.total)) * 100;

    // Farm order follows first appearance in `contexts` — stable, and it
    // matches the order the Today screen already lists farms in.
    const farmIds: string[] = [];
    for (const ctx of contexts) {
        if (!farmIds.includes(ctx.farmId)) farmIds.push(ctx.farmId);
    }

    return (
        <Card style={styles.card} testID="log-progress-card">
            <TouchableOpacity
                testID="log-progress-toggle"
                style={styles.header}
                onPress={() => setExpanded((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={t('home.logProgressTitle', 'Log progress')}
            >
                <View style={styles.headerText}>
                    <Text style={styles.title}>{t('home.logProgressTitle', 'Log progress')}</Text>
                    {/* Hidden once expanded — it would otherwise repeat a
                        farm's own total verbatim whenever there is only one
                        farm in scope, and the breakdown below already sums to
                        it. */}
                    {!expanded && (
                        <Text style={styles.count}>{`${progress.overall.done}/${progress.overall.total}`}</Text>
                    )}
                </View>
                <Icon
                    name="expand_more"
                    size={22}
                    color={theme.roles.light.textTertiary}
                    style={expanded ? styles.chevronOpen : undefined}
                />
            </TouchableOpacity>
            <Bar pct={overallPct} />

            {expanded &&
                farmIds.map((farmId) => {
                    const farm = progress.byFarm[farmId] ?? { done: 0, total: 0 };
                    const farmPct = (farm.done / Math.max(1, farm.total)) * 100;
                    const outstandingPondIds = contexts
                        .filter((ctx) => ctx.farmId === farmId && !progress.byPond[ctx.pondId])
                        .map((ctx) => ctx.pondId);

                    return (
                        <View key={farmId} style={styles.farmRow}>
                            <View style={styles.headerText}>
                                <Text style={styles.farmName}>{farmNames[farmId] ?? farmId}</Text>
                                <Text style={styles.count}>{`${farm.done}/${farm.total}`}</Text>
                            </View>
                            <Bar pct={farmPct} />
                            {outstandingPondIds.length > 0 && (
                                <View style={styles.outstandingRow}>
                                    <Text style={styles.outstandingLabel}>
                                        {t('home.logProgressOutstanding', 'Still to log')}
                                    </Text>
                                    {outstandingPondIds.map((pondId) => (
                                        <View key={pondId} style={styles.pondChip}>
                                            <Text style={styles.pondChipText}>
                                                {pondNames[pondId] ?? pondId}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    );
                })}
        </Card>
    );
};

const styles = StyleSheet.create({
    card: { marginBottom: theme.spacing[6] },
    header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
    headerText: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
    title: { ...theme.typeScale.labelLarge, color: theme.roles.light.textPrimary, fontWeight: '600' },
    count: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary },
    chevronOpen: { transform: [{ rotate: '180deg' }] },
    barTrack: {
        height: 6,
        borderRadius: theme.radius.full,
        backgroundColor: theme.roles.light.surfaceVariant,
        marginTop: theme.spacing[2],
        overflow: 'hidden',
    },
    barFill: {
        height: '100%',
        borderRadius: theme.radius.full,
        backgroundColor: theme.roles.light.primary,
    },
    farmRow: {
        marginTop: theme.spacing[4],
        paddingTop: theme.spacing[3],
        borderTopWidth: 1,
        borderTopColor: theme.roles.light.borderDefault,
    },
    farmName: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textPrimary, fontWeight: '600' },
    outstandingRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: theme.spacing[1.5],
        marginTop: theme.spacing[2],
    },
    outstandingLabel: { ...theme.typeScale.caption, color: theme.roles.light.textTertiary },
    pondChip: {
        paddingHorizontal: theme.spacing[2],
        height: theme.tokens.chip.height,
        borderRadius: theme.radius.full,
        backgroundColor: theme.roles.light.surfaceVariant,
        justifyContent: 'center',
    },
    pondChipText: { ...theme.typeScale.labelSmall, color: theme.roles.light.textSecondary },
});

export default LogProgressCard;

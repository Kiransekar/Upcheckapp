import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

import { theme } from '../../theme';
import { Icon } from '../ui/Icon';
import { SectionHeader } from '../ui/SectionHeader';
import {
    HEALTH_COLOR,
    rollUpFarm,
    type PondHealth,
    type PondWithHealth,
} from '../../utils/pondHealth';

/**
 * The portfolio, under the fold on Today.
 *
 * Everything above this answers "what needs me right now" and then stops — so
 * on a calm day the screen ran out of things to say halfway down and read as
 * empty. This is the other half of the question: what does the whole business
 * look like, for the farmer who scrolls past the decisions to check.
 *
 * It does not repeat the hero. The hero names ONE pond and what to do about
 * it; this names every farm and its shape — how much is stocked, how much
 * stock is in the water, and how many ponds are shouting. A farm that is
 * entirely fine still says something here, which is the point.
 *
 * Costs no request. `rollUpFarm` runs over the pond contexts Today already
 * fetches for the stat band and used to throw away.
 */

export interface FarmOverviewRow {
    id: string;
    name: string;
    rows: PondWithHealth[];
}

export interface FarmOverviewProps {
    farms: FarmOverviewRow[];
    onOpenFarm: (farmId: string, farmName: string) => void;
    /** Opens the Farm tab — the full list with its legend and filters. */
    onSeeAll?: () => void;
}

const kg = (n: number) => Math.round(n).toLocaleString('en-IN');

export const FarmOverview: React.FC<FarmOverviewProps> = ({
    farms,
    onOpenFarm,
    onSeeAll,
}) => {
    const { t } = useTranslation();
    // A farm whose ponds have not loaded has nothing to roll up, and a row of
    // dashes is not an overview.
    const withPonds = farms.filter((f) => f.rows.length > 0);
    if (withPonds.length === 0) return null;

    return (
        <>
            <SectionHeader
                label={t('home.overviewTitle')}
                actionLabel={onSeeAll ? t('home.viewAll') : undefined}
                onAction={onSeeAll}
            />
            {withPonds.map((farm) => {
                const roll = rollUpFarm(farm.rows);
                const trouble = roll.actNow > 0 || roll.watch > 0;
                return (
                    <TouchableOpacity
                        key={farm.id}
                        style={styles.row}
                        onPress={() => onOpenFarm(farm.id, farm.name)}
                        accessibilityRole="button"
                    >
                        <View style={styles.text}>
                            <Text style={styles.name} numberOfLines={1}>
                                {farm.name}
                            </Text>
                            <Text style={styles.meta} numberOfLines={1}>
                                {[
                                    t('home.overviewStocked', {
                                        stocked: roll.stocked,
                                        total: roll.total,
                                    }),
                                    roll.biomassKg != null
                                        ? `${kg(roll.biomassKg)} ${t('farms.biomassKg')}`
                                        : null,
                                ]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </Text>
                            <PondStrip strip={roll.strip} />
                        </View>

                        {/* The count only appears when it is not zero. "0 act
                            now" is a reassurance nobody asked for, and it
                            competes with the farm that has three. */}
                        {trouble ? (
                            <Text
                                style={[
                                    styles.badge,
                                    {
                                        color:
                                            roll.actNow > 0
                                                ? theme.roles.light.dangerText
                                                : theme.roles.light.warningText,
                                    },
                                ]}
                            >
                                {roll.actNow > 0
                                    ? t('farms.actNowCount', { pl: roll.actNow })
                                    : t('farms.watchCount', { pl: roll.watch })}
                            </Text>
                        ) : (
                            <Text style={styles.fine}>{t('farms.allFine')}</Text>
                        )}
                        <Icon name="chevron_right" size={20} color={c.textTertiary} />
                    </TouchableOpacity>
                );
            })}
        </>
    );
};

/** One bar per pond, worst first — a farm's shape in a single glance. */
const PondStrip: React.FC<{ strip: PondHealth[] }> = ({ strip }) => {
    if (!strip.length) return null;
    return (
        <View style={styles.strip}>
            {strip.map((health, i) => (
                <View key={i} style={[styles.stripBar, { backgroundColor: HEALTH_COLOR[health] }]} />
            ))}
        </View>
    );
};

const c = theme.roles.light;

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2.5],
        borderTopWidth: 1,
        borderTopColor: c.surfaceVariant,
        backgroundColor: c.surface,
        minHeight: 60,
    },
    text: { flex: 1, minWidth: 0, gap: 2 },
    name: { ...theme.typeScale.labelLarge, fontSize: 15, color: c.textPrimary },
    meta: { ...theme.typeScale.bodySmall, color: c.textTertiary },
    badge: { ...theme.typeScale.labelMedium, fontSize: 12 },
    fine: { ...theme.typeScale.bodySmall, fontSize: 11, color: c.textDisabled },
    strip: { flexDirection: 'row', gap: 2, marginTop: 4 },
    stripBar: { flex: 1, height: 4, borderRadius: 2, maxWidth: 28 },
});

export default FarmOverview;

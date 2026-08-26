import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

import { theme } from '../../theme';
import { SectionHeader } from '../ui/SectionHeader';
import type { BriefingItem, AlertSeverity } from '../../api/alertCenter';

/**
 * "Then" — everything that needs doing after the one thing in the hero.
 *
 * The old Home showed a "Needs Attention" card: a flat list of one-line alert
 * titles, all styled identically, with no farm and no reason. A farmer had to
 * open each one to find out whether it mattered. Artboard 1b makes each row
 * carry its own severity as a coloured edge, names the farm, and states the
 * measurement that triggered it — so the list can be triaged without tapping.
 *
 * It renders NOTHING when empty. "All clear" is the caller's decision, because
 * on Home an empty list means something different depending on whether the
 * farmer has any ponds at all.
 */

const SEVERITY_COLOR: Record<AlertSeverity, string> = {
    critical: theme.roles.light.dangerBorder,
    watch: theme.roles.light.warningBorder,
    info: theme.roles.light.borderStrong,
};

export interface ThenListProps {
    /** Already ranked, and already excluding whatever the hero is showing. */
    items: BriefingItem[];
    farmNameForPond?: (pondId: string | null) => string | undefined;
    onOpen: (item: BriefingItem) => void;
}

export const ThenList: React.FC<ThenListProps> = ({ items, farmNameForPond, onOpen }) => {
    const { t } = useTranslation();
    if (items.length === 0) return null;

    return (
        <>
            <SectionHeader label={t('home.then')} />
            {items.map((item, i) => {
                const farm = farmNameForPond?.(item.pondId);
                // `steps[0]` is the engine's plain-language reason — the number
                // that actually triggered this, not a restatement of the title.
                const why = item.steps?.[0];
                const meta = [farm, why].filter(Boolean).join(' · ');
                return (
                    <TouchableOpacity
                        key={item.pondId ?? `${item.topTitle}-${i}`}
                        style={styles.row}
                        onPress={() => onOpen(item)}
                        accessibilityRole="button"
                    >
                        <View
                            style={[styles.severity, { backgroundColor: SEVERITY_COLOR[item.topSeverity] }]}
                        />
                        <View style={styles.text}>
                            <Text style={styles.title} numberOfLines={1}>
                                {item.topTitle}
                            </Text>
                            {!!meta && (
                                <Text style={styles.meta} numberOfLines={1}>
                                    {meta}
                                </Text>
                            )}
                        </View>
                        <Text style={styles.open}>{t('home.open')}</Text>
                    </TouchableOpacity>
                );
            })}
        </>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingRight: theme.spacing[5],
        paddingVertical: theme.spacing[2.5],
        borderTopWidth: 1,
        borderTopColor: theme.roles.light.surfaceVariant,
        backgroundColor: theme.roles.light.surface,
        minHeight: 56,
    },
    // A 4px edge rather than a dot: at arm's length outdoors a dot reads as
    // decoration, an edge reads as a stripe down the list.
    severity: { width: 4, alignSelf: 'stretch' },
    text: { flex: 1, minWidth: 0 },
    title: { ...theme.typeScale.labelLarge, fontSize: 15, color: theme.roles.light.textPrimary },
    meta: { ...theme.typeScale.bodySmall, color: theme.roles.light.textTertiary },
    open: { ...theme.typeScale.labelMedium, color: theme.roles.light.textLink },
});

export default ThenList;

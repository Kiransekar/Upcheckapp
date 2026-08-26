import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../theme';

/**
 * A row of three or four equal-width figures — "8/9 Stocked · 3,925 Biomass kg
 * · 2 Act now". Ponds, Pond, Daily feed and Simulation result all open on one.
 *
 * Equal flex, not content width: the columns must line up between two stacked
 * StatRows and between one farm card and the next, so a farmer scanning down
 * the list compares like with like without re-reading the captions.
 */

export interface Stat {
    /** The figure. Rendered in DM Mono so digits align down the column. */
    value: string;
    /** Smaller suffix inside the value — "/9", "%", "kg". */
    unit?: string | null;
    /** Uppercase caption beneath. */
    label: string;
    /** Severity colour for the value; the caption follows for danger/warning. */
    tone?: 'default' | 'danger' | 'warning' | 'success';
    /** Renders `value` as words rather than a figure ("All fine"). */
    text?: boolean;
}

export interface StatRowProps {
    stats: Stat[];
    /** `lg` (24px) for a screen-level band, `md` (18px) inside a card. */
    size?: 'md' | 'lg';
    divider?: boolean;
}

const TONE: Record<NonNullable<Stat['tone']>, string> = {
    default: theme.roles.light.textPrimary,
    danger: theme.roles.light.dangerText,
    warning: theme.roles.light.warningText,
    success: theme.roles.light.successText,
};

export const StatRow: React.FC<StatRowProps> = ({ stats, size = 'md', divider = false }) => (
    <View style={[styles.row, divider && styles.divider]}>
        {stats.map((s) => {
            const color = TONE[s.tone ?? 'default'];
            // A caption only takes the severity colour when the figure is a
            // problem — colouring every caption would make none of them read.
            const captionColor =
                s.tone === 'danger' || s.tone === 'warning' ? color : theme.roles.light.textDisabled;
            return (
                <View key={s.label} style={styles.cell}>
                    <Text
                        style={[
                            s.text ? styles.textValue : styles.value,
                            size === 'lg' && !s.text && styles.valueLg,
                            { color },
                        ]}
                        numberOfLines={1}
                    >
                        {s.value}
                        {!!s.unit && (
                            <Text style={[styles.unit, size === 'lg' && styles.unitLg]}>{s.unit}</Text>
                        )}
                    </Text>
                    <Text style={[styles.label, { color: captionColor }]} numberOfLines={1}>
                        {s.label}
                    </Text>
                </View>
            );
        })}
    </View>
);

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'baseline',
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[3],
        backgroundColor: theme.roles.light.surface,
    },
    divider: { borderBottomWidth: 1, borderBottomColor: theme.roles.light.borderDefault },
    cell: { flex: 1, minWidth: 0 },
    value: { fontFamily: 'DMMono-Medium', fontSize: 18, lineHeight: 22 },
    valueLg: { fontSize: 24, lineHeight: 28 },
    textValue: { ...theme.typeScale.labelLarge, fontSize: 13, lineHeight: 22 },
    unit: { fontSize: 11, color: theme.roles.light.textTertiary },
    unitLg: { fontSize: 12 },
    label: {
        ...theme.typeScale.labelSmall,
        fontFamily: 'DMSans-SemiBold',
        fontSize: 10,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
});

export default StatRow;

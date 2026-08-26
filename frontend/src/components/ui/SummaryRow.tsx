import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../../theme';
import { Icon, type IconName } from './Icon';

/**
 * "⚠  4 ponds need you / Across 2 of 3 farms          4"
 *
 * The redesign's headline row: a fact, why it matters, and the one number that
 * fact is about. Farms, Ponds and Money all open on a stack of these, which is
 * the point — the farmer reads three lines and knows whether to act.
 *
 * The value is DM Mono. Numbers in this app are compared vertically down a
 * column (4 ponds, 57%, 6d), and a proportional face makes that comparison
 * lie: same digits, different widths.
 */

export interface SummaryRowProps {
    icon: IconName;
    title: string;
    subtitle?: string | null;
    /** The number this row is about. */
    value?: string | null;
    /** Small suffix rendered inside the value at reduced size ("%", "d", "/9"). */
    unit?: string | null;
    /** Caption under the value ("act now", "reorder"). Inherits `tone`. */
    valueCaption?: string | null;
    /** Colours the value and its caption — severity, not decoration. */
    tone?: 'default' | 'danger' | 'warning' | 'success';
    onPress?: () => void;
    /** Hairline separator below. `strong` closes a group of rows. */
    divider?: 'none' | 'light' | 'strong';
}

const TONE: Record<NonNullable<SummaryRowProps['tone']>, string> = {
    default: theme.roles.light.textPrimary,
    danger: theme.roles.light.dangerText,
    warning: theme.roles.light.warningText,
    success: theme.roles.light.successText,
};

export const SummaryRow: React.FC<SummaryRowProps> = ({
    icon,
    title,
    subtitle,
    value,
    unit,
    valueCaption,
    tone = 'default',
    onPress,
    divider = 'light',
}) => {
    const color = TONE[tone];
    const body = (
        <View
            style={[
                styles.row,
                divider === 'light' && styles.dividerLight,
                divider === 'strong' && styles.dividerStrong,
            ]}
        >
            <Icon name={icon} size={22} color={theme.roles.light.textSecondary} />
            <View style={styles.text}>
                <Text style={styles.title} numberOfLines={1}>
                    {title}
                </Text>
                {!!subtitle && (
                    <Text style={styles.subtitle} numberOfLines={1}>
                        {subtitle}
                    </Text>
                )}
            </View>
            {!!value && (
                <View style={styles.valueBox}>
                    <Text style={[styles.value, { color }]} numberOfLines={1}>
                        {value}
                        {!!unit && <Text style={styles.unit}>{unit}</Text>}
                    </Text>
                    {!!valueCaption && (
                        <Text style={[styles.valueCaption, { color }]} numberOfLines={1}>
                            {valueCaption}
                        </Text>
                    )}
                </View>
            )}
        </View>
    );

    if (!onPress) return body;
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.6} accessibilityRole="button">
            {body}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        paddingHorizontal: theme.spacing[5],
        paddingVertical: theme.spacing[2.5],
        backgroundColor: theme.roles.light.surface,
        // The design's rows are 44dp+ with this padding at default text size;
        // the minimum keeps them tappable when a title wraps short.
        minHeight: 44,
    },
    dividerLight: { borderBottomWidth: 1, borderBottomColor: theme.roles.light.surfaceVariant },
    dividerStrong: { borderBottomWidth: 1, borderBottomColor: theme.roles.light.borderDefault },
    text: { flex: 1, minWidth: 0 },
    title: { ...theme.typeScale.labelLarge, color: theme.roles.light.textPrimary },
    subtitle: {
        ...theme.typeScale.bodySmall,
        fontSize: 11,
        lineHeight: 16,
        color: theme.roles.light.textTertiary,
    },
    valueBox: { alignItems: 'flex-end' },
    value: { fontFamily: 'DMMono-Medium', fontSize: 18, lineHeight: 22 },
    unit: { fontSize: 11, color: theme.roles.light.textTertiary },
    valueCaption: { ...theme.typeScale.bodySmall, fontSize: 10, lineHeight: 13 },
});

export default SummaryRow;

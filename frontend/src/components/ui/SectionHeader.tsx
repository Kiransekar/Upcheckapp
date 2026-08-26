import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../../theme';

/**
 * "WAITING FOR YOU ────────── 1" — the redesign's section divider.
 *
 * The rule extends from the label to whatever sits on the right, so a section
 * with a count or an action reads as one line rather than three fragments. It
 * replaces the old tinted `sectionHeader` band: on screens that are mostly
 * lists, a filled strip every few rows turns the page into stripes.
 */

export interface SectionHeaderProps {
    label: string;
    /** Muted value at the right — usually a count. */
    trailing?: string | number;
    /** Colour for `trailing`; defaults to the muted tone. */
    trailingColor?: string;
    /** Tappable link at the right ("All ›", "Change", "Compare"). */
    actionLabel?: string;
    onAction?: () => void;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
    label,
    trailing,
    trailingColor,
    actionLabel,
    onAction,
}) => (
    <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.rule} />
        {trailing != null && (
            <Text style={[styles.trailing, !!trailingColor && { color: trailingColor }]}>
                {trailing}
            </Text>
        )}
        {!!actionLabel && (
            <TouchableOpacity onPress={onAction} hitSlop={HIT_SLOP} accessibilityRole="button">
                <Text style={styles.action}>{actionLabel}</Text>
            </TouchableOpacity>
        )}
    </View>
);

const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2.5],
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[4],
        paddingBottom: theme.spacing[1.5],
    },
    label: {
        ...theme.typeScale.labelSmall,
        fontFamily: 'DMSans-SemiBold',
        fontSize: 10,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: theme.roles.light.textDisabled,
    },
    rule: { flex: 1, height: 1, backgroundColor: theme.roles.light.borderDefault },
    trailing: {
        fontFamily: 'DMMono-Regular',
        fontSize: 13,
        color: theme.roles.light.textTertiary,
    },
    action: { ...theme.typeScale.labelMedium, fontSize: 12, color: theme.roles.light.textLink },
});

export default SectionHeader;

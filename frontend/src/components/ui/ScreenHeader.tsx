import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../../theme';
import { Icon } from './Icon';

/**
 * The redesign's screen header, shared by every artboard.
 *
 * Three things make it recognisable and all three carry meaning:
 *
 *  - the EYEBROW says where you are ("Kakinada East · active", "3 farms · 24
 *    ponds"), so the title never has to. It is the reason the titles are short.
 *  - the TITLE is Nunito 800 at 24 — larger than the old h2, because on a phone
 *    held at arm's length outdoors the screen name is the orientation cue.
 *  - the RULE beneath is textPrimary, not borderDefault. That near-black hairline
 *    is deliberate in the drawings: it separates chrome from content hard enough
 *    to survive glare, where a grey rule disappears.
 */

export interface ScreenHeaderProps {
    /** Small uppercase line above the title — context, not a subtitle. */
    eyebrow?: string | null;
    title: string;
    /** Renders a back arrow when given. */
    onBack?: () => void;
    /** Text link on the right ("Add farm", "Request", "Add entry"). */
    actionLabel?: string;
    onAction?: () => void;
    /** Overflow menu on the far right. */
    onMore?: () => void;
    /** Plain value shown at the right instead of an action — e.g. a count. */
    trailing?: string;
    accessibilityBackLabel?: string;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
    eyebrow,
    title,
    onBack,
    actionLabel,
    onAction,
    onMore,
    trailing,
    accessibilityBackLabel,
}) => (
    <View style={styles.header}>
        {onBack && (
            <TouchableOpacity
                onPress={onBack}
                style={styles.back}
                hitSlop={HIT_SLOP}
                accessibilityRole="button"
                accessibilityLabel={accessibilityBackLabel ?? 'Back'}
            >
                <Icon name="arrow_back" size={24} color={theme.roles.light.textPrimary} />
            </TouchableOpacity>
        )}
        <View style={styles.titles}>
            {!!eyebrow && (
                <Text style={styles.eyebrow} numberOfLines={1}>
                    {eyebrow}
                </Text>
            )}
            <Text style={styles.title} numberOfLines={1}>
                {title}
            </Text>
        </View>
        {!!actionLabel && (
            <TouchableOpacity
                onPress={onAction}
                hitSlop={HIT_SLOP}
                style={styles.trailingSlot}
                accessibilityRole="button"
            >
                <Text style={styles.action}>{actionLabel}</Text>
            </TouchableOpacity>
        )}
        {!!trailing && (
            <Text style={[styles.trailing, styles.trailingSlot]} numberOfLines={1}>
                {trailing}
            </Text>
        )}
        {onMore && (
            <TouchableOpacity
                onPress={onMore}
                hitSlop={HIT_SLOP}
                style={styles.trailingSlot}
                accessibilityRole="button"
                accessibilityLabel="More options"
            >
                <Icon name="more_vert" size={22} color={theme.roles.light.textSecondary} />
            </TouchableOpacity>
        )}
    </View>
);

const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: theme.spacing[3],
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[2],
        paddingBottom: theme.spacing[3],
        backgroundColor: theme.roles.light.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.textPrimary,
    },
    back: { paddingBottom: 5 },
    titles: { flex: 1, minWidth: 0 },
    eyebrow: {
        ...theme.typeScale.labelSmall,
        fontFamily: 'DMSans-SemiBold',
        fontSize: 10,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        color: theme.roles.light.textTertiary,
    },
    title: {
        fontFamily: 'Nunito-ExtraBold',
        fontSize: 24,
        lineHeight: 30,
        letterSpacing: -0.3,
        color: theme.roles.light.textPrimary,
    },
    // Keeps the right-hand items on the title's baseline rather than the
    // eyebrow's, which is what the drawings show.
    trailingSlot: { paddingBottom: 4 },
    action: {
        ...theme.typeScale.labelLarge,
        fontSize: 13,
        color: theme.roles.light.textLink,
    },
    trailing: {
        fontFamily: 'DMMono-Regular',
        fontSize: 15,
        color: theme.roles.light.textTertiary,
    },
});

export default ScreenHeader;

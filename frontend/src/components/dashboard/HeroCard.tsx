import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../../theme';

/**
 * The dark teal card at the top of Today — artboard 1b's centrepiece.
 *
 * It is a shell, not a feature: an eyebrow, an optional counter, the farm, one
 * headline, one sentence of WHY, and one or two buttons. Two different things
 * fill it. When ponds are being watched it carries the most urgent alert
 * (NextActionCard). Before that — a farm with no ponds, ponds with no cycle,
 * a cycle with nothing logged today — it carries the setup step that has to
 * happen before anything can be watched at all.
 *
 * That second case is the reason this exists separately. A brand-new account
 * has no alerts, and a screen whose whole job is "the next decision" was
 * answering that with "All clear" — which says nothing has gone wrong on a
 * farm nothing is looking at yet.
 *
 * The dark teal ground is the one genuinely new colour pair in the redesign
 * (#06576A / #A5E8F4) — everything else maps onto existing tokens. It exists to
 * make this card unmistakably not-a-list-row.
 */

/** The card's own palette — see the note above on why these are literals. */
export const DO_FIRST_BG = '#06576A';
export const DO_FIRST_ON = '#A5E8F4';

export interface HeroCardProps {
    /** Small uppercase line — "DO THIS FIRST", "START HERE". */
    eyebrow: string;
    /** "1 of 3", when there is a queue behind this one. */
    counter?: string | null;
    /** Which farm this is about. Today spans every farm, so this is not decoration. */
    farm?: string | null;
    headline: string;
    /** One sentence on why it matters. The card is much weaker without it. */
    why?: string | null;
    primaryLabel: string;
    onPrimary: () => void;
    /** Omitted for a setup step: there is nothing to defer it in favour of. */
    secondaryLabel?: string | null;
    onSecondary?: () => void;
}

export const HeroCard: React.FC<HeroCardProps> = ({
    eyebrow,
    counter,
    farm,
    headline,
    why,
    primaryLabel,
    onPrimary,
    secondaryLabel,
    onSecondary,
}) => (
    <View style={styles.card}>
        <View style={styles.headRow}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <View style={{ flex: 1 }} />
            {!!counter && <Text style={styles.counter}>{counter}</Text>}
        </View>

        <View>
            {!!farm && <Text style={styles.farm} numberOfLines={1}>{farm}</Text>}
            <Text style={styles.headline}>{headline}</Text>
            {!!why && <Text style={styles.why}>{why}</Text>}
        </View>

        <View style={styles.actions}>
            <TouchableOpacity
                style={styles.primaryBtn}
                onPress={onPrimary}
                activeOpacity={0.85}
                accessibilityRole="button"
            >
                <Text style={styles.primaryLabel}>{primaryLabel}</Text>
            </TouchableOpacity>
            {!!secondaryLabel && (
                <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={onSecondary}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                >
                    <Text style={styles.secondaryLabel}>{secondaryLabel}</Text>
                </TouchableOpacity>
            )}
        </View>
    </View>
);

const styles = StyleSheet.create({
    card: {
        backgroundColor: DO_FIRST_BG,
        paddingHorizontal: theme.spacing[5],
        paddingTop: theme.spacing[4],
        paddingBottom: theme.spacing[5],
        gap: theme.spacing[3],
    },
    headRow: { flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing[2] },
    eyebrow: {
        ...theme.typeScale.bodySmall,
        color: DO_FIRST_ON,
        letterSpacing: 1.4,
        textTransform: 'uppercase',
        fontWeight: '700',
    },
    counter: { ...theme.typeScale.bodyMedium, color: DO_FIRST_ON, fontFamily: 'DMMono-Regular' },
    farm: { ...theme.typeScale.bodySmall, color: DO_FIRST_ON, fontWeight: '600' },
    headline: {
        ...theme.typeScale.h1,
        color: theme.roles.light.textInverse,
        marginTop: 2,
    },
    why: { ...theme.typeScale.bodyMedium, color: DO_FIRST_ON, marginTop: theme.spacing[2] },
    actions: { flexDirection: 'row', gap: theme.spacing[3], paddingTop: theme.spacing[1] },
    primaryBtn: {
        flex: 2,
        backgroundColor: theme.roles.light.surface,
        paddingVertical: theme.spacing[4],
        borderRadius: theme.radius.sm,
        alignItems: 'center',
        // 44dp minimum — this is the one control the design most expects a
        // farmer to hit outdoors, one-handed.
        minHeight: 44,
        justifyContent: 'center',
    },
    primaryLabel: { ...theme.typeScale.bodyLarge, color: DO_FIRST_BG, fontWeight: '700' },
    secondaryBtn: {
        flex: 1,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.45)',
        paddingVertical: theme.spacing[4],
        borderRadius: theme.radius.sm,
        alignItems: 'center',
        minHeight: 44,
        justifyContent: 'center',
    },
    secondaryLabel: {
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textInverse,
        fontWeight: '600',
    },
});

export default HeroCard;

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import type { BriefingItem, AlertSeverity } from '../../api/alertCenter';

/**
 * "Do this first" — the single most urgent thing across every farm, stated as
 * one action.
 *
 * This is the centrepiece of the redesign (artboard 1b). Home previously opened
 * on a list of alerts, which asks the farmer to trangle severity, pond and
 * farm before they can act. The design's answer is to do that ranking for them
 * and put ONE action at the top, with the rest demoted to a "Then" list.
 *
 * The dark teal ground is the one genuinely new colour pair in the redesign
 * (#06576A / #A5E8F4) — everything else maps onto existing tokens. It exists to
 * make this card unmistakably not-a-list-row.
 */

/** Rank order: a critical anywhere outranks a watch anywhere. */
const SEVERITY_RANK: Record<AlertSeverity, number> = { critical: 3, watch: 2, info: 1 };

/** The card's own palette — see the note above on why these are literals. */
export const DO_FIRST_BG = '#06576A';
export const DO_FIRST_ON = '#A5E8F4';

export interface NextActionCardProps {
    /** Alerts across every farm the user can see, unranked. */
    items: BriefingItem[];
    /** Resolve a pond id to its farm's name — each item carries its farm. */
    farmNameForPond?: (pondId: string | null) => string | undefined;
    /** Primary action: the farmer says they have done it. */
    onDone: (item: BriefingItem) => void;
    /** Secondary: not now. The card then shows the next one. */
    onLater: (item: BriefingItem) => void;
}

/** Most severe first; ties broken by how many alerts back it. */
export const rankActions = (items: BriefingItem[]): BriefingItem[] =>
    [...items].sort(
        (a, b) =>
            SEVERITY_RANK[b.topSeverity] - SEVERITY_RANK[a.topSeverity] ||
            b.alertCount - a.alertCount,
    );

export const NextActionCard: React.FC<NextActionCardProps> = ({
    items,
    farmNameForPond,
    onDone,
    onLater,
}) => {
    const { t } = useTranslation();
    const ranked = rankActions(items);
    const item = ranked[0];

    // Nothing urgent is a RESULT, not an empty state — the caller decides
    // whether to render a calm "all clear" instead of this card.
    if (!item) return null;

    const farm = farmNameForPond?.(item.pondId);
    // `steps` is the engine's plain-language explanation of why this matters.
    const why = item.steps?.[0];

    return (
        <View style={styles.card}>
            <View style={styles.headRow}>
                <Text style={styles.eyebrow}>{t('home.doThisFirst')}</Text>
                <View style={{ flex: 1 }} />
                {ranked.length > 1 && (
                    <Text style={styles.counter}>
                        {t('home.oneOfN', { n: ranked.length })}
                    </Text>
                )}
            </View>

            <View>
                {!!farm && <Text style={styles.farm} numberOfLines={1}>{farm}</Text>}
                <Text style={styles.headline}>{item.topTitle}</Text>
                {!!why && <Text style={styles.why}>{why}</Text>}
            </View>

            <View style={styles.actions}>
                <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={() => onDone(item)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                >
                    <Text style={styles.primaryLabel}>{t('home.markDone')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => onLater(item)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                >
                    <Text style={styles.secondaryLabel}>{t('home.later')}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

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

export default NextActionCard;

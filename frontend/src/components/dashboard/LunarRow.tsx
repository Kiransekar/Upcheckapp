import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

import { theme } from '../../theme';
import { Icon } from '../ui/Icon';
import { moonPhase } from '../../features/moonPhase';
import { localizePhaseName } from '../../features/lunarPhaseI18n';

/**
 * Lunar phase and molting status, on Today.
 *
 * Artboard 1b does not draw this, and the redesign dropped it. That was wrong:
 * shrimp molt around the new and full moon, and a molting pond is soft-shelled
 * — you feed it less, you do not handle it, and you do not harvest it. That is
 * a decision a farmer makes about today, which is exactly what this screen is
 * for. It came off the screen because the old placement made it look like
 * decoration: a lunar widget at the bottom of a wall of cards, carrying the
 * same weight on an ordinary Tuesday as on a full moon.
 *
 * So it earns its weight instead of being given it. Inside the molting window
 * the row is tinted and states the consequence; outside it, it is one quiet
 * line of context. Same rule the rest of the screen follows.
 *
 * Costs nothing to show: the phase is pure arithmetic on the date
 * (features/moonPhase.ts), not a request.
 */

export interface LunarRowProps {
    /** Injectable for tests; defaults to now. */
    date?: Date;
    /** Opens the full lunar / molt screen. */
    onPress?: () => void;
}

export const LunarRow: React.FC<LunarRowProps> = ({ date, onPress }) => {
    const { t } = useTranslation();
    const phase = moonPhase(date ?? new Date());
    const molting = phase.isMoltingWindow;
    const phaseLabel = localizePhaseName(phase.name, t);

    return (
        <TouchableOpacity
            style={[styles.row, molting && styles.rowMolting]}
            onPress={onPress}
            disabled={!onPress}
            accessibilityRole={onPress ? 'button' : undefined}
            // The emoji IS the phase — no icon font draws a waxing gibbous — so
            // it is announced by name rather than read out as a glyph.
            accessibilityLabel={`${phaseLabel}. ${
                molting ? t('home.lunarMoltingBody') : t('home.lunarQuiet')
            }`}
        >
            <Text style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no">
                {phase.emoji}
            </Text>
            <View style={styles.text}>
                <Text style={[styles.title, molting && styles.titleMolting]} numberOfLines={1}>
                    {molting ? t('home.lunarMoltingTitle') : phaseLabel}
                </Text>
                <Text style={[styles.meta, molting && styles.metaMolting]} numberOfLines={2}>
                    {molting
                        ? t('home.lunarMoltingBody')
                        : [
                              phaseLabel,
                              t('engines.lunar.illuminated', {
                                  pct: Math.round(phase.illumination * 100),
                              }),
                          ].join(' · ')}
                </Text>
            </View>
            {!!onPress && (
                <Icon
                    name="chevron_right"
                    size={20}
                    color={molting ? c.warningText : c.textTertiary}
                />
            )}
        </TouchableOpacity>
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
        minHeight: 56,
    },
    rowMolting: {
        backgroundColor: c.warningBg,
        borderTopColor: c.warningBorder,
    },
    emoji: { fontSize: 22 },
    text: { flex: 1, minWidth: 0 },
    title: { ...theme.typeScale.labelLarge, fontSize: 15, color: c.textPrimary },
    titleMolting: { color: c.warningText },
    meta: { ...theme.typeScale.bodySmall, color: c.textTertiary },
    metaMolting: { color: c.warningText },
});

export default LunarRow;

/**
 * What the engine still needs, said in the farmer's terms (E1 / E-D1).
 *
 * The old behaviour was to compute anyway, from seeded defaults, and present
 * the result in a large font with no indication that nothing behind it was
 * real. This is the replacement: a refusal that is useful, because it names
 * the action rather than the field — "needs a recent sampling", never
 * "abwG is null".
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { theme } from '../../theme';

const c = theme.roles.light;

interface Props {
    /** i18n keys, one per missing input. Empty renders nothing. */
    missing: string[];
}

export const MissingInputs: React.FC<Props> = ({ missing }) => {
    const { t } = useTranslation();
    if (missing.length === 0) return null;

    return (
        <View style={styles.box} testID="engine-missing-inputs">
            <MaterialCommunityIcons name="information-outline" size={18} color={c.warningText} />
            <View style={{ flex: 1 }}>
                <Text style={styles.title}>{t('engines.common.needsInputs')}</Text>
                {missing.map((key) => (
                    <Text key={key} style={styles.item}>
                        • {t(key)}
                    </Text>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    box: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing[2],
        padding: theme.spacing[3],
        borderRadius: theme.radius.md,
        backgroundColor: c.warningBg,
        marginTop: theme.spacing[3],
    },
    title: { ...theme.typeScale.labelMedium, color: c.warningText },
    item: {
        ...theme.typeScale.bodySmall,
        color: c.textSecondary,
        marginTop: theme.spacing[1],
    },
});

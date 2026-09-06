/**
 * The engine could not read this pond's numbers, and says so (E1).
 *
 * What this replaces: `.catch(() => {})` on all five engine screens. The
 * failure was swallowed, the pre-seeded defaults survived it, and the farmer
 * got a confident recommendation built from invented numbers. There was no
 * error, no warning, and no way to tell.
 *
 * The form below this is deliberately still usable — a farmer who knows their
 * own population and ABW can type them in and get a real answer. What they
 * cannot do any more is get an answer they did not supply the inputs for.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { theme } from '../../theme';

const c = theme.roles.light;

interface Props {
    onRetry?: () => void;
}

export const EngineUnavailable: React.FC<Props> = ({ onRetry }) => {
    const { t } = useTranslation();
    return (
        <View style={styles.box} testID="engine-unavailable">
            <MaterialCommunityIcons name="cloud-off-outline" size={20} color={c.dangerText} />
            <View style={{ flex: 1 }}>
                <Text style={styles.title}>{t('engines.common.contextUnavailable')}</Text>
                <Text style={styles.body}>{t('engines.common.contextUnavailableBody')}</Text>
                {onRetry && (
                    <TouchableOpacity onPress={onRetry} accessibilityRole="button" hitSlop={8}>
                        <Text style={styles.retry}>{t('common.retry')}</Text>
                    </TouchableOpacity>
                )}
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
        backgroundColor: c.dangerBg,
        marginBottom: theme.spacing[3],
    },
    title: { ...theme.typeScale.labelMedium, color: c.dangerText },
    body: {
        ...theme.typeScale.bodySmall,
        color: c.textSecondary,
        marginTop: theme.spacing[1],
    },
    retry: {
        ...theme.typeScale.labelMedium,
        color: c.primary,
        marginTop: theme.spacing[2],
    },
});

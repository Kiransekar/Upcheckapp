/**
 * FirstUseHint — a small, one-time, dismissible inline hint shown the first
 * time a farmer reaches a genuinely new concept (e.g. the first time they see
 * a ConfidenceChip: "this uses your last water quality reading — no need to
 * search for it"). Contained implementation of Concept E from
 * docs/ONBOARDING_MODULE_PLAN.md Phase 3 — teaching spread across real usage
 * instead of front-loaded into a tour nobody reads carefully on day one.
 *
 * Persisted per `flagKey` in AsyncStorage (same pattern as WelcomeScreen's
 * ONBOARDING_FLAG) — once dismissed, gone forever on this device, not just
 * for the session. Renders nothing until the flag check resolves, and
 * nothing at all if the flag is already set — so there's no flash of a hint
 * that's about to disappear.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../../theme';

const flagKeyFor = (key: string) => `@upcheck:hint:${key}`;

interface Props {
    /** Unique per hint, stable across app versions (e.g. 'confidence-chip'). */
    flagKey: string;
    message: string;
}

export const FirstUseHint: React.FC<Props> = ({ flagKey, message }) => {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        let cancelled = false;
        AsyncStorage.getItem(flagKeyFor(flagKey))
            .then((v) => { if (!cancelled && !v) setVisible(true); })
            .catch(() => { /* fail closed — no hint rather than a broken one */ });
        return () => { cancelled = true; };
    }, [flagKey]);

    const dismiss = () => {
        setVisible(false);
        AsyncStorage.setItem(flagKeyFor(flagKey), '1').catch(() => {});
    };

    if (!visible) return null;

    return (
        <View style={styles.container}>
            <MaterialCommunityIcons name="lightbulb-outline" size={16} color={theme.roles.light.infoText} />
            <Text style={styles.text}>{message}</Text>
            <TouchableOpacity
                onPress={dismiss}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('common.dismiss', 'Dismiss')}
            >
                <MaterialCommunityIcons name="close" size={16} color={theme.roles.light.textSecondary} />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing[2],
        backgroundColor: theme.roles.light.infoBg,
        borderRadius: theme.radius.sm,
        padding: theme.spacing[3],
        marginBottom: theme.spacing[4],
    },
    text: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.infoText,
        flex: 1,
    },
});

export default FirstUseHint;

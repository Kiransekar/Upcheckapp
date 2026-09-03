import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';

const TOTAL_STEPS = 3;

/**
 * The pre-account first-run flow (Language → Welcome → Intent) is three
 * screens with no other progress cue — same bar-segment shape already used
 * for the farm-creation and pond-setup sub-flows (see PondNamesScreen /
 * PondSetupScreen), so a farmer reads it the same way everywhere it appears.
 */
export const OnboardingProgress: React.FC<{ step: 1 | 2 | 3 }> = ({ step }) => {
    const { t } = useTranslation();
    return (
        <View
            style={styles.row}
            accessibilityRole="progressbar"
            accessibilityLabel={t('onboarding.stepOf', { current: step, total: TOTAL_STEPS })}
        >
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                <View key={i} style={[styles.seg, i < step && styles.segDone]} />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    row: { flexDirection: 'row', gap: theme.spacing[2], marginBottom: theme.spacing[4] },
    seg: {
        flex: 1,
        height: 4,
        borderRadius: theme.radius.full,
        backgroundColor: theme.roles.light.borderDefault,
    },
    segDone: { backgroundColor: theme.roles.light.primary },
});

export default OnboardingProgress;

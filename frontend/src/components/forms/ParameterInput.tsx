import React from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { theme } from '../../theme';
import { useTranslation } from 'react-i18next';
import { evaluateParameter, getParameterRangeHint, ParameterStatus, ThresholdParam } from '../../features/waterQualityThresholds';
import { PARAMETER_BOUNDS, isOutOfBounds } from '../../features/parameterBounds';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface ParameterInputProps {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    parameterKey?: ThresholdParam;
    placeholder?: string;
    unit?: string;
    required?: boolean;
}

export const ParameterInput: React.FC<ParameterInputProps> = ({
    label,
    value,
    onChangeText,
    parameterKey,
    placeholder = '0.0',
    unit,
    required
}) => {
    const numValue = value ? parseFloat(value) : undefined;
    // No crop/pond context reaches this shared input, so species defaults to
    // vannamei — the same fallback used everywhere else a species can't be
    // resolved (see toThresholdSpecies), and it's what constants/ranges.ts's
    // now-deleted flat table effectively assumed anyway.
    const { t } = useTranslation();
    const status: ParameterStatus = parameterKey
        ? evaluateParameter('vannamei', parameterKey, numValue).status
        : 'none';
    const rangeHint = getParameterRangeHint('vannamei', parameterKey);
    // Physically impossible, i.e. the server will refuse it — see parameterBounds.
    const bound = parameterKey ? PARAMETER_BOUNDS[parameterKey] : undefined;
    const outOfBounds = isOutOfBounds(parameterKey, value);

    const getStatusColor = () => {
        switch (status) {
            case 'safe': return theme.roles.light.successText;
            case 'warning': return theme.roles.light.warningText;
            case 'critical': return theme.roles.light.dangerText;
            default: return theme.roles.light.borderDefault;
        }
    };

    const getStatusIcon = () => {
        switch (status) {
            case 'safe': return 'check-circle';
            case 'warning': return 'alert-circle';
            case 'critical': return 'alert-decagram';
            default: return null;
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.label}>
                {label} {unit ? `(${unit})` : ''}
                {required && <Text style={styles.required}> *</Text>}
            </Text>

            <View style={[styles.inputContainer, status !== 'none' && { borderColor: getStatusColor() }]}>
                <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={onChangeText}
                    keyboardType="decimal-pad"
                    placeholder={placeholder}
                    placeholderTextColor={theme.roles.light.textDisabled}
                    /*
                     * The visible label is a sibling <Text>, which a screen
                     * reader does not associate with this field — so every
                     * water-quality input announced as an unlabelled text box.
                     * The unit rides along because "7.8" means nothing without
                     * it.
                     */
                    accessibilityLabel={unit ? `${label} (${unit})` : label}
                />
                {status !== 'none' && (
                    <View style={styles.iconWrapper}>
                        <MaterialCommunityIcons name={getStatusIcon() as any} size={20} color={getStatusColor()} />
                    </View>
                )}
            </View>

            {/*
              * A WORDED warning, not just a coloured border (L4).
              *
              * The border and the icon above already change on an out-of-band
              * value, and at 6 a.m. under screen glare nobody reads a border.
              * The two cases are deliberately different sentences, because the
              * farmer should do different things about them:
              *
              *  • out of BOUNDS — physically impossible, so the server will
              *    refuse it. Online that is a harmless round trip; offline the
              *    record is queued, toasted as "Saved", and only discovered
              *    that evening in `failedOperations` with the real reading long
              *    gone. Worth fixing now.
              *  • out of BAND — unusual but real. Says so and gets out of the way.
              *
              * NEITHER BLOCKS THE SAVE (D3). A crisis reading — DO at 1.2, an
              * ammonia spike — is exactly the extreme value most worth
              * recording, and a form that argues during an emergency is a form
              * abandoned for the notebook.
              */}
            {outOfBounds ? (
                <View style={styles.hintRow}>
                    <MaterialCommunityIcons name="alert" size={12} color={theme.roles.light.dangerText} />
                    <Text style={[styles.hintText, styles.boundsText]}>
                        {t('logs.parameterOutOfBounds', {
                            min: bound!.min,
                            max: bound!.max,
                        })}
                    </Text>
                </View>
            ) : status === 'critical' || status === 'warning' ? (
                <View style={styles.hintRow}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={12} color={getStatusColor()} />
                    <Text style={[styles.hintText, { color: getStatusColor() }]}>
                        {t('logs.parameterUnusual')}
                        {rangeHint ? ` ${rangeHint}${unit ? ` ${unit}` : ''}` : ''}
                    </Text>
                </View>
            ) : rangeHint ? (
                <View style={styles.hintRow}>
                    <MaterialCommunityIcons name="target" size={12} color={theme.roles.light.textSecondary} />
                    <Text style={styles.hintText}>{rangeHint}{unit ? ` ${unit}` : ''}</Text>
                </View>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: theme.spacing[4],
        flex: 1,
    },
    label: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.textPrimary,
        marginBottom: theme.spacing[2],
    },
    required: {
        color: theme.roles.light.dangerText,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: theme.roles.light.borderDefault,
        borderRadius: theme.radius.md,
        backgroundColor: theme.roles.light.surface,
    },
    input: {
        flex: 1,
        paddingHorizontal: theme.spacing[4],
        paddingVertical: theme.spacing[4] - 2,
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textPrimary,
    },
    iconWrapper: {
        paddingRight: theme.spacing[4],
    },
    hintRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[1],
        marginTop: theme.spacing[1],
        marginLeft: theme.spacing[1],
    },
    boundsText: { color: theme.roles.light.dangerText },
    hintText: {
        ...theme.typeScale.caption,
        color: theme.roles.light.textSecondary,
    },
});

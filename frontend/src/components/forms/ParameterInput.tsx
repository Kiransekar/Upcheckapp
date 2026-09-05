import React from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { theme } from '../../theme';
import { evaluateParameter, getParameterRangeHint, ParameterStatus, ThresholdParam } from '../../features/waterQualityThresholds';
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
    const status: ParameterStatus = parameterKey
        ? evaluateParameter('vannamei', parameterKey, numValue).status
        : 'none';
    const rangeHint = getParameterRangeHint('vannamei', parameterKey);

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
                />
                {status !== 'none' && (
                    <View style={styles.iconWrapper}>
                        <MaterialCommunityIcons name={getStatusIcon() as any} size={20} color={getStatusColor()} />
                    </View>
                )}
            </View>

            {rangeHint && (
                <View style={styles.hintRow}>
                    <MaterialCommunityIcons name="target" size={12} color={theme.roles.light.textSecondary} />
                    <Text style={styles.hintText}>{rangeHint}{unit ? ` ${unit}` : ''}</Text>
                </View>
            )}
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
    hintText: {
        ...theme.typeScale.caption,
        color: theme.roles.light.textSecondary,
    },
});

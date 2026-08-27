import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, FlatList, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';

export interface SelectOption {
    label: string;
    value: string;
    sublabel?: string;
}

interface SelectFieldProps {
    label: string;
    value: string | null;
    options: SelectOption[];
    placeholder?: string;
    onSelect: (value: string) => void;
    required?: boolean;
    error?: string;
    disabled?: boolean;
    leftIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
}

/**
 * Labelled dropdown that opens a bottom-sheet list of options. Modal-based so it
 * behaves identically on iOS and Android (the native Picker wheel/dialog differ).
 */
export const SelectField: React.FC<SelectFieldProps> = ({
    label,
    value,
    options,
    placeholder,
    onSelect,
    required = false,
    error,
    disabled = false,
    leftIcon,
}) => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const selected = options.find((o) => o.value === value) ?? null;

    return (
        <View style={styles.container}>
            <View style={styles.labelHeader}>
                <Text style={styles.label}>{label}</Text>
                {required && <Text style={styles.requiredAsterisk}>*</Text>}
            </View>

            <TouchableOpacity
                style={[styles.field, error && styles.fieldError, disabled && styles.fieldDisabled]}
                onPress={() => !disabled && setOpen(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ disabled }}
                accessibilityLabel={label}
            >
                {leftIcon && (
                    <MaterialCommunityIcons
                        name={leftIcon}
                        size={20}
                        color={theme.roles.light.textSecondary}
                        style={{ marginRight: theme.spacing[2] }}
                    />
                )}
                <Text style={[styles.value, !selected && styles.placeholder]} numberOfLines={1}>
                    {selected ? selected.label : placeholder ?? t('common.selectPlaceholder')}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={22} color={theme.roles.light.textSecondary} />
            </TouchableOpacity>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
                    <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>{label}</Text>
                            <TouchableOpacity onPress={() => setOpen(false)} hitSlop={8}>
                                <MaterialCommunityIcons name="close" size={22} color={theme.roles.light.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        {options.length === 0 ? (
                            <Text style={styles.empty}>{t('common.noOptions')}</Text>
                        ) : (
                            <FlatList
                                data={options}
                                keyExtractor={(o) => o.value}
                                style={{ maxHeight: 360 }}
                                renderItem={({ item }) => {
                                    const active = item.value === value;
                                    return (
                                        <TouchableOpacity
                                            style={styles.option}
                                            onPress={() => {
                                                onSelect(item.value);
                                                setOpen(false);
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.optionLabel, active && { color: theme.roles.light.primary }]}>
                                                    {item.label}
                                                </Text>
                                                {item.sublabel && <Text style={styles.optionSub}>{item.sublabel}</Text>}
                                            </View>
                                            {active && (
                                                <MaterialCommunityIcons name="check" size={20} color={theme.roles.light.primary} />
                                            )}
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        )}
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { marginBottom: theme.spacing[4] },
    labelHeader: { flexDirection: 'row', marginBottom: theme.spacing[2] },
    label: { ...theme.typeScale.labelMedium, color: theme.roles.light.textSecondary },
    requiredAsterisk: { ...theme.typeScale.labelMedium, color: theme.roles.light.dangerText, marginLeft: 2 },
    field: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing[3],
        paddingHorizontal: theme.spacing[4],
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.roles.light.borderDefault,
        backgroundColor: theme.roles.light.surface,
    },
    fieldError: { borderColor: theme.roles.light.dangerText },
    fieldDisabled: { opacity: 0.5 },
    value: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textPrimary, flex: 1 },
    placeholder: { color: theme.roles.light.textTertiary },
    errorText: { ...theme.typeScale.caption, color: theme.roles.light.dangerText, marginTop: theme.spacing[1] },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: theme.roles.light.surface,
        borderTopLeftRadius: theme.radius.xl,
        borderTopRightRadius: theme.radius.xl,
        paddingHorizontal: theme.spacing[4],
        paddingTop: theme.spacing[4],
        paddingBottom: theme.spacing[6],
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: theme.spacing[3],
    },
    sheetTitle: { ...theme.typeScale.h3, color: theme.roles.light.textPrimary },
    empty: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary, paddingVertical: theme.spacing[4] },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing[3],
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.roles.light.borderDefault,
    },
    optionLabel: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textPrimary },
    optionSub: { ...theme.typeScale.caption, color: theme.roles.light.textSecondary, marginTop: 2 },
});

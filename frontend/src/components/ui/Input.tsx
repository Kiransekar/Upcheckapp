import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';

interface InputProps extends TextInputProps {
    label: string;
    error?: string;
    hint?: string;
    required?: boolean;
    leftIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
    rightIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
    isPassword?: boolean;
    multiline?: boolean;
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    hint,
    required = false,
    leftIcon,
    rightIcon,
    isPassword = false,
    multiline = false,
    ...props
}) => {
    const { t } = useTranslation();
    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    return (
        <View style={styles.container}>
            <View style={styles.labelHeader}>
                <Text style={styles.label}>
                    {label}
                </Text>
                {required && <Text style={styles.requiredAsterisk}>*</Text>}
            </View>

            <View
                style={[
                    styles.inputContainer,
                    isFocused && styles.inputContainerFocused,
                    error && styles.inputContainerError,
                ]}
            >
                {leftIcon && (
                    <View style={styles.leftIconContainer}>
                        <MaterialCommunityIcons
                            name={leftIcon}
                            size={20}
                            color={isFocused ? theme.tokens.input.iconColorFocus : theme.tokens.input.iconColor}
                        />
                    </View>
                )}

                <TextInput
                    style={[
                        styles.input,
                        leftIcon && styles.inputWithLeftIcon,
                        (isPassword || rightIcon) && styles.inputWithRightIcon,
                        multiline && styles.textArea
                    ]}
                    placeholderTextColor={theme.tokens.input.placeholderColor}
                    secureTextEntry={isPassword && !isPasswordVisible}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    multiline={multiline}
                    {...props}
                />

                {isPassword && (
                    <TouchableOpacity
                        style={styles.rightIconContainer}
                        onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        accessibilityRole="button"
                        accessibilityLabel={isPasswordVisible ? t('common.hidePassword') : t('common.showPassword')}
                    >
                        <MaterialCommunityIcons
                            name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                            size={20}
                            color={theme.tokens.input.placeholderColor}
                        />
                    </TouchableOpacity>
                )}

                {rightIcon && !isPassword && (
                    <View style={styles.rightIconContainer}>
                        <MaterialCommunityIcons
                            name={rightIcon}
                            size={20}
                            color={isFocused ? theme.tokens.input.iconColorFocus : theme.tokens.input.iconColor}
                        />
                    </View>
                )}
            </View>

            {error || hint ? (
                <Text style={[styles.helperText, error && styles.errorText]}>
                    {error || hint}
                </Text>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: theme.spacing[4],
    },
    labelHeader: {
        flexDirection: 'row',
        marginBottom: theme.spacing[1.5],
        alignItems: 'center',
    },
    label: {
        fontFamily: theme.tokens.input.labelFontFamily,
        fontSize: theme.tokens.input.labelFontSize,
        color: theme.tokens.input.labelColor,
    },
    requiredAsterisk: {
        color: theme.tokens.input.errorColor,
        marginLeft: theme.spacing[0.5],
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.tokens.input.bgDefault,
        borderWidth: theme.tokens.input.borderWidth,
        borderColor: theme.tokens.input.borderColor,
        borderRadius: theme.tokens.input.borderRadius,
        minHeight: theme.tokens.input.height,
    },
    inputContainerFocused: {
        borderColor: theme.tokens.input.borderColorFocus,
        backgroundColor: theme.tokens.input.bgFocused,
    },
    inputContainerError: {
        borderColor: theme.tokens.input.borderColorError,
    },
    leftIconContainer: {
        paddingLeft: theme.tokens.input.paddingH,
        justifyContent: 'center',
    },
    rightIconContainer: {
        paddingRight: theme.tokens.input.paddingH,
        justifyContent: 'center',
    },
    input: {
        flex: 1,
        paddingHorizontal: theme.tokens.input.paddingH,
        paddingVertical: theme.tokens.input.paddingV,
        fontFamily: theme.tokens.input.fontFamily,
        fontSize: theme.tokens.input.fontSize,
        color: theme.tokens.input.textColor,
    },
    inputWithLeftIcon: {
        paddingLeft: theme.spacing[2],
    },
    inputWithRightIcon: {
        paddingRight: theme.spacing[2],
    },
    textArea: {
        textAlignVertical: 'top',
        minHeight: 100,
    },
    helperText: {
        fontFamily: theme.tokens.input.fontFamily,
        fontSize: theme.tokens.input.helperFontSize,
        color: theme.tokens.input.helperColor,
        marginTop: theme.spacing[1],
        marginLeft: theme.spacing[1],
    },
    errorText: {
        color: theme.tokens.input.errorColor,
    },
});

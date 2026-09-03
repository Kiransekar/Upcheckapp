import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { theme } from '../../theme';

interface CardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    variant?: 'elevated' | 'outlined' | 'flat';
    testID?: string;
}

export const Card: React.FC<CardProps> = ({ children, style, variant = 'elevated', testID }) => {
    return (
        <View
            testID={testID}
            style={[
                styles.base,
                variant === 'elevated' && styles.elevated,
                variant === 'outlined' && styles.outlined,
                variant === 'flat' && styles.flat,
                style,
            ]}
        >
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    base: {
        backgroundColor: theme.tokens.card.bgDefault,
        borderRadius: theme.tokens.card.borderRadius,
        paddingHorizontal: theme.tokens.card.paddingH,
        paddingVertical: theme.tokens.card.paddingV,
        ...theme.shadows.sm,
    },
    elevated: {
        ...theme.shadows.md,
    },
    outlined: {
        borderWidth: theme.tokens.card.borderWidth,
        borderColor: theme.tokens.card.borderColor,
        ...theme.shadows.none,
    },
    flat: {
        backgroundColor: theme.tokens.card.bgTinted,
        ...theme.shadows.none,
    },
});

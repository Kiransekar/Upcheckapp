import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { Button } from './Button';
import { theme } from '../../theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
    onPress: () => void;
    loading?: boolean;
}

export const GoogleLoginButton = ({ onPress, loading }: Props) => {
    const { t } = useTranslation();
    return (
        <Button
            title={t('auth.continueWithGoogle')}
            onPress={onPress}
            loading={loading}
            variant="outlined"
            icon={<MaterialCommunityIcons name="google" size={20} color={theme.roles.light.textPrimary} />}
            style={styles.button}
            textStyle={styles.text}
        />
    );
};

const styles = StyleSheet.create({
    button: {
        borderColor: theme.roles.light.borderDefault,
        borderWidth: 1,
        backgroundColor: theme.roles.light.surface,
        marginTop: theme.spacing[4],
    },
    text: {
        color: theme.roles.light.textPrimary,
    },
});

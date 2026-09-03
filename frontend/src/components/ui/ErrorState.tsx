import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { theme } from '../../theme';
import { apiErrorMessage } from '../../api/errors';

interface ErrorStateProps {
    icon?: keyof typeof MaterialCommunityIcons.glyphMap;
    title?: string;
    message?: string;
    retryLabel?: string;
    onRetry?: () => void;
    error?: any;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
    icon = 'alert-circle-outline',
    title,
    message,
    retryLabel,
    onRetry,
    error,
}) => {
    const { t } = useTranslation();
    // Extract error message from various error formats
    const errorMessage = message ||
        apiErrorMessage(error, error?.message || t('common.checkConnection'));

    return (
        <View style={styles.container}>
            <View style={styles.iconContainer}>
                <MaterialCommunityIcons name={icon} size={64} color={theme.roles.light.dangerText} />
            </View>
            <Text style={styles.title}>{title ?? t('common.error')}</Text>
            <Text style={styles.message}>{errorMessage}</Text>
            {onRetry && (
                <Button
                    title={retryLabel ?? t('common.retry')}
                    onPress={onRetry}
                    variant="outlined"
                    style={styles.button}
                    icon="refresh"
                />
            )}
        </View>
    );
};

interface NetworkErrorProps {
    onRetry?: () => void;
}

export const NetworkError: React.FC<NetworkErrorProps> = ({ onRetry }) => {
    const { t } = useTranslation();
    return (
        <ErrorState
            icon="wifi-off"
            title={t('common.noInternet')}
            message={t('common.checkConnection')}
            onRetry={onRetry}
        />
    );
};

interface ServerErrorProps {
    onRetry?: () => void;
}

export const ServerError: React.FC<ServerErrorProps> = ({ onRetry }) => {
    const { t } = useTranslation();
    return (
        <ErrorState
            icon="server-network-off"
            title={t('common.serverErrorTitle')}
            message={t('common.serverErrorMessage')}
            onRetry={onRetry}
        />
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing[8],
        backgroundColor: theme.roles.light.background,
    },
    iconContainer: {
        marginBottom: theme.spacing[6],
        backgroundColor: theme.roles.light.dangerBg,
        borderRadius: 50,
        padding: theme.spacing[4],
    },
    title: {
        ...theme.typeScale.h2,
        color: theme.roles.light.textPrimary,
        marginBottom: theme.spacing[3],
        textAlign: 'center',
    },
    message: {
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textSecondary,
        textAlign: 'center',
        marginBottom: theme.spacing[6],
        lineHeight: 24,
    },
    button: {
        marginTop: theme.spacing[4],
        borderColor: theme.roles.light.primary,
    },
});
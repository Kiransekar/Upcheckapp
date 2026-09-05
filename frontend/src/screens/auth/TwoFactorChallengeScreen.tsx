import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { theme } from '../../theme';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { capture, EVENTS } from '../../features/analytics';

/**
 * Second factor prompt shown after a password sign-in when the account has
 * TOTP 2FA enabled. Exchanges the short-lived tempToken + authenticator code
 * for the withheld session.
 */
export const TwoFactorChallengeScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { tempToken } = route.params;
    const setSession = useAuthStore((s) => s.setSession);
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [useBackup, setUseBackup] = useState(false);

    const verify = async () => {
        if (code.trim().length < 6) {
            Alert.alert(t('auth.invalidCode'), t('auth.invalidCodeAlert'));
            return;
        }
        setLoading(true);
        try {
            const { data } = await authApi.twoFactor.login(tempToken, code.trim());
            if (data.session) {
                setSession(data.session);
                // login/googleLogin return EARLY on requires2FA, so the session
                // only ever lands here — without this a two-factor login was
                // invisible to analytics, which quietly under-counts exactly the
                // users careful enough to enable 2FA.
                capture(EVENTS.LOGIN_COMPLETED, { method: 'email', feature: '2fa' });
            } else {
                Alert.alert(t('common.error'), t('auth.noSessionSignInAgain'));
                navigation.goBack();
            }
        } catch (err: any) {
            Alert.alert(t('common.error'), err.response?.data?.message || t('auth.invalidVerificationCode'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>{t('auth.twoFactorTitle')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Card style={styles.card}>
                    <Text style={styles.help}>
                        {useBackup ? t('auth.twoFactorBackupHelp') : t('auth.twoFactorHelp')}
                    </Text>
                    <Input
                        label={useBackup ? t('auth.backupCodeLabel') : t('auth.authenticatorCodeLabel')}
                        value={code}
                        onChangeText={setCode}
                        placeholder={useBackup ? 'A1B2C3D4' : '123456'}
                        keyboardType={useBackup ? 'default' : 'number-pad'}
                        autoCapitalize={useBackup ? 'characters' : 'none'}
                        maxLength={useBackup ? 8 : 6}
                        required
                    />
                    <Button title={t('auth.verify')} onPress={verify} loading={loading} style={styles.btn} />
                    <TouchableOpacity
                        onPress={() => { setUseBackup((v) => !v); setCode(''); }}
                        style={styles.toggle}
                    >
                        <Text style={styles.toggleText}>
                            {useBackup ? t('auth.useAuthenticatorInstead') : t('auth.useBackupCode')}
                        </Text>
                    </TouchableOpacity>
                </Card>
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing[4],
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
    },
    backBtn: { padding: theme.spacing[4] },
    title: { ...theme.typeScale.h3, color: theme.roles.light.textPrimary },
    content: { padding: theme.spacing[4] },
    card: { marginBottom: theme.spacing[6] },
    help: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary, marginBottom: theme.spacing[4] },
    btn: { marginTop: theme.spacing[3] },
    toggle: { marginTop: theme.spacing[4], alignItems: 'center' },
    toggleText: { ...theme.typeScale.labelMedium, color: theme.roles.light.primary },
});

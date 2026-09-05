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
import { ConsentNotice } from '../../components/ui/ConsentNotice';

/**
 * Passwordless sign-in: request a one-time code by email, then verify it to
 * receive a session. Backed by Supabase native email OTP.
 */
export const OtpLoginScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const setSession = useAuthStore((s) => s.setSession);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);

    const requestCode = async () => {
        if (!email.trim()) {
            Alert.alert(t('auth.emailRequiredAlert'), t('auth.emailRequiredBody'));
            return;
        }
        setLoading(true);
        try {
            await authApi.loginOtpRequest(email.trim());
            setSent(true);
            Alert.alert(t('auth.codeSent'), t('auth.checkEmailForCode'));
        } catch (err: any) {
            Alert.alert(t('common.error'), err.response?.data?.message || t('auth.couldNotSendCode'));
        } finally {
            setLoading(false);
        }
    };

    const verifyCode = async () => {
        if (otp.trim().length !== 6) {
            Alert.alert(t('auth.invalidCode'), t('auth.enterSixDigitCode'));
            return;
        }
        setLoading(true);
        try {
            const { data } = await authApi.loginOtpVerify(email.trim(), otp.trim());
            if (data.requires2FA && data.tempToken) {
                navigation.navigate('TwoFactorChallenge', { tempToken: data.tempToken });
            } else if (data.session) {
                setSession(data.session);
            } else {
                Alert.alert(t('common.error'), t('auth.noSessionReturned'));
            }
        } catch (err: any) {
            Alert.alert(t('common.error'), err.response?.data?.message || t('auth.invalidOrExpiredCode'));
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
                <Text style={styles.title}>{t('auth.signInWithEmailCodeTitle')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Card style={styles.card}>
                    <Input
                        label={t('auth.emailLabel')}
                        value={email}
                        onChangeText={setEmail}
                        placeholder={t('auth.emailPlaceholder')}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        editable={!sent}
                        required
                    />
                    {!sent ? (
                        <Button title={t('auth.sendCode')} onPress={requestCode} loading={loading} style={styles.btn} />
                    ) : (
                        <>
                            <Input
                                label={t('auth.sixDigitCodeLabel')}
                                value={otp}
                                onChangeText={setOtp}
                                placeholder="123456"
                                keyboardType="number-pad"
                                maxLength={6}
                                required
                            />
                            <Button title={t('auth.verifyAndSignIn')} onPress={verifyCode} loading={loading} style={styles.btn} />
                            <TouchableOpacity onPress={requestCode} disabled={loading}>
                                <Text style={styles.resend}>{t('auth.resendCode')}</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </Card>
                <ConsentNotice navigation={navigation} />
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
    btn: { marginTop: theme.spacing[3] },
    resend: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.primary,
        textAlign: 'center',
        marginTop: theme.spacing[3],
    },
});

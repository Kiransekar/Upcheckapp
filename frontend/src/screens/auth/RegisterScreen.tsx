import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { SignupIntent } from '../../store/authStore';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { theme } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { GoogleLoginButton } from '../../components/ui/GoogleLoginButton';
import { TruecallerLoginButton } from '../../components/ui/TruecallerLoginButton';
import { LanguagePill } from '../../components/ui/LanguagePill';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { passwordPolicyError } from '../../features/passwordPolicy';

export const RegisterScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    // First-run routing only — see SignupIntent. Not sent to the server, and
    // it grants nothing: either answer can create a farm or join one later.
    const [intent, setIntent] = useState<SignupIntent | null>(null);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [success, setSuccess] = useState(false);

    const { signup, isLoading, error, clearError } = useAuthStore();
    const { signInWithGoogle } = useGoogleAuth();

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (!intent) e.intent = t('auth.signupIntentRequired');
        if (!firstName.trim()) e.firstName = t('auth.firstNameRequired');
        if (!email.trim()) e.email = t('auth.emailRequired');
        else if (!/\S+@\S+\.\S+/.test(email)) e.email = t('auth.emailInvalid');
        if (!password) e.password = t('auth.passwordRequired');
        else {
            // Mirror the server rule exactly so an accepted password is never
            // rejected server-side with a raw untranslated message (PWDVAL-1).
            const rule = passwordPolicyError(password);
            if (rule) e.password = t(rule.key, rule.fallback);
        }
        if (password !== confirmPassword) e.confirmPassword = t('auth.passwordsDoNotMatch');
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleRegister = async () => {
        if (!validate()) return;
        clearError();
        try {
            await signup(email.trim(), password, firstName.trim(), lastName.trim(), intent!);
            setSuccess(true);
        } catch {
            // Error is set in the store
        }
    };

    if (success) {
        return (
            <ScreenWrapper>
                <View style={styles.successContainer}>
                    <MaterialCommunityIcons name="email-check-outline" size={64} color={theme.roles.light.primary} style={styles.successIcon} />
                    <Text style={styles.successTitle}>{t('auth.checkYourEmail')}</Text>
                    <Text style={styles.successText}>
                        {t('auth.verificationLinkSent', { email })}
                    </Text>
                    <Button
                        title={t('auth.backToLogin')}
                        onPress={() => navigation.navigate('Login')}
                        style={{ marginTop: theme.spacing[6] }}
                    />
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <View style={styles.langBar}>
                <LanguagePill variant="dark" />
            </View>
            <View style={styles.header}>
                <Text style={styles.title}>{t('auth.createAccountTitle')}</Text>
                <Text style={styles.subtitle}>{t('auth.registerSubtitle')}</Text>
            </View>

            {error && (
                <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {/* Intent, not an account type: it only picks the first-run step —
                set up a farm, or enter a code to join one. Nothing about it is
                permanent, and it is never sent to the server. */}
            <Text style={styles.accountTypeLabel}>{t('auth.signupIntentLabel')}</Text>
            <View style={styles.accountTypeRow}>
                {([
                    { key: 'own_farm' as const, icon: 'home-account', title: t('auth.intentOwnFarmTitle'), desc: t('auth.intentOwnFarmDesc') },
                    { key: 'work_on_farm' as const, icon: 'account-hard-hat', title: t('auth.intentWorkOnFarmTitle'), desc: t('auth.intentWorkOnFarmDesc') },
                ]).map((opt) => {
                    const active = intent === opt.key;
                    return (
                        <TouchableOpacity
                            key={opt.key}
                            style={[styles.accountCard, active && styles.accountCardActive]}
                            onPress={() => setIntent(opt.key)}
                            activeOpacity={0.8}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={opt.title}
                        >
                            <MaterialCommunityIcons
                                name={opt.icon as any}
                                size={26}
                                color={active ? theme.roles.light.primary : theme.roles.light.textSecondary}
                            />
                            <Text style={[styles.accountCardTitle, active && { color: theme.roles.light.primary }]}>
                                {opt.title}
                            </Text>
                            <Text style={styles.accountCardDesc}>{opt.desc}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
            {errors.intent && <Text style={styles.accountTypeError}>{errors.intent}</Text>}

            <Input
                label={t('auth.firstNameLabel')}
                value={firstName}
                onChangeText={setFirstName}
                error={errors.firstName}
                placeholder={t('auth.firstNamePlaceholder')}
                autoCapitalize="words"
                leftIcon="account-outline"
                required
            />

            <Input
                label={t('auth.lastNameLabel')}
                value={lastName}
                onChangeText={setLastName}
                error={errors.lastName}
                placeholder={t('auth.lastNamePlaceholder')}
                autoCapitalize="words"
                leftIcon="account-outline"
            />

            <Input
                label={t('auth.emailLabel')}
                value={email}
                onChangeText={setEmail}
                error={errors.email}
                placeholder={t('auth.emailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon="email-outline"
                required
            />

            <Input
                label={t('auth.passwordLabel')}
                value={password}
                onChangeText={setPassword}
                error={errors.password}
                placeholder={t('auth.passwordAtLeast8Placeholder')}
                isPassword
                leftIcon="lock-outline"
                required
                hint={t('auth.passwordHint')}
            />

            <Input
                label={t('auth.confirmPasswordLabel')}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                error={errors.confirmPassword}
                placeholder={t('auth.confirmPasswordPlaceholder')}
                isPassword
                leftIcon="lock-check-outline"
                required
            />

            <Button
                title={t('auth.createAccount')}
                onPress={handleRegister}
                loading={isLoading}
                style={{ marginTop: theme.spacing[3] }}
            />

            <Text style={styles.consent}>
                {t('auth.consentPrefix')}{' '}
                <Text style={styles.consentLink} onPress={() => navigation.navigate('Terms')}>
                    {t('settings.termsOfService')}
                </Text>
                {' '}{t('auth.consentAnd')}{' '}
                <Text style={styles.consentLink} onPress={() => navigation.navigate('PrivacyPolicy')}>
                    {t('settings.privacyPolicy')}
                </Text>.
            </Text>

            {/* @react-native-google-signin has no web build — hide on web like Truecaller below */}
            {Platform.OS !== 'web' && (
                <GoogleLoginButton onPress={async () => {
                    const r = await signInWithGoogle('signup');
                    if (r?.requires2FA && r.tempToken) {
                        navigation.navigate('TwoFactorChallenge', { tempToken: r.tempToken });
                    }
                }} loading={isLoading} />
            )}

            {/* Truecaller SDK bridge is Android-only — hide the entry point elsewhere */}
            {Platform.OS === 'android' && (
                <TruecallerLoginButton
                    onPress={() => { clearError(); navigation.navigate('TruecallerLogin'); }}
                    loading={isLoading}
                />
            )}

            <Button
                title={t('auth.alreadyHaveAccount')}
                onPress={() => navigation.navigate('Login')}
                variant="text"
                style={{ marginTop: theme.spacing[4] }}
            />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    langBar: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingTop: theme.spacing[3],
    },
    header: {
        paddingTop: theme.spacing[4],
        paddingBottom: theme.spacing[6],
    },
    title: {
        ...theme.typeScale.h1,
        color: theme.roles.light.textPrimary,
    },
    subtitle: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
        marginTop: theme.spacing[2],
    },
    accountTypeLabel: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[2],
    },
    accountTypeRow: {
        flexDirection: 'row',
        gap: theme.spacing[3],
        marginBottom: theme.spacing[2],
    },
    accountCard: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: theme.spacing[4],
        paddingHorizontal: theme.spacing[3],
        borderRadius: theme.radius.md,
        borderWidth: 1.5,
        borderColor: theme.roles.light.borderDefault,
        gap: theme.spacing[1],
    },
    accountCardActive: {
        borderColor: theme.roles.light.primary,
        backgroundColor: theme.roles.light.surfaceOverlay,
    },
    accountCardTitle: {
        ...theme.typeScale.labelMedium,
        color: theme.roles.light.textPrimary,
        marginTop: theme.spacing[1],
    },
    accountCardDesc: {
        ...theme.typeScale.caption,
        color: theme.roles.light.textSecondary,
        textAlign: 'center',
    },
    accountTypeError: {
        ...theme.typeScale.caption,
        color: theme.roles.light.dangerText,
        marginBottom: theme.spacing[2],
    },
    consent: {
        ...theme.typeScale.caption,
        color: theme.roles.light.textSecondary,
        textAlign: 'center',
        marginTop: theme.spacing[3],
        marginHorizontal: theme.spacing[2],
    },
    consentLink: {
        color: theme.roles.light.primary,
        textDecorationLine: 'underline',
    },
    errorBanner: {
        backgroundColor: theme.roles.light.dangerBg,
        borderRadius: theme.radius.sm,
        padding: theme.spacing[4],
        marginBottom: theme.spacing[4],
        borderLeftWidth: 3,
        borderLeftColor: theme.roles.light.dangerText,
    },
    errorText: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.dangerText,
    },
    successContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing[8],
    },
    successIcon: {
        marginBottom: theme.spacing[4],
    },
    successTitle: {
        ...theme.typeScale.h2,
        color: theme.roles.light.textPrimary,
        marginBottom: theme.spacing[3],
    },
    successText: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
});

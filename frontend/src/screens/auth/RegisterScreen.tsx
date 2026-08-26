/**
 * RegisterScreen — artboard 04, "Create account".
 *
 * The intent question that used to sit at the top of this form now has its own
 * screen (IntentScreen, artboard 03) and arrives as a route param; this screen
 * asks for identity only. Confirm-password went with it: the design shows a
 * single password field with a reveal toggle, which is the pattern that
 * replaced re-typing.
 *
 * ── Where this departs from the drawing, and why ──────────────────────────
 * Artboard 04 asks for a MOBILE NUMBER and says "We send a one-time code to
 * this number". The backend cannot do that. `POST /auth/supabase/signup` takes
 * an email and a password (`SignupDto` requires both); `login-otp/*` sends a
 * code to an EMAIL, not a phone; and `auth/dto/send-otp.dto.ts` plus
 * `sms-otp-fallback.service.ts` are unwired scaffolding whose methods throw.
 * The only phone-identity path that actually works is Truecaller
 * (`POST /auth/supabase/oauth/truecaller`), which mints an internal
 * `<digits>@truecaller.temp` address behind a verified number — and it is
 * Android-only, because the bridge is a native SDK.
 *
 * So the primary field here is email, with the design's hint reworded to what
 * genuinely happens, and "Continue with Truecaller" is left as the real
 * phone-first route where the platform supports it. Rendering a mobile-number
 * field that silently could not create an account would be a worse lie than
 * this one honest substitution.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { SignupIntent } from '../../store/authStore';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { theme } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { GoogleLoginButton } from '../../components/ui/GoogleLoginButton';
import { TruecallerLoginButton } from '../../components/ui/TruecallerLoginButton';
import { LanguagePill } from '../../components/ui/LanguagePill';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';
import { passwordPolicyError } from '../../features/passwordPolicy';

/**
 * The design asks for one "Full name" field; the API takes first and last.
 * Everything before the final space is the given name, so "Ravi Kumar Reddy"
 * keeps "Ravi Kumar" together instead of losing the middle name. A single word
 * stays a first name with no surname, which is common and must not error.
 */
export const splitFullName = (full: string): { firstName: string; lastName: string } => {
    const parts = full.trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return { firstName: parts[0] ?? '', lastName: '' };
    return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
};

export const RegisterScreen = ({ navigation, route }: any) => {
    const { t } = useTranslation();
    // Chosen on the previous screen (artboard 03). First-run routing only —
    // it is not sent to the server and grants nothing. Defaulted so a direct
    // arrival (deep link, "Sign up" from Login) still works.
    const intent: SignupIntent = route?.params?.intent ?? 'own_farm';

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [success, setSuccess] = useState(false);

    const { signup, isLoading, error, clearError } = useAuthStore();
    const { signInWithGoogle } = useGoogleAuth();

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (!fullName.trim()) e.fullName = t('auth.fullNameRequired');
        if (!email.trim()) e.email = t('auth.emailRequired');
        else if (!/\S+@\S+\.\S+/.test(email)) e.email = t('auth.emailInvalid');
        if (!password) e.password = t('auth.passwordRequired');
        else {
            // Mirror the server rule exactly so an accepted password is never
            // rejected server-side with a raw untranslated message (PWDVAL-1).
            const rule = passwordPolicyError(password);
            if (rule) e.password = t(rule.key, rule.fallback);
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleRegister = async () => {
        if (!validate()) return;
        clearError();
        try {
            const { firstName, lastName } = splitFullName(fullName);
            await signup(email.trim(), password, firstName, lastName, intent);
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
            <View style={styles.topBar}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.back}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.back')}
                >
                    <Icon name="arrow_back" size={24} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>{t('auth.createAccountTitle')}</Text>
                <LanguagePill variant="dark" />
            </View>

            {error && (
                <View style={styles.errorBanner}>
                    <Icon name="warning" size={20} color={theme.roles.light.dangerText} />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            <Input
                label={t('auth.fullNameLabel')}
                value={fullName}
                onChangeText={setFullName}
                error={errors.fullName}
                placeholder={t('auth.fullNamePlaceholder')}
                autoCapitalize="words"
                required
            />

            <Input
                label={t('auth.emailLabel')}
                value={email}
                onChangeText={setEmail}
                error={errors.email}
                placeholder={t('auth.emailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                required
                hint={t('auth.emailVerifyNote')}
            />

            <Input
                label={t('auth.passwordLabel')}
                value={password}
                onChangeText={setPassword}
                error={errors.password}
                isPassword
                required
                hint={t('auth.passwordHint')}
            />

            <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t('auth.orDivider')}</Text>
                <View style={styles.dividerLine} />
            </View>

            {/* @react-native-google-signin has no web build — hide on web like Truecaller below */}
            {Platform.OS !== 'web' && (
                <GoogleLoginButton onPress={async () => {
                    const r = await signInWithGoogle('signup');
                    if (r?.requires2FA && r.tempToken) {
                        navigation.navigate('TwoFactorChallenge', { tempToken: r.tempToken });
                    }
                }} loading={isLoading} />
            )}

            {/* Truecaller SDK bridge is Android-only — hide the entry point
                elsewhere rather than showing a dead button. This is also the
                only working phone-number sign-up route; see the file header. */}
            {Platform.OS === 'android' && (
                <TruecallerLoginButton
                    onPress={() => { clearError(); navigation.navigate('TruecallerLogin'); }}
                    loading={isLoading}
                />
            )}

            <Button
                title={t('auth.createAccount')}
                onPress={handleRegister}
                loading={isLoading}
                style={styles.cta}
            />

            <Text style={styles.signInLine}>
                {t('auth.signInPrompt')}{' '}
                <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
                    {t('auth.signIn')}
                </Text>
            </Text>

            <Text style={styles.consent}>
                {t('auth.consentPrefix')}{' '}
                <Text style={styles.link} onPress={() => navigation.navigate('Terms')}>
                    {t('settings.termsOfService')}
                </Text>
                {' '}{t('auth.consentAnd')}{' '}
                <Text style={styles.link} onPress={() => navigation.navigate('PrivacyPolicy')}>
                    {t('settings.privacyPolicy')}
                </Text>.
            </Text>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        paddingTop: theme.spacing[2],
        marginBottom: theme.spacing[6],
    },
    back: { width: 44, height: 44, justifyContent: 'center', marginLeft: -theme.spacing[2] },
    title: { ...theme.typeScale.h2, color: theme.roles.light.textPrimary, flex: 1 },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        marginTop: theme.spacing[2],
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: theme.roles.light.borderDefault },
    dividerText: { ...theme.typeScale.bodySmall, color: theme.roles.light.textTertiary },
    cta: { marginTop: theme.spacing[6], alignSelf: 'stretch' },
    signInLine: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
        textAlign: 'center',
        marginTop: theme.spacing[4],
    },
    link: { color: theme.roles.light.textBrand, fontFamily: 'DMSans-SemiBold' },
    consent: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textTertiary,
        textAlign: 'center',
        marginTop: theme.spacing[3],
        marginHorizontal: theme.spacing[2],
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing[2],
        backgroundColor: theme.roles.light.dangerBg,
        borderRadius: theme.radius.sm,
        padding: theme.spacing[4],
        marginBottom: theme.spacing[4],
        borderLeftWidth: 3,
        borderLeftColor: theme.roles.light.dangerBorder,
    },
    errorText: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.dangerText,
        flex: 1,
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

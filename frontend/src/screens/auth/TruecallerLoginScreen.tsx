/**
 * TruecallerLoginScreen — entry point for Truecaller sign-in.
 *
 * Primary path: one-tap OAuth for users WITH the Truecaller app.
 *   `TruecallerAuth.getAuthorizationCode()` drives the native SDK and returns
 *   an authorization code + PKCE `codeVerifier` + `state`, which are POSTed to
 *   `/auth/supabase/oauth/truecaller/exchange`; the backend completes the
 *   server-to-server exchange and returns a Supabase session.
 *
 * Fallback path: users WITHOUT the Truecaller app (or who tap "use another
 * number") are routed to {@link TruecallerPhoneScreen} for missed-call / OTP
 * verification.
 *
 * Trust boundary: nothing here authorizes the user — the backend is the only
 * component that verifies the Truecaller identity.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { TruecallerLoginButton } from '../../components/ui/TruecallerLoginButton';
import { theme } from '../../theme';
import {
    TruecallerAuth,
    type TruecallerErrorCode,
} from '../../native/TruecallerAuth';
import { authApi, type AuthResponse } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';

export interface TruecallerLoginScreenProps {
    navigation: {
        navigate: (route: string, params?: object) => void;
        replace: (route: string, params?: object) => void;
        goBack: () => void;
    };
}

/** Human-readable copy for the non-cancel failure codes. */
function messageForError(error: TruecallerErrorCode): string {
    switch (error) {
        case 'ERROR_TC_NOT_USABLE':
            return 'Truecaller is not available on this device. Make sure the Truecaller app is installed and signed in, or verify with a missed call.';
        case 'ERROR_PLATFORM_UNSUPPORTED':
            return 'Truecaller sign-in is only available on Android. Please continue with email.';
        case 'ERROR_NETWORK':
            return 'Network error. Check your connection and try again.';
        case 'ERROR_SDK_NOT_INITIALIZED':
            return 'Could not start Truecaller. Please try again.';
        default:
            return 'Truecaller sign-in failed. Please try again or continue with email.';
    }
}

export const TruecallerLoginScreen: React.FC<TruecallerLoginScreenProps> = ({
    navigation,
}) => {
    const { t } = useTranslation();
    const setSession = useAuthStore((s) => s.setSession);

    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    // Warm up the SDK so the first tap is responsive. Best-effort.
    useEffect(() => {
        void TruecallerAuth.initialize();
    }, []);

    const goToPhoneFallback = useCallback(() => {
        navigation.navigate('TruecallerPhone');
    }, [navigation]);

    /** Turn an /exchange AuthResponse into a session, 2FA challenge, or error. */
    const handleAuthResponse = useCallback(
        (data: AuthResponse) => {
            if (data.requires2FA && data.tempToken) {
                navigation.navigate('TwoFactorChallenge', {
                    tempToken: data.tempToken,
                });
                return;
            }
            if (data.session) {
                // RootNavigator swaps stacks on isAuthenticated; no explicit nav.
                setSession(data.session);
                return;
            }
            Alert.alert(
                t('auth.loginFailed'),
                t(
                    'auth.truecallerNoSession',
                    'The server did not return a session. Please try again.',
                ),
            );
        },
        [navigation, setSession, t],
    );

    const handleStartAuth = useCallback(async () => {
        setStatusMessage(null);
        setLoading(true);
        try {
            const outcome = await TruecallerAuth.getAuthorizationCode();

            switch (outcome.type) {
                case 'oauth': {
                    const { data } = await authApi.truecallerExchange({
                        authorizationCode: outcome.authorizationCode,
                        codeVerifier: outcome.codeVerifier,
                        state: outcome.state,
                    });
                    handleAuthResponse(data);
                    return;
                }
                case 'verificationRequired':
                case 'unavailable':
                    // No usable Truecaller profile → verify via missed call.
                    goToPhoneFallback();
                    return;
                case 'cancelled':
                    // User dismissed the consent sheet — silent.
                    return;
                case 'error':
                    if (outcome.error === 'ERROR_TC_NOT_USABLE') {
                        goToPhoneFallback();
                        return;
                    }
                    setStatusMessage(messageForError(outcome.error));
                    return;
            }
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response
                ?.status;
            const serverMessage = (
                err as { response?: { data?: { message?: string } } }
            )?.response?.data?.message;
            if (status && status >= 400 && status < 500) {
                Alert.alert(
                    t('auth.loginFailed'),
                    serverMessage ||
                        t(
                            'auth.truecallerVerificationFailed',
                            'Truecaller verification failed. Please try again.',
                        ),
                );
            } else if (status) {
                // A 5xx IS a reply — the server was reached and failed. Titling
                // it "Network error" sent a real user (and the person debugging
                // it) hunting a connectivity problem for a backend bug: a 503
                // carrying Supabase's "User not found" read on screen as
                // "Network Error: User not found".
                Alert.alert(
                    t('auth.serverError', 'Something went wrong'),
                    serverMessage ||
                        t(
                            'auth.serverErrorBody',
                            'The server could not complete sign-in. Please try again, or contact support if it keeps happening.',
                        ),
                );
            } else {
                // No `status` at all — axios never got a reply. This is the only
                // case that is genuinely a network failure.
                Alert.alert(
                    t('auth.networkError'),
                    t(
                        'auth.networkErrorBody',
                        'Could not reach the server. Please try again.',
                    ),
                );
            }
        } finally {
            setLoading(false);
        }
    }, [goToPhoneFallback, handleAuthResponse, t]);

    const handleEmailLoginPress = useCallback(() => {
        navigation.navigate('Login');
    }, [navigation]);

    return (
        <ScreenWrapper keyboardAvoiding>
            <View style={styles.header}>
                <MaterialCommunityIcons
                    name="phone-check"
                    size={48}
                    color={theme.roles.light.primary}
                />
                <Text style={styles.title}>{t('auth.truecallerTitle')}</Text>
                <Text style={styles.subtitle}>{t('auth.truecallerSubtitle')}</Text>
            </View>

            {statusMessage && (
                <View style={styles.statusBanner}>
                    <MaterialCommunityIcons
                        name="alert-circle-outline"
                        size={18}
                        color={theme.roles.light.dangerText}
                    />
                    <Text style={styles.statusBannerText}>{statusMessage}</Text>
                </View>
            )}

            {loading ? (
                <View style={[styles.section, styles.verifyingSection]}>
                    <ActivityIndicator size="large" color={theme.roles.light.primary} />
                    <Text style={styles.verifyingText}>
                        {t('auth.verifyingWithUpcheck')}
                    </Text>
                </View>
            ) : (
                <View style={styles.section}>
                    <TruecallerLoginButton onPress={handleStartAuth} loading={false} />

                    {/* Direct path for users who don't have the Truecaller app. */}
                    <TouchableOpacity
                        onPress={goToPhoneFallback}
                        accessibilityRole="button"
                        accessibilityLabel={t('auth.tcFallbackCta')}
                        style={styles.fallbackLink}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons
                            name="phone-outgoing-outline"
                            size={18}
                            color={theme.roles.light.textSecondary}
                        />
                        <Text style={styles.fallbackLinkText}>
                            {t('auth.tcFallbackCta')}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            <View style={styles.footer}>
                <TouchableOpacity
                    onPress={handleEmailLoginPress}
                    accessibilityRole="link"
                    accessibilityLabel={t('auth.signInWithEmail')}
                    style={styles.emailLink}
                    activeOpacity={0.7}
                    disabled={loading}
                >
                    <MaterialCommunityIcons
                        name="email-outline"
                        size={18}
                        color={theme.roles.light.primary}
                    />
                    <Text style={styles.emailLinkText}>{t('auth.signInWithEmail')}</Text>
                </TouchableOpacity>
            </View>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        alignItems: 'center',
        paddingTop: theme.spacing[6],
        paddingBottom: theme.spacing[6],
    },
    title: {
        ...theme.typeScale.h1,
        color: theme.roles.light.textPrimary,
        marginTop: theme.spacing[3],
        marginBottom: theme.spacing[2],
        textAlign: 'center',
    },
    subtitle: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
        textAlign: 'center',
    },
    section: {
        paddingVertical: theme.spacing[2],
    },
    fallbackLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing[2],
        paddingVertical: theme.spacing[3],
        marginTop: theme.spacing[2],
    },
    fallbackLinkText: {
        ...theme.typeScale.labelLarge,
        color: theme.roles.light.textSecondary,
    },
    statusBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing[2],
        backgroundColor: theme.roles.light.dangerBg,
        borderLeftWidth: 3,
        borderLeftColor: theme.roles.light.dangerText,
        borderRadius: theme.radius.sm,
        padding: theme.spacing[4],
        marginBottom: theme.spacing[4],
    },
    statusBannerText: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.dangerText,
        flex: 1,
    },
    verifyingSection: {
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingVertical: theme.spacing[8],
    },
    verifyingText: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
    },
    footer: {
        marginTop: theme.spacing[6],
        alignItems: 'center',
    },
    emailLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        paddingVertical: theme.spacing[3],
        paddingHorizontal: theme.spacing[4],
    },
    emailLinkText: {
        ...theme.typeScale.labelLarge,
        color: theme.roles.light.primary,
    },
});

export default TruecallerLoginScreen;

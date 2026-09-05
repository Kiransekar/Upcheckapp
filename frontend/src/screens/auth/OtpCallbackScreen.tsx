import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { theme } from '../../theme';
import { supabase } from '../../lib/supabase';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { capture, EVENTS } from '../../features/analytics';

const c = theme.roles.light;

/**
 * Landing for the passwordless-login email link (deep-linked as
 * upcheckapp://otp-callback). Supabase's magic-link email puts the clickable
 * CTA next to the 6-digit code, and users click it — this screen makes that
 * click actually complete sign-in instead of dead-ending on a web page.
 *
 * Same tokens-in-fragment handoff as ResetPasswordScreen, but a magic link
 * IS a completed login, not just a password-change credential — so once the
 * local session is set we still route it through reset2faCheck (the same
 * "verify a client-established session and gate on 2FA" endpoint) before
 * treating the user as signed in. Skipping that would silently bypass 2FA
 * for anyone who signs in via the emailed link.
 */
export const OtpCallbackScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const setSession = useAuthStore((s) => s.setSession);
    const [state, setState] = useState<'verifying' | 'error'>('verifying');

    useEffect(() => {
        const handleUrl = async (url: string | null) => {
            if (!url) return;
            const fragment = url.split('#')[1] ?? '';
            const grab = (key: string) => {
                const m = fragment.match(new RegExp(`(?:^|&)${key}=([^&]+)`));
                return m ? decodeURIComponent(m[1]) : null;
            };
            const access_token = grab('access_token');
            const refresh_token = grab('refresh_token');
            if (!access_token || !refresh_token) {
                setState('error');
                return;
            }

            try {
                const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
                if (setErr) throw setErr;

                const { data } = await authApi.reset2faCheck(access_token, refresh_token);
                if (data.requires2FA && data.tempToken) {
                    // Never treat a 2FA-gated account as signed in from the link alone.
                    await supabase.auth.signOut({ scope: 'local' });
                    navigation.navigate('TwoFactorChallenge', { tempToken: data.tempToken });
                    return;
                }

                const { data: sess } = await supabase.auth.getSession();
                if (sess.session) {
                    setSession(sess.session);
                    // Reported HERE and not inside setSession: api/client.ts calls
                    // setSession on every silent token refresh, so an event there
                    // would count a refresh as a login. This is the emailed magic-link callback.
                    capture(EVENTS.LOGIN_COMPLETED, { method: 'otp' });
                } else {
                    setState('error');
                }
            } catch {
                setState('error');
            }
        };

        Linking.getInitialURL().then(handleUrl);
        const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
        return () => sub.remove();
    }, []);

    return (
        <ScreenWrapper>
            <Card style={styles.card}>
                {state === 'verifying' ? (
                    <>
                        <ActivityIndicator size="large" color={c.primary} style={styles.spinner} />
                        <Text style={styles.text}>{t('auth.completingSignIn', 'Completing sign-in…')}</Text>
                    </>
                ) : (
                    <>
                        <Text style={styles.text}>
                            {t('auth.otpLinkExpired', 'This sign-in link is invalid or has expired.')}
                        </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('OtpLogin')} style={styles.fallback}>
                            <Text style={styles.fallbackText}>{t('auth.useOtpInstead', 'Sign in with a one-time code instead')}</Text>
                        </TouchableOpacity>
                    </>
                )}
            </Card>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    card: { padding: theme.spacing[6], alignItems: 'center', marginTop: theme.spacing[8] },
    spinner: { marginBottom: theme.spacing[4] },
    text: { ...theme.typeScale.bodyMedium, color: c.textPrimary, textAlign: 'center' },
    fallback: { marginTop: theme.spacing[4], alignItems: 'center' },
    fallbackText: { ...theme.typeScale.labelMedium, color: c.primary },
});

export default OtpCallbackScreen;

/**
 * TruecallerPhoneScreen — missed-call / OTP verification for users WITHOUT the
 * Truecaller app (Truecaller "non-Truecaller user" flow; India + Android only).
 *
 * Flow:
 *   1. User enters their mobile number + name and taps "Verify with missed call".
 *   2. `TruecallerAuth.requestVerification(phone)` asks the native SDK to place
 *      a silent drop-call (or, on eligible accounts, a Truecaller-IM OTP).
 *   3. Progress arrives as `TruecallerVerification` events:
 *        MISSED_CALL_INITIATED → we show a "calling you" waiting state
 *        MISSED_CALL_RECEIVED  → the call was auto-detected; we call
 *                                `verifyMissedCall(firstName, lastName)`
 *        OTP_INITIATED/RECEIVED→ OTP fallback (Truecaller IM)
 *        VERIFICATION_COMPLETE / PROFILE_VERIFIED_BEFORE → an `accessToken` is
 *                                delivered
 *   4. The `accessToken` + phone + name are POSTed to
 *      `/auth/supabase/oauth/truecaller`; the backend re-validates the token
 *      server-to-server (phone is the only verified identity) and mints a
 *      session.
 *
 * The event listener reads name/phone from refs so it always sees the latest
 * user input despite being registered once on mount.
 *
 * NOTE: the missed-call flow needs READ_PHONE_STATE + READ_CALL_LOG runtime
 * permissions and is officially "deprecating soon" on Truecaller's side; a
 * Supabase SMS-OTP fallback is scaffolded separately for a future swap.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    PermissionsAndroid,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { theme } from '../../theme';
import { authApi, type AuthResponse } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { capture, EVENTS } from '../../features/analytics';
import { ConsentNotice } from '../../components/ui/ConsentNotice';
import {
    TruecallerAuth,
    type TruecallerVerificationEvent,
} from '../../native/TruecallerAuth';

type Stage = 'input' | 'calling' | 'otp' | 'submitting';

// A name must contain at least one letter and be < 128 chars (Truecaller rule).
const NAME_RE = /[A-Za-zÀ-ɏऀ-ॿ]/;
// Indian mobile: 10 digits starting 6–9.
const PHONE_RE = /^[6-9]\d{9}$/;

export const TruecallerPhoneScreen = ({ navigation, route }: any) => {
    const { t } = useTranslation();
    const setSession = useAuthStore((s) => s.setSession);
    const armSignupIntent = useAuthStore((s) => s.armSignupIntent);

    const [stage, setStage] = useState<Stage>('input');
    const [phone, setPhone] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [otp, setOtp] = useState('');
    const [ttl, setTtl] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Refs so the mount-once event listener always reads current input.
    const phoneRef = useRef('');
    const firstNameRef = useRef('');
    const lastNameRef = useRef('');
    useEffect(() => {
        phoneRef.current = phone;
    }, [phone]);
    useEffect(() => {
        firstNameRef.current = firstName;
    }, [firstName]);
    useEffect(() => {
        lastNameRef.current = lastName;
    }, [lastName]);

    // Safety net so "Calling you…" can't hang forever: if the SDK places no
    // drop-call and fires no callback within the window (e.g. the number is
    // already a Truecaller user — Truecaller won't drop-call its own users, or
    // a network issue), surface a clear message and return to the input.
    const stageRef = useRef<Stage>('input');
    const verifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        stageRef.current = stage;
    }, [stage]);
    const clearVerifyTimeout = useCallback(() => {
        if (verifyTimeoutRef.current) {
            clearTimeout(verifyTimeoutRef.current);
            verifyTimeoutRef.current = null;
        }
    }, []);

    const supported = TruecallerAuth.isSupported();

    // Warm up the async SDK init on mount so the first verify is responsive.
    useEffect(() => {
        void TruecallerAuth.initialize();
    }, []);

    const handleAuthResponse = useCallback(
        (data: AuthResponse) => {
            if (data.requires2FA && data.tempToken) {
                navigation.navigate('TwoFactorChallenge', {
                    tempToken: data.tempToken,
                });
                return;
            }
            if (data.session) {
                setSession(data.session);
                // Reported HERE and not inside setSession: api/client.ts calls
                // setSession on every silent token refresh, so an event there
                // would count a refresh as a login. This is the Truecaller missed-call fallback.
                capture(EVENTS.LOGIN_COMPLETED, { method: 'truecaller' });
                // IntentScreen's answer, carried through the missed-call
                // fallback. Only present when this flow began at Register — see
                // TruecallerLoginScreen for why arming is conditional.
                if (route?.params?.intent) armSignupIntent(route.params.intent);
                return;
            }
            setError(
                t(
                    'auth.truecallerNoSession',
                    'The server did not return a session. Please try again.',
                ),
            );
            setStage('input');
        },
        [navigation, setSession, armSignupIntent, route?.params?.intent, t],
    );

    const submitToken = useCallback(
        async (accessToken: string, fnFromSdk?: string, lnFromSdk?: string) => {
            setStage('submitting');
            try {
                const { data } = await authApi.truecallerMissedCall({
                    accessToken,
                    phoneNumber: `+91${phoneRef.current}`,
                    firstName:
                        firstNameRef.current.trim() || fnFromSdk?.trim() || 'User',
                    lastName:
                        lastNameRef.current.trim() || lnFromSdk?.trim() || undefined,
                });
                handleAuthResponse(data);
            } catch (err: unknown) {
                const serverMessage = (
                    err as { response?: { data?: { message?: string } } }
                )?.response?.data?.message;
                setError(
                    serverMessage ||
                        t('auth.tcVerificationFailed', 'Verification failed. Please try again.'),
                );
                setStage('input');
            }
        },
        [handleAuthResponse, t],
    );

    // Register the verification event listener once. It drives every stage
    // transition after `requestVerification` is called.
    useEffect(() => {
        const sub = TruecallerAuth.addVerificationListener(
            (e: TruecallerVerificationEvent) => {
                // The SDK responded — cancel the no-response safety timeout.
                clearVerifyTimeout();
                switch (e.status) {
                    case 'MISSED_CALL_INITIATED':
                        setError(null);
                        setStage('calling');
                        setTtl(typeof e.ttl === 'number' ? e.ttl : null);
                        break;
                    case 'MISSED_CALL_RECEIVED':
                        // Call auto-detected — complete with the user's name.
                        void TruecallerAuth.verifyMissedCall(
                            firstNameRef.current.trim() || 'User',
                            lastNameRef.current.trim(),
                        ).catch(() => {
                            setError(
                                t(
                                    'auth.tcVerificationFailed',
                                    'Verification failed. Please try again.',
                                ),
                            );
                            setStage('input');
                        });
                        break;
                    case 'OTP_INITIATED':
                        setError(null);
                        setStage('otp');
                        setTtl(typeof e.ttl === 'number' ? e.ttl : null);
                        break;
                    case 'OTP_RECEIVED':
                        if (e.otp) setOtp(e.otp);
                        break;
                    case 'VERIFICATION_COMPLETE':
                    case 'PROFILE_VERIFIED_BEFORE':
                        if (e.accessToken) {
                            void submitToken(e.accessToken, e.firstName, e.lastName);
                        } else {
                            setError(
                                t(
                                    'auth.tcVerificationFailed',
                                    'Verification failed. Please try again.',
                                ),
                            );
                            setStage('input');
                        }
                        break;
                    case 'ERROR':
                        setError(
                            e.message ||
                                t(
                                    'auth.tcVerificationFailed',
                                    'Verification failed. Please try again.',
                                ),
                        );
                        setStage('input');
                        break;
                }
            },
        );
        return () => {
            sub.remove();
            clearVerifyTimeout();
            TruecallerAuth.clear();
        };
    }, [submitToken, t, clearVerifyTimeout]);

    // TTL countdown for the waiting / OTP states.
    useEffect(() => {
        if (ttl == null || ttl <= 0) return;
        const id = setInterval(() => {
            setTtl((v) => (v && v > 1 ? v - 1 : 0));
        }, 1000);
        return () => clearInterval(id);
    }, [ttl]);

    const startVerification = useCallback(async () => {
        setError(null);
        const national = phone.replace(/\D/g, '').slice(-10);
        if (!PHONE_RE.test(national)) {
            setError(t('auth.tcInvalidPhone', 'Enter a valid 10-digit mobile number.'));
            return;
        }
        if (!NAME_RE.test(firstName.trim())) {
            setError(t('auth.tcFirstNameRequired', 'Please enter your first name.'));
            return;
        }
        setPhone(national);
        phoneRef.current = national;

        // The native SDK inits asynchronously (3.3.0 initAsync); await it so
        // requestVerification runs only once the SDK is ready.
        await TruecallerAuth.initialize();

        // Missed-call detection needs phone-state + call-log + (Android 8+)
        // answer-phone-calls access — the Truecaller SDK requires all three or
        // it fails with "phone permission missing".
        if (Platform.OS === 'android') {
            try {
                const perms = [
                    PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
                    PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
                ];
                if (PermissionsAndroid.PERMISSIONS.ANSWER_PHONE_CALLS) {
                    perms.push(PermissionsAndroid.PERMISSIONS.ANSWER_PHONE_CALLS);
                }
                const granted = await PermissionsAndroid.requestMultiple(perms);
                const ok = Object.values(granted).every(
                    (v) => v === PermissionsAndroid.RESULTS.GRANTED,
                );
                if (!ok) {
                    setError(
                        t(
                            'auth.tcPermissionsRequired',
                            'Phone and call-log permissions are needed to auto-detect the verification call. Please grant them, or sign in with Truecaller / email.',
                        ),
                    );
                    return;
                }
            } catch {
                // fall through — requestVerification will surface any hard failure
            }
        }

        setStage('calling');
        try {
            await TruecallerAuth.requestVerification(national);
            // Arm the no-response safety net; any SDK callback clears it.
            clearVerifyTimeout();
            verifyTimeoutRef.current = setTimeout(() => {
                if (stageRef.current === 'calling') {
                    setError(
                        t(
                            'auth.tcNoCallDetected',
                            "We couldn't detect a verification call. If this number already uses Truecaller, go back and use one-tap sign-in — or try a different number.",
                        ),
                    );
                    setStage('input');
                }
            }, 45000);
        } catch {
            setError(
                t('auth.tcVerificationFailed', 'Verification failed. Please try again.'),
            );
            setStage('input');
        }
    }, [firstName, phone, t, clearVerifyTimeout]);

    const submitOtp = useCallback(async () => {
        const code = otp.replace(/\D/g, '');
        if (code.length < 4) {
            setError(t('auth.tcInvalidOtp', 'Enter the code you received.'));
            return;
        }
        setError(null);
        setStage('submitting');
        try {
            await TruecallerAuth.verifyOtp(
                firstNameRef.current.trim() || 'User',
                lastNameRef.current.trim(),
                code,
            );
            // VERIFICATION_COMPLETE arrives via the event listener.
        } catch {
            setError(
                t('auth.tcVerificationFailed', 'Verification failed. Please try again.'),
            );
            setStage('otp');
        }
    }, [otp, t]);

    const resetToInput = useCallback(() => {
        clearVerifyTimeout();
        TruecallerAuth.clear();
        setStage('input');
        setOtp('');
        setTtl(null);
        setError(null);
    }, [clearVerifyTimeout]);

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backBtn}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.back', 'Back')}
                >
                    <MaterialCommunityIcons
                        name="arrow-left"
                        size={24}
                        color={theme.roles.light.textPrimary}
                    />
                </TouchableOpacity>
                <Text style={styles.title}>{t('auth.tcPhoneTitle', 'Verify your number')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {!supported && (
                    <View style={styles.statusBanner}>
                        <MaterialCommunityIcons
                            name="information-outline"
                            size={18}
                            color={theme.roles.light.dangerText}
                        />
                        <Text style={styles.statusBannerText}>
                            {t(
                                'auth.tcUnsupported',
                                'Missed-call verification is only available on Android with the app build that bundles the Truecaller SDK.',
                            )}
                        </Text>
                    </View>
                )}

                {error && (
                    <View style={styles.statusBanner}>
                        <MaterialCommunityIcons
                            name="alert-circle-outline"
                            size={18}
                            color={theme.roles.light.dangerText}
                        />
                        <Text style={styles.statusBannerText}>{error}</Text>
                    </View>
                )}

                {stage === 'input' && (
                    <Card style={styles.card}>
                        <Text style={styles.subtitle}>
                            {t(
                                'auth.tcPhoneSubtitle',
                                "We'll place a quick missed call to verify your number — nothing to type.",
                            )}
                        </Text>
                        <Input
                            label={t('auth.tcPhoneLabel', 'Mobile number')}
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="9876543210"
                            keyboardType="phone-pad"
                            maxLength={10}
                            required
                        />
                        <Input
                            label={t('auth.tcFirstNameLabel', 'First name')}
                            value={firstName}
                            onChangeText={setFirstName}
                            placeholder={t('auth.tcFirstNamePlaceholder', 'e.g. Aarav')}
                            required
                        />
                        <Input
                            label={t('auth.tcLastNameLabel', 'Last name (optional)')}
                            value={lastName}
                            onChangeText={setLastName}
                            placeholder={t('auth.tcLastNamePlaceholder', 'e.g. Sharma')}
                        />
                        <Button
                            title={t('auth.tcSendVerification', 'Verify with missed call')}
                            onPress={startVerification}
                            disabled={!supported}
                            style={styles.btn}
                        />
                    </Card>
                )}

                {(stage === 'calling' || stage === 'submitting') && (
                    <Card style={[styles.card, styles.waitingCard]}>
                        <ActivityIndicator size="large" color={theme.roles.light.primary} />
                        <Text style={styles.waitingTitle}>
                            {stage === 'submitting'
                                ? t('auth.verifyingWithUpcheck')
                                : t('auth.tcCallingTitle', 'Calling you…')}
                        </Text>
                        {stage === 'calling' && (
                            <Text style={styles.waitingBody}>
                                {t('auth.tcCallingBody', {
                                    phone: `+91 ${phone}`,
                                    defaultValue:
                                        "We're placing a quick call to {{phone}}. Don't pick up — we'll detect it automatically.",
                                })}
                            </Text>
                        )}
                        {ttl != null && ttl > 0 && stage === 'calling' && (
                            <Text style={styles.ttlText}>
                                {t('auth.expiresIn', { seconds: ttl })}
                            </Text>
                        )}
                        {stage === 'calling' && (
                            <TouchableOpacity onPress={resetToInput}>
                                <Text style={styles.changeNumber}>
                                    {t('auth.tcChangeNumber', 'Use a different number')}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </Card>
                )}

                {stage === 'otp' && (
                    <Card style={styles.card}>
                        <Text style={styles.subtitle}>
                            {t('auth.tcOtpBody', {
                                phone: `+91 ${phone}`,
                                defaultValue: 'Enter the code sent to {{phone}}.',
                            })}
                        </Text>
                        <Input
                            label={t('auth.otpLabel', 'OTP')}
                            value={otp}
                            onChangeText={setOtp}
                            placeholder="123456"
                            keyboardType="number-pad"
                            maxLength={8}
                            required
                        />
                        {ttl != null && ttl > 0 && (
                            <Text style={styles.ttlText}>
                                {t('auth.expiresIn', { seconds: ttl })}
                            </Text>
                        )}
                        <Button
                            title={t('auth.tcVerify', 'Verify')}
                            onPress={submitOtp}
                            style={styles.btn}
                        />
                        <TouchableOpacity onPress={resetToInput}>
                            <Text style={styles.changeNumber}>
                                {t('auth.tcChangeNumber', 'Use a different number')}
                            </Text>
                        </TouchableOpacity>
                    </Card>
                )}
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
    subtitle: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
        marginBottom: theme.spacing[4],
    },
    btn: { marginTop: theme.spacing[3] },
    waitingCard: {
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingVertical: theme.spacing[8],
    },
    waitingTitle: {
        ...theme.typeScale.h3,
        color: theme.roles.light.textPrimary,
        textAlign: 'center',
    },
    waitingBody: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
        textAlign: 'center',
    },
    ttlText: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textTertiary,
        textAlign: 'center',
    },
    changeNumber: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.primary,
        textAlign: 'center',
        marginTop: theme.spacing[3],
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
});

export default TruecallerPhoneScreen;

import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Animated, Share, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-native-qrcode-svg';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { WORKER_QR_PREFIX } from '../../api/farmMembers';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Skeleton, SkeletonAvatar } from '../../components/ui/Skeleton';
import { ErrorState, NetworkError } from '../../components/ui/ErrorState';
import { theme } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { profilesApi, ProfileCompat, CompatUpdateProfileDto } from '../../api/profiles';
import { authApi } from '../../api/auth';
import { apiErrorMessage } from '../../api/errors';
import { TruecallerAuth } from '../../native/TruecallerAuth';

export const ProfileScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const { user } = useAuthStore();
    const showToast = useUIStore((s) => s.showToast);

    // The worker code was QR-only in practice — no way to get it onto the
    // clipboard or into a chat/SMS message for a remote owner, only usable
    // if the two people are physically together with a camera.
    const handleCopyWorkerCode = useCallback(async () => {
        if (!user?.id) return;
        await Clipboard.setStringAsync(user.id);
        showToast({ message: t('members.workerCodeCopied', 'Code copied'), type: 'success' });
    }, [user?.id, showToast, t]);

    const handleShareWorkerCode = useCallback(async () => {
        if (!user?.id) return;
        try {
            await Share.share({
                message: t('members.workerCodeShareMessage', 'My Upcheck worker code: {{code}}', { code: user.id }),
            });
        } catch {
            // User cancelled the share sheet — not an error.
        }
    }, [user?.id, t]);

    // Deleting an account wipes every farm/pond/record the user owns and is
    // irreversible — far too destructive for a single Alert tap. Route to the
    // dedicated strict-confirmation screen (typed confirmation + password
    // re-auth) instead of confirming inline here.
    const handleDeleteAccount = () => navigation.navigate('DeleteAccount');

    // Safe cross-provider linking: an already-signed-in user (email/Google)
    // attaches their phone via Truecaller one-tap. The backend links only by
    // the VERIFIED phone; a number already on another account returns 409.
    const [isLinking, setIsLinking] = useState(false);
    const handleLinkTruecaller = useCallback(async () => {
        setIsLinking(true);
        try {
            const outcome = await TruecallerAuth.getAuthorizationCode();
            if (outcome.type !== 'oauth') {
                if (outcome.type === 'cancelled') return;
                showToast({
                    message: t(
                        'settings.linkTruecallerUnavailable',
                        'Truecaller isn\'t available. Open the Truecaller app, sign in, then try again.',
                    ),
                    type: 'error',
                });
                return;
            }
            const { data } = await authApi.truecallerLinkExchange({
                authorizationCode: outcome.authorizationCode,
                codeVerifier: outcome.codeVerifier,
                state: outcome.state,
            });
            setPhone(data.phoneNumber);
            setProfile((p) => (p ? { ...p, phone: data.phoneNumber } : p));
            showToast({
                message: t('settings.phoneLinked', 'Phone number linked'),
                type: 'success',
            });
        } catch (err: any) {
            const status = err?.response?.status;
            // '' so the `serverMsg || t(…)` fallback below still applies.
            const serverMsg = apiErrorMessage(err, '');
            if (status === 409) {
                showToast({
                    message:
                        serverMsg ||
                        t(
                            'settings.phoneAlreadyLinked',
                            'That number is already linked to another account.',
                        ),
                    type: 'error',
                });
            } else {
                showToast({
                    message: t(
                        'settings.linkTruecallerFailed',
                        'Could not link your number. Please try again.',
                    ),
                    type: 'error',
                });
            }
        } finally {
            setIsLinking(false);
        }
    }, [showToast, t]);

    const [profile, setProfile] = useState<ProfileCompat | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<any>(null);
    const [isOffline, setIsOffline] = useState(false);

    // Edit form state
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');

    // Animation refs
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    const fadeIn = useCallback(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }),
        ]).start();
    }, [fadeAnim, slideAnim]);

    const fetchProfile = useCallback(async () => {
        setError(null);
        setIsOffline(false);

        try {
            const { data } = await profilesApi.getMine();
            setProfile(data);
            setFirstName(data.firstName || '');
            setLastName(data.lastName || '');
            setPhone(data.phone || '');
            fadeIn();
        } catch (err: any) {
            const statusCode = err?.response?.status;
            if (statusCode === 0 || err?.code === 'NETWORK_ERROR' || !err?.response) {
                setIsOffline(true);
            }
            setError(err);
        } finally {
            setIsLoading(false);
        }
    }, [fadeIn]);

    // React Navigation keeps this screen mounted, so a mount-only fetch never
    // re-ran on return — this is the direct write path CreateFarmScreen's
    // sibling, ProfileScreen's own `handleSave` (line ~180 below), used to
    // bypass entirely: the interceptor now invalidates nothing for /profiles
    // (see query/client.ts), so this screen must ask again itself on focus.
    useFocusEffect(useCallback(() => { fetchProfile(); }, [fetchProfile]));

    const handleRetry = useCallback(() => {
        setIsLoading(true);
        fetchProfile();
    }, [fetchProfile]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updateData: CompatUpdateProfileDto = {
                firstName: firstName.trim() || undefined,
                lastName: lastName.trim() || undefined,
                phone: phone.trim() || undefined,
            };

            const { data } = await profilesApi.update(user?.id || '', updateData);
            setProfile(data);
            setIsEditing(false);
            Alert.alert(t('common.ok'), t('settings.profileUpdated'));
        } catch (error: any) {
            Alert.alert(t('common.error'), apiErrorMessage(error, t('settings.profileUpdateFailed')));
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setFirstName(profile?.firstName || '');
        setLastName(profile?.lastName || '');
        setPhone(profile?.phone || '');
        setIsEditing(false);
    };

    const renderSkeleton = () => (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.headerBackground}>
                <View style={styles.headerTop}>
                    <Skeleton width={100} height={24} />
                    <Skeleton width={24} height={24} borderRadius={12} />
                </View>
                <View style={styles.profileInfoContainer}>
                    <SkeletonAvatar size={80} />
                    <Skeleton width={150} height={28} style={styles.mb2} />
                    <Skeleton width={180} height={16} />
                </View>
            </View>
            <View style={styles.content}>
                <Card style={styles.infoCard}>
                    <Skeleton width="100%" height={40} style={styles.mb3} />
                    <Skeleton width="100%" height={40} style={styles.mb3} />
                    <Skeleton width="100%" height={40} style={styles.mb3} />
                    <Skeleton width="100%" height={40} />
                </Card>
            </View>
        </ScreenWrapper>
    );

    if (isLoading) {
        return renderSkeleton();
    }

    if (isOffline) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                <View style={styles.headerBackground}>
                    <View style={styles.headerTop}>
                        <Text style={styles.headerTitle}>{t('settings.profile')}</Text>
                    </View>
                </View>
                <NetworkError onRetry={handleRetry} />
            </ScreenWrapper>
        );
    }

    if (error && !profile) {
        return (
            <ScreenWrapper scroll={false} padded={false}>
                <View style={styles.headerBackground}>
                    <View style={styles.headerTop}>
                        <Text style={styles.headerTitle}>{t('settings.profile')}</Text>
                    </View>
                </View>
                <ErrorState
                    title={t('settings.profileLoadError')}
                    error={error}
                    onRetry={handleRetry}
                />
            </ScreenWrapper>
        );
    }

    const displayName = isEditing
        ? `${firstName} ${lastName}`.trim() || user?.email?.split('@')[0] || 'User'
        : profile?.firstName && profile?.lastName
            ? `${profile.firstName} ${profile.lastName}`
            : user?.name || user?.email?.split('@')[0] || 'User';

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.headerBackground}>
                <View style={styles.headerTop}>
                    <Text style={styles.headerTitle}>{t('settings.profile')}</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('MainApp', { screen: 'Settings' })}>
                        <MaterialCommunityIcons name="cog" size={24} color={theme.roles.light.surface} />
                    </TouchableOpacity>
                </View>

                <Animated.View style={[styles.profileInfoContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                    <View style={styles.avatarContainer}>
                        <MaterialCommunityIcons name="account" size={48} color={theme.roles.light.primary} />
                    </View>
                    <Text style={styles.userName}>{displayName}</Text>
                    <Text style={styles.userEmail}>{user?.email || 'N/A'}</Text>
                </Animated.View>
            </View>

            <Animated.View style={{ opacity: fadeAnim }}>
                <ScrollView contentContainerStyle={styles.content}>
                    {isEditing ? (
                        <Card style={styles.editCard}>
                            <Text style={styles.editTitle}>{t('settings.editProfile')}</Text>

                            <Input
                                label={t('settings.firstNameLabel')}
                                value={firstName}
                                onChangeText={setFirstName}
                                placeholder={t('settings.firstNamePlaceholder')}
                            />

                            <Input
                                label={t('settings.lastNameLabel')}
                                value={lastName}
                                onChangeText={setLastName}
                                placeholder={t('settings.lastNamePlaceholder')}
                            />

                            <Input
                                label={t('settings.phoneNumber')}
                                value={phone}
                                onChangeText={setPhone}
                                placeholder={t('settings.phonePlaceholder')}
                                keyboardType="phone-pad"
                            />

                            <View style={styles.editButtons}>
                                <Button
                                    title={t('common.cancel')}
                                    onPress={handleCancel}
                                    variant="outlined"
                                    style={styles.cancelBtn}
                                />
                                <Button
                                    title={t('common.save')}
                                    onPress={handleSave}
                                    loading={isSaving}
                                    style={styles.saveBtn}
                                />
                            </View>
                        </Card>
                    ) : (
                        <Card style={styles.infoCard}>
                            <View style={styles.infoRow}>
                                <MaterialCommunityIcons name="email" size={20} color={theme.roles.light.textSecondary} />
                                <View style={styles.infoTextContainer}>
                                    <Text style={styles.infoLabel}>{t('settings.emailAddress')}</Text>
                                    <Text style={styles.infoValue}>{user?.email || 'N/A'}</Text>
                                </View>
                            </View>

                            <View style={styles.infoRow}>
                                <MaterialCommunityIcons name="account" size={20} color={theme.roles.light.textSecondary} />
                                <View style={styles.infoTextContainer}>
                                    <Text style={styles.infoLabel}>{t('settings.fullName')}</Text>
                                    <Text style={styles.infoValue}>{displayName}</Text>
                                </View>
                            </View>

                            <View style={styles.infoRow}>
                                <MaterialCommunityIcons name="phone" size={20} color={theme.roles.light.textSecondary} />
                                <View style={styles.infoTextContainer}>
                                    <Text style={styles.infoLabel}>{t('settings.phoneNumber')}</Text>
                                    <Text style={styles.infoValue}>{profile?.phone || t('settings.profileNotSet')}</Text>
                                </View>
                            </View>

                            <View style={[styles.infoRow, styles.noBorder]}>
                                <MaterialCommunityIcons name="calendar" size={20} color={theme.roles.light.textSecondary} />
                                <View style={styles.infoTextContainer}>
                                    <Text style={styles.infoLabel}>{t('settings.memberSince')}</Text>
                                    <Text style={styles.infoValue}>
                                        {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}
                                    </Text>
                                </View>
                            </View>
                        </Card>
                    )}

                    {!isEditing && user?.id && (
                        <Card style={styles.infoCard}>
                            <View style={styles.qrHeader}>
                                <MaterialCommunityIcons name="qrcode" size={20} color={theme.roles.light.primary} />
                                <Text style={styles.qrTitle}>{t('members.workerCode')}</Text>
                            </View>
                            <Text style={styles.qrHint}>{t('members.workerCodeHint')}</Text>
                            <View style={styles.qrBox}>
                                <QRCode
                                    value={`${WORKER_QR_PREFIX}${user.id}`}
                                    size={180}
                                    color={theme.roles.light.textPrimary}
                                    backgroundColor={theme.roles.light.surface}
                                />
                            </View>
                            <Text style={styles.qrId} selectable>{user.id}</Text>
                            <View style={styles.qrActions}>
                                <TouchableOpacity style={styles.qrActionBtn} onPress={handleCopyWorkerCode} accessibilityRole="button">
                                    <MaterialCommunityIcons name="content-copy" size={18} color={theme.roles.light.primary} />
                                    <Text style={styles.qrActionText}>{t('common.copy', 'Copy')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.qrActionBtn} onPress={handleShareWorkerCode} accessibilityRole="button">
                                    <MaterialCommunityIcons name="share-variant" size={18} color={theme.roles.light.primary} />
                                    <Text style={styles.qrActionText}>{t('common.share', 'Share')}</Text>
                                </TouchableOpacity>
                            </View>
                        </Card>
                    )}

                    {!isEditing && Platform.OS === 'android' && TruecallerAuth.isSupported() && (
                        <Button
                            title={t('settings.linkTruecaller', 'Link your phone (Truecaller)')}
                            onPress={handleLinkTruecaller}
                            loading={isLinking}
                            variant="outlined"
                            icon="phone-check"
                            style={styles.editBtn}
                        />
                    )}

                    {!isEditing && (
                        <Button
                            title={t('settings.editProfile')}
                            onPress={() => setIsEditing(true)}
                            style={styles.editBtn}
                            icon="pencil"
                        />
                    )}

                    {!isEditing && (
                        <>
                            <Button
                                title={t('settings.deleteAccount')}
                                onPress={handleDeleteAccount}
                                variant="outlined"
                                icon="account-remove"
                                style={styles.deleteBtn}
                                textStyle={{ color: theme.roles.light.dangerText }}
                            />
                            <Text style={styles.deleteHint}>{t('settings.deleteAccountHint')}</Text>
                        </>
                    )}
                </ScrollView>
            </Animated.View>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    headerBackground: {
        backgroundColor: theme.roles.light.primary,
        paddingTop: theme.spacing[12],
        paddingBottom: theme.spacing[8],
        borderBottomLeftRadius: theme.radius.xl,
        borderBottomRightRadius: theme.radius.xl,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: theme.spacing[4],
        marginBottom: theme.spacing[4],
    },
    headerTitle: {
        ...theme.typeScale.h3,
        color: theme.roles.light.surface,
    },
    profileInfoContainer: {
        alignItems: 'center',
    },
    avatarContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: theme.roles.light.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: theme.spacing[3],
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },
    userName: {
        ...theme.typeScale.h2,
        color: theme.roles.light.surface,
        marginBottom: 4,
    },
    userEmail: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.surface + 'CC',
    },
    content: {
        padding: theme.spacing[4],
    },
    infoCard: {
        padding: theme.spacing[4],
        marginBottom: theme.spacing[6],
        marginTop: -theme.spacing[4],
    },
    qrHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], marginBottom: theme.spacing[1] },
    qrTitle: { ...theme.typeScale.labelLarge, color: theme.roles.light.textPrimary },
    qrHint: { ...theme.typeScale.bodySmall, color: theme.roles.light.textSecondary, marginBottom: theme.spacing[4] },
    qrBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: theme.spacing[2] },
    qrId: { ...theme.typeScale.caption, color: theme.roles.light.textTertiary, textAlign: 'center', marginTop: theme.spacing[3] },
    qrActions: { flexDirection: 'row', justifyContent: 'center', gap: theme.spacing[5], marginTop: theme.spacing[4] },
    qrActionBtn: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1], padding: theme.spacing[2] },
    qrActionText: { ...theme.typeScale.labelMedium, color: theme.roles.light.primary, fontWeight: '600' },
    editCard: {
        padding: theme.spacing[4],
        marginBottom: theme.spacing[6],
        marginTop: -theme.spacing[4],
    },
    editTitle: {
        ...theme.typeScale.h4,
        color: theme.roles.light.textPrimary,
        marginBottom: theme.spacing[4],
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: theme.spacing[4],
        borderBottomWidth: 1,
        borderBottomColor: theme.roles.light.borderDefault,
    },
    noBorder: {
        borderBottomWidth: 0,
        paddingBottom: 0,
    },
    infoTextContainer: {
        marginLeft: theme.spacing[4],
        flex: 1,
    },
    infoLabel: {
        ...theme.typeScale.labelSmall,
        color: theme.roles.light.textSecondary,
        marginBottom: 2,
    },
    infoValue: {
        ...theme.typeScale.bodyLarge,
        color: theme.roles.light.textPrimary,
        fontWeight: '500',
    },
    deleteBtn: {
        marginTop: theme.spacing[4],
        borderColor: theme.roles.light.dangerText,
    },
    deleteHint: {
        ...theme.typeScale.caption,
        color: theme.roles.light.textSecondary,
        textAlign: 'center',
        marginTop: theme.spacing[2],
    },
    editBtn: {
        marginTop: theme.spacing[4],
    },
    editButtons: {
        flexDirection: 'row',
        gap: theme.spacing[4],
        marginTop: theme.spacing[4],
    },
    cancelBtn: {
        flex: 1,
    },
    saveBtn: {
        flex: 1,
    },
    mb2: {
        marginBottom: theme.spacing[2],
    },
    mb3: {
        marginBottom: theme.spacing[3],
    },
});
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { theme } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import { apiErrorMessage } from '../../api/errors';

// A deliberately high-friction, strict confirmation for the single most
// destructive action in the app. The old flow was one native Alert with a
// "Delete" button — one accidental tap from wiping every farm, pond and record
// a user owns. This screen instead requires the user to (1) read exactly what
// is destroyed, (2) type back a confirmation phrase (their email, or a
// localized word for phone-only accounts), and (3) re-enter their password on
// password accounts (also re-verified server-side). Deletion frees the email
// so the person can sign up again later as a brand-new user.
export const DeleteAccountScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const { user, deleteAccount } = useAuthStore();

    const [confirmText, setConfirmText] = useState('');
    const [password, setPassword] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Email is the strongest, language-neutral confirmation target. Phone-only
    // (Truecaller) accounts may have no email — fall back to a localized word.
    const confirmPhrase = useMemo(
        () => (user?.email?.trim() ? user.email.trim() : t('settings.deleteConfirmWord')),
        [user?.email, t],
    );
    // Only email/password accounts have a password to re-verify. Google /
    // Truecaller accounts rely on the typed confirmation alone.
    const requiresPassword = user?.provider === 'email';

    const confirmationMatches =
        confirmText.trim().toLowerCase() === confirmPhrase.toLowerCase();
    const canDelete =
        confirmationMatches && (!requiresPassword || password.length > 0) && !isDeleting;

    const items = [
        t('settings.deleteAccountItemFarms'),
        t('settings.deleteAccountItemLogs'),
        t('settings.deleteAccountItemFinance'),
        t('settings.deleteAccountItemTeam'),
    ];

    const handleDelete = async () => {
        if (!canDelete) return;
        setError(null);
        setIsDeleting(true);
        try {
            await deleteAccount(requiresPassword ? password : undefined);
            // On success clearSession() flips auth status to unauthenticated and
            // the root navigator swaps to the sign-in stack — this screen
            // unmounts, so there's nothing to navigate here.
        } catch (err: any) {
            const status = err?.response?.status;
            setError(
                status === 401
                    ? t('settings.deleteAccountWrongPassword')
                    : apiErrorMessage(err, t('settings.deleteAccountError')),
            );
            setIsDeleting(false);
        }
    };

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.back', 'Back')}
                    style={styles.backBtn}
                >
                    <MaterialCommunityIcons name="chevron-left" size={28} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('settings.deleteAccountTitle')}</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Card style={styles.warningCard}>
                    <View style={styles.warningIcon}>
                        <MaterialCommunityIcons name="alert-octagon-outline" size={26} color={theme.roles.light.dangerText} />
                    </View>
                    <Text style={styles.warningTitle}>{t('settings.deleteAccountWarningTitle')}</Text>
                    <Text style={styles.warningBody}>{t('settings.deleteAccountWarningBody')}</Text>
                </Card>

                <Text style={styles.sectionLabel}>{t('settings.deleteAccountWhatTitle')}</Text>
                <Card style={styles.listCard}>
                    {items.map((label, i) => (
                        <View key={i} style={[styles.listRow, i > 0 && styles.listRowBorder]}>
                            <MaterialCommunityIcons name="close-circle-outline" size={18} color={theme.roles.light.dangerText} />
                            <Text style={styles.listText}>{label}</Text>
                        </View>
                    ))}
                </Card>

                <View style={styles.reuseNote}>
                    <MaterialCommunityIcons name="information-outline" size={16} color={theme.roles.light.textSecondary} />
                    <Text style={styles.reuseNoteText}>{t('settings.deleteAccountReuseNote')}</Text>
                </View>

                <Text style={styles.prompt}>
                    {t('settings.deleteConfirmPrompt')}
                </Text>
                <View style={styles.phraseChip}>
                    <Text style={styles.phraseChipText} selectable>{confirmPhrase}</Text>
                </View>
                <Input
                    label={t('settings.deleteConfirmLabel')}
                    value={confirmText}
                    onChangeText={setConfirmText}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={confirmPhrase}
                    leftIcon="pencil-outline"
                />

                {requiresPassword && (
                    <Input
                        label={t('settings.deletePasswordLabel')}
                        value={password}
                        onChangeText={setPassword}
                        isPassword
                        autoCapitalize="none"
                        leftIcon="lock-outline"
                        hint={t('settings.deletePasswordHint')}
                        error={error && error === t('settings.deleteAccountWrongPassword') ? error : undefined}
                    />
                )}

                {error && !(requiresPassword && error === t('settings.deleteAccountWrongPassword')) ? (
                    <Text style={styles.errorText}>{error}</Text>
                ) : null}

                <Button
                    title={t('settings.deleteAccountButton')}
                    onPress={handleDelete}
                    disabled={!canDelete}
                    loading={isDeleting}
                    icon={<MaterialCommunityIcons name="account-remove" size={18} color={theme.roles.light.textInverse} />}
                    style={styles.deleteBtn}
                />
                <Button
                    title={t('common.cancel')}
                    onPress={() => navigation.goBack()}
                    variant="text"
                    disabled={isDeleting}
                    style={styles.cancelBtn}
                />
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[1],
        paddingTop: theme.spacing[2],
        paddingBottom: theme.spacing[4],
    },
    backBtn: { padding: theme.spacing[1] },
    headerTitle: { ...theme.typeScale.h3, color: theme.roles.light.textPrimary },
    warningCard: {
        alignItems: 'center',
        padding: theme.spacing[5],
        marginBottom: theme.spacing[5],
        gap: theme.spacing[2],
        backgroundColor: theme.roles.light.dangerBg,
        borderWidth: 1,
        borderColor: theme.roles.light.dangerBorder,
    },
    warningIcon: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: theme.roles.light.surface,
        alignItems: 'center', justifyContent: 'center',
    },
    warningTitle: {
        ...theme.typeScale.h4,
        color: theme.roles.light.dangerText,
        textAlign: 'center',
    },
    warningBody: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textSecondary,
        textAlign: 'center',
    },
    sectionLabel: {
        ...theme.typeScale.labelLarge,
        color: theme.roles.light.textPrimary,
        fontWeight: '600',
        marginBottom: theme.spacing[2],
    },
    listCard: { padding: theme.spacing[2], marginBottom: theme.spacing[4] },
    listRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[3],
        paddingVertical: theme.spacing[3],
        paddingHorizontal: theme.spacing[2],
    },
    listRowBorder: {
        borderTopWidth: 1,
        borderTopColor: theme.roles.light.borderDefault,
    },
    listText: { flex: 1, ...theme.typeScale.bodyMedium, color: theme.roles.light.textPrimary },
    reuseNote: {
        flexDirection: 'row',
        gap: theme.spacing[2],
        alignItems: 'flex-start',
        marginBottom: theme.spacing[6],
        paddingHorizontal: theme.spacing[1],
    },
    reuseNoteText: {
        flex: 1,
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
    },
    prompt: {
        ...theme.typeScale.bodyMedium,
        color: theme.roles.light.textPrimary,
        marginBottom: theme.spacing[2],
    },
    phraseChip: {
        alignSelf: 'flex-start',
        backgroundColor: theme.roles.light.surfaceVariant,
        borderRadius: theme.radius.sm,
        paddingHorizontal: theme.spacing[3],
        paddingVertical: theme.spacing[2],
        marginBottom: theme.spacing[3],
    },
    phraseChipText: {
        ...theme.typeScale.labelLarge,
        color: theme.roles.light.textPrimary,
        fontWeight: '700',
    },
    errorText: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.dangerText,
        marginBottom: theme.spacing[3],
    },
    deleteBtn: {
        backgroundColor: theme.roles.light.dangerText,
        marginTop: theme.spacing[2],
    },
    cancelBtn: { marginTop: theme.spacing[1] },
});

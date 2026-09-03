import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { theme } from '../../theme';
import { authApi, TwoFactorSetup } from '../../api/auth';
import { apiErrorMessage } from '../../api/errors';

/**
 * Manage TOTP two-factor authentication: shows current status, walks the user
 * through QR enrolment, and supports disabling with a current code.
 */
export const TwoFactorScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [enabled, setEnabled] = useState(false);
    const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    // Backup codes are shown ONCE, right after enable/regenerate. Held in
    // memory only; never re-fetchable (the server stores hashes).
    const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

    const loadStatus = async () => {
        setLoading(true);
        try {
            const { data } = await authApi.twoFactor.status();
            setEnabled(!!data.enabled);
        } catch {
            setEnabled(false);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStatus();
    }, []);

    const beginSetup = async () => {
        setBusy(true);
        try {
            const { data } = await authApi.twoFactor.setup();
            setSetup(data);
        } catch (err: any) {
            Alert.alert(t('common.error'), apiErrorMessage(err, t('settings.twoFactorSetupError')));
        } finally {
            setBusy(false);
        }
    };

    const confirmEnable = async () => {
        if (code.trim().length !== 6) {
            Alert.alert(t('common.error'), t('settings.twoFactorInvalidCode'));
            return;
        }
        setBusy(true);
        try {
            const { data } = await authApi.twoFactor.enable(code.trim());
            setSetup(null);
            setCode('');
            setEnabled(true);
            setBackupCodes(data.backupCodes ?? null);
            Alert.alert(t('common.ok'), t('settings.twoFactorEnabledSuccess'));
        } catch (err: any) {
            Alert.alert(t('common.error'), apiErrorMessage(err, t('common.error')));
        } finally {
            setBusy(false);
        }
    };

    const regenerate = async () => {
        if (code.trim().length !== 6) {
            Alert.alert(t('common.error'), t('settings.twoFactorCodeRequired'));
            return;
        }
        setBusy(true);
        try {
            const { data } = await authApi.twoFactor.regenerateBackupCodes(code.trim());
            setCode('');
            setBackupCodes(data.backupCodes ?? null);
        } catch (err: any) {
            Alert.alert(t('common.error'), apiErrorMessage(err, t('common.error')));
        } finally {
            setBusy(false);
        }
    };

    const copyBackupCodes = async () => {
        if (!backupCodes) return;
        await Clipboard.setStringAsync(backupCodes.join('\n'));
        Alert.alert(t('common.ok'), t('settings.twoFactorBackupCopied'));
    };

    const disable = async () => {
        if (code.trim().length !== 6) {
            Alert.alert(t('common.error'), t('settings.twoFactorCodeRequired'));
            return;
        }
        setBusy(true);
        try {
            await authApi.twoFactor.disable(code.trim());
            setCode('');
            setEnabled(false);
            Alert.alert(t('common.ok'), t('settings.twoFactorDisabledSuccess'));
        } catch (err: any) {
            Alert.alert(t('common.error'), apiErrorMessage(err, t('common.error')));
        } finally {
            setBusy(false);
        }
    };

    return (
        <ScreenWrapper scroll={false} padded={false}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color={theme.roles.light.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.title}>{t('settings.twoFactorTitle')}</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <ActivityIndicator color={theme.roles.light.primary} style={{ marginTop: theme.spacing[8] }} />
            ) : (
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    <Card style={styles.card}>
                        <View style={styles.statusRow}>
                            <MaterialCommunityIcons
                                name={enabled ? 'shield-check' : 'shield-off-outline'}
                                size={24}
                                color={enabled ? theme.roles.light.successText : theme.roles.light.textSecondary}
                            />
                            <Text style={styles.statusText}>
                                {enabled ? t('settings.twoFactorEnabled') : t('settings.twoFactorNotEnabled')}
                            </Text>
                        </View>
                    </Card>

                    {!enabled && !setup && (
                        <Button title={t('settings.twoFactorSetup')} onPress={beginSetup} loading={busy} style={styles.btn} />
                    )}

                    {!enabled && setup && (
                        <Card style={styles.card}>
                            <Text style={styles.help}>{t('settings.twoFactorScanHelp')}</Text>
                            <Image source={{ uri: setup.qrCodeDataUrl }} style={styles.qr} resizeMode="contain" />
                            <Text style={styles.secret}>{t('settings.twoFactorManualKey', { secret: setup.secret })}</Text>
                            <Input
                                label={t('settings.twoFactorCodeLabel')}
                                value={code}
                                onChangeText={setCode}
                                placeholder="123456"
                                keyboardType="number-pad"
                                maxLength={6}
                            />
                            <Button title={t('settings.twoFactorVerifyEnable')} onPress={confirmEnable} loading={busy} style={styles.btn} />
                        </Card>
                    )}

                    {backupCodes && (
                        <Card style={styles.card}>
                            <View style={styles.statusRow}>
                                <MaterialCommunityIcons name="key-variant" size={22} color={theme.roles.light.primary} />
                                <Text style={styles.statusText}>{t('settings.twoFactorBackupTitle')}</Text>
                            </View>
                            <Text style={styles.help}>{t('settings.twoFactorBackupHelp')}</Text>
                            <View style={styles.codesBox}>
                                {backupCodes.map((bc) => (
                                    <Text key={bc} style={styles.codeText} selectable>{bc}</Text>
                                ))}
                            </View>
                            <Button title={t('settings.twoFactorBackupCopy')} onPress={copyBackupCodes} variant="outlined" style={styles.btn} />
                            <Button title={t('settings.twoFactorBackupAck')} onPress={() => setBackupCodes(null)} style={styles.btn} />
                        </Card>
                    )}

                    {enabled && !backupCodes && (
                        <Card style={styles.card}>
                            <Text style={styles.help}>{t('settings.twoFactorRegenerateHelp')}</Text>
                            <Input
                                label={t('settings.twoFactorAuthCodeLabel')}
                                value={code}
                                onChangeText={setCode}
                                placeholder="123456"
                                keyboardType="number-pad"
                                maxLength={6}
                            />
                            <Button title={t('settings.twoFactorRegenerate')} onPress={regenerate} loading={busy} variant="outlined" style={styles.btn} />
                        </Card>
                    )}

                    {enabled && !backupCodes && (
                        <Card style={styles.card}>
                            <Text style={styles.help}>{t('settings.twoFactorDisableHelp')}</Text>
                            <Input
                                label={t('settings.twoFactorAuthCodeLabel')}
                                value={code}
                                onChangeText={setCode}
                                placeholder="123456"
                                keyboardType="number-pad"
                                maxLength={6}
                            />
                            <Button
                                title={t('settings.twoFactorDisable')}
                                onPress={disable}
                                loading={busy}
                                style={[styles.btn, styles.dangerBtn]}
                                textStyle={{ color: theme.roles.light.dangerText }}
                                variant="outlined"
                            />
                        </Card>
                    )}
                </ScrollView>
            )}
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
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
    statusText: { ...theme.typeScale.bodyLarge, color: theme.roles.light.textPrimary },
    help: { ...theme.typeScale.bodyMedium, color: theme.roles.light.textSecondary, marginBottom: theme.spacing[4] },
    qr: { width: 200, height: 200, alignSelf: 'center', marginBottom: theme.spacing[3] },
    secret: {
        ...theme.typeScale.bodySmall,
        color: theme.roles.light.textSecondary,
        textAlign: 'center',
        marginBottom: theme.spacing[4],
    },
    btn: { marginTop: theme.spacing[3] },
    dangerBtn: { borderColor: theme.roles.light.dangerText },
    codesBox: {
        backgroundColor: theme.roles.light.surfaceVariant ?? theme.roles.light.background,
        borderRadius: 8,
        padding: theme.spacing[3],
        marginBottom: theme.spacing[2],
    },
    codeText: {
        ...theme.typeScale.bodyLarge,
        fontFamily: 'monospace',
        letterSpacing: 2,
        textAlign: 'center',
        color: theme.roles.light.textPrimary,
        paddingVertical: 2,
    },
});
